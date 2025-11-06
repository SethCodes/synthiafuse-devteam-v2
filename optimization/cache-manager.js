/**
 * Prompt Cache Manager
 *
 * Manages Claude's prompt caching to achieve 90% cost reduction on cached content.
 * Implements intelligent caching strategies, cache warming, and cache-aware optimization.
 *
 * Claude Prompt Caching Features:
 * - 90% cost savings on cached content (only pay 10% vs full price)
 * - 5-minute cache lifetime
 * - Cache-aware rate limits (cached tokens don't count against ITPM)
 * - Automatic cache invalidation and refresh
 *
 * Expected Impact:
 * - 30-40% additional savings on top of Week 1 optimizations
 * - 80%+ cache hit rate on repeated operations
 * - Reduced API latency on cache hits
 *
 * @module PromptCacheManager
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class PromptCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      enabled: options.enabled !== false,
      cacheLifetime: options.cacheLifetime || 300000, // 5 minutes (Claude's cache TTL)
      maxCacheSize: options.maxCacheSize || 100, // Max cached items
      minCacheableSize: options.minCacheableSize || 1000, // Min tokens to cache
      warmCacheOnInit: options.warmCacheOnInit || false,
      aggressiveCaching: options.aggressiveCaching || false
    };

    // Cache storage
    this.cache = new Map();

    // Cache metadata
    this.metadata = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSavings: 0,
      cacheableContent: new Map() // Content that should be cached
    };

    // Content categorization
    this.contentTypes = {
      // Highly cacheable (rarely changes)
      static: {
        priority: 1,
        examples: ['agent contexts', 'system prompts', 'tool definitions'],
        cacheFor: 300000 // 5 minutes (full TTL)
      },

      // Moderately cacheable (changes occasionally)
      semiStatic: {
        priority: 2,
        examples: ['project context', 'code files', 'documentation'],
        cacheFor: 180000 // 3 minutes
      },

      // Dynamically cacheable (changes frequently but worth caching)
      dynamic: {
        priority: 3,
        examples: ['task lists', 'recent changes', 'state summaries'],
        cacheFor: 60000 // 1 minute
      }
    };

    // Performance tracking
    this.stats = {
      totalRequests: 0,
      cachedRequests: 0,
      cacheSavings: 0, // Tokens saved through caching
      avgCacheHitRate: 0,
      cacheEfficiency: 0 // Savings per cached item
    };

    // Start cache maintenance
    if (this.config.enabled) {
      this.startMaintenance();
    }
  }

  /**
   * Prepare content for caching
   * @param {Array|Object} messages - Messages to prepare
   * @param {Object} options - Caching options
   * @returns {Array} - Messages with cache control markers
   */
  prepareCacheableContent(messages, options = {}) {
    if (!this.config.enabled) {
      return messages;
    }

    this.stats.totalRequests++;

    // Ensure messages is an array
    const messageArray = Array.isArray(messages) ? messages : [messages];

    // Determine what to cache
    const cacheStrategy = this.determineCacheStrategy(messageArray, options);

    if (!cacheStrategy.shouldCache) {
      this.metadata.misses++;
      return messageArray;
    }

    // Apply cache control to appropriate messages
    const preparedMessages = this.applyCacheControl(
      messageArray,
      cacheStrategy
    );

    // Track caching decision
    this.trackCacheDecision(preparedMessages, cacheStrategy);

    return preparedMessages;
  }

  /**
   * Determine caching strategy for messages
   * @param {Array} messages - Messages to analyze
   * @param {Object} options - Options
   * @returns {Object} - Cache strategy
   */
  determineCacheStrategy(messages, options) {
    const strategy = {
      shouldCache: false,
      cachePoints: [],
      estimatedSavings: 0,
      reason: ''
    };

    // Don't cache if too small
    const totalTokens = this.estimateTokens(messages);
    if (totalTokens < this.config.minCacheableSize) {
      strategy.reason = 'Content too small to cache';
      return strategy;
    }

    // Identify cacheable sections
    const cachePoints = this.identifyCachePoints(messages, options);

    if (cachePoints.length === 0) {
      strategy.reason = 'No cacheable content identified';
      return strategy;
    }

    // Calculate potential savings
    const savings = cachePoints.reduce((sum, point) =>
      sum + (point.tokens * 0.9), 0 // 90% savings on cached content
    );

    strategy.shouldCache = true;
    strategy.cachePoints = cachePoints;
    strategy.estimatedSavings = Math.round(savings);
    strategy.reason = `${cachePoints.length} cache points, ~${strategy.estimatedSavings} token savings`;

    return strategy;
  }

  /**
   * Identify cache points in messages
   * @param {Array} messages - Messages to analyze
   * @param {Object} options - Options
   * @returns {Array} - Cache points
   */
  identifyCachePoints(messages, options) {
    const cachePoints = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const type = this.classifyContent(message, options);

      if (type) {
        const tokens = this.estimateTokens([message]);

        cachePoints.push({
          index: i,
          type: type,
          priority: this.contentTypes[type].priority,
          tokens: tokens,
          message: message
        });
      }
    }

    // Sort by priority (cache most important content first)
    return cachePoints.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Classify content for caching
   * @param {Object} message - Message to classify
   * @param {Object} options - Options
   * @returns {string|null} - Content type or null
   */
  classifyContent(message, options) {
    // User-specified type
    if (options.contentType) {
      return options.contentType;
    }

    // Analyze message content
    const text = typeof message === 'string' ? message :
                 message.text || message.content || '';

    // Static content patterns
    if (this.isStaticContent(text, message)) {
      return 'static';
    }

    // Semi-static content patterns
    if (this.isSemiStaticContent(text, message)) {
      return 'semiStatic';
    }

    // Dynamic but cacheable
    if (this.config.aggressiveCaching && text.length > 500) {
      return 'dynamic';
    }

    return null;
  }

  /**
   * Check if content is static
   * @param {string} text - Content text
   * @param {Object} message - Full message
   * @returns {boolean}
   */
  isStaticContent(text, message) {
    // System prompts
    if (message.role === 'system') return true;

    // Agent contexts (CLAUDE.md files)
    if (text.includes('CLAUDE.md') || text.includes('# Agent:')) return true;

    // Tool definitions
    if (text.includes('tool_choice') || text.includes('function_name')) return true;

    // API documentation
    if (text.includes('API Reference') || text.includes('## API')) return true;

    return false;
  }

  /**
   * Check if content is semi-static
   * @param {string} text - Content text
   * @param {Object} message - Full message
   * @returns {boolean}
   */
  isSemiStaticContent(text, message) {
    // Project context
    if (text.includes('Project:') || text.includes('## Project')) return true;

    // Code files (longer than 200 chars)
    if (text.match(/^(class|function|const|import|export)/m) && text.length > 200) return true;

    // Documentation
    if (text.includes('/**') || text.includes('README')) return true;

    return false;
  }

  /**
   * Apply cache control to messages
   * @param {Array} messages - Messages
   * @param {Object} strategy - Cache strategy
   * @returns {Array} - Messages with cache control
   */
  applyCacheControl(messages, strategy) {
    const result = [...messages];

    // Apply cache_control to identified points
    for (const point of strategy.cachePoints) {
      const message = result[point.index];

      // Add cache control marker
      if (typeof message === 'object') {
        result[point.index] = {
          ...message,
          cache_control: { type: 'ephemeral' }
        };
      } else {
        // Convert string to object with cache control
        result[point.index] = {
          type: 'text',
          text: message,
          cache_control: { type: 'ephemeral' }
        };
      }
    }

    return result;
  }

  /**
   * Track cache decision
   * @param {Array} messages - Prepared messages
   * @param {Object} strategy - Cache strategy
   */
  trackCacheDecision(messages, strategy) {
    // Generate cache key
    const cacheKey = this.generateCacheKey(messages);

    // Check if we've seen this before
    const existingEntry = this.cache.get(cacheKey);

    if (existingEntry) {
      // Cache hit!
      this.metadata.hits++;
      this.stats.cachedRequests++;
      this.stats.cacheSavings += strategy.estimatedSavings;

      existingEntry.hits++;
      existingEntry.lastAccess = Date.now();
      existingEntry.savings += strategy.estimatedSavings;

      this.emit('cache-hit', {
        cacheKey,
        savings: strategy.estimatedSavings,
        totalHits: existingEntry.hits
      });
    } else {
      // Cache miss - first time
      this.metadata.misses++;

      this.cache.set(cacheKey, {
        key: cacheKey,
        messages: messages,
        strategy: strategy,
        hits: 0,
        savings: 0,
        createdAt: Date.now(),
        lastAccess: Date.now()
      });

      this.emit('cache-miss', {
        cacheKey,
        potentialSavings: strategy.estimatedSavings
      });
    }

    // Update statistics
    this.updateStatistics();

    // Enforce cache size limit
    if (this.cache.size > this.config.maxCacheSize) {
      this.evictOldest();
    }
  }

  /**
   * Generate cache key for messages
   * @param {Array} messages - Messages
   * @returns {string} - Cache key
   */
  generateCacheKey(messages) {
    // Create deterministic hash of message content
    const content = JSON.stringify(messages.map(m => {
      // Extract just the text content for hashing
      if (typeof m === 'string') return m;
      return m.text || m.content || '';
    }));

    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Estimate tokens in messages
   * @param {Array} messages - Messages
   * @returns {number} - Estimated tokens
   */
  estimateTokens(messages) {
    const text = messages.map(m => {
      if (typeof m === 'string') return m;
      return m.text || m.content || '';
    }).join('');

    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Update cache statistics
   */
  updateStatistics() {
    const totalAttempts = this.metadata.hits + this.metadata.misses;

    if (totalAttempts > 0) {
      this.stats.avgCacheHitRate = (this.metadata.hits / totalAttempts) * 100;
    }

    if (this.cache.size > 0) {
      const totalSavings = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.savings, 0);

      this.stats.cacheEfficiency = totalSavings / this.cache.size;
    }
  }

  /**
   * Evict oldest cache entries
   */
  evictOldest() {
    // Sort by last access time
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Evict oldest 10%
    const toEvict = Math.ceil(this.cache.size * 0.1);

    for (let i = 0; i < toEvict; i++) {
      const [key, entry] = entries[i];
      this.cache.delete(key);
      this.metadata.evictions++;

      this.emit('cache-evicted', {
        cacheKey: key,
        age: Date.now() - entry.createdAt,
        hits: entry.hits,
        savings: entry.savings
      });
    }
  }

  /**
   * Warm cache with common content
   * @param {Array} content - Content to warm cache with
   */
  async warmCache(content) {
    console.log('🔥 Warming cache with common content...');

    for (const item of content) {
      const prepared = this.prepareCacheableContent(item.messages, {
        contentType: item.type || 'static'
      });

      // Simulate cache population
      const cacheKey = this.generateCacheKey(prepared);

      if (!this.cache.has(cacheKey)) {
        this.metadata.cacheableContent.set(item.name || cacheKey, {
          key: cacheKey,
          name: item.name,
          type: item.type,
          messages: prepared
        });
      }
    }

    console.log(`✅ Cache warmed with ${content.length} items`);
  }

  /**
   * Get cache statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      hits: this.metadata.hits,
      misses: this.metadata.misses,
      evictions: this.metadata.evictions,
      hitRate: this.stats.avgCacheHitRate,
      totalSavings: this.stats.cacheSavings,
      efficiency: this.stats.cacheEfficiency,
      estimatedMonthlySavings: this.estimateMonthlySavings()
    };
  }

  /**
   * Estimate monthly savings from caching
   * @returns {number} - Estimated monthly token savings
   */
  estimateMonthlySavings() {
    if (this.stats.totalRequests === 0) return 0;

    const avgSavingsPerRequest = this.stats.cacheSavings / this.stats.totalRequests;
    const requestsPerMonth = 30 * 24 * 10; // Assume 10 requests/hour

    return Math.round(avgSavingsPerRequest * requestsPerMonth);
  }

  /**
   * Start cache maintenance routine
   */
  startMaintenance() {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute
  }

  /**
   * Perform cache maintenance
   */
  performMaintenance() {
    const now = Date.now();
    let expired = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.lastAccess;

      if (age > this.config.cacheLifetime) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      this.emit('cache-maintenance', {
        expired,
        remaining: this.cache.size
      });
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();

    this.emit('cache-cleared', { entriesCleared: size });

    console.log(`🗑️  Cache cleared (${size} entries removed)`);
  }

  /**
   * Cleanup and shutdown
   */
  destroy() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    this.clearCache();
    this.removeAllListeners();
  }
}

module.exports = PromptCacheManager;
