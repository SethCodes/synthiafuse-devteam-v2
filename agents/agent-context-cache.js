/**
 * Agent Context Cache
 *
 * Specialized caching layer for agent contexts to prevent redundant loading
 * and leverage Claude's prompt caching for 90% cost savings on repeated agent usage.
 *
 * Integration with OptimizedAgentDiscovery:
 * - Caches full agent contexts after first load
 * - Tracks agent file modifications for cache invalidation
 * - Provides cache-aware agent loading
 * - Supports cache warming for frequently used agents
 *
 * Expected Impact:
 * - 90% savings on repeated agent loads (first: full, subsequent: 10% cost)
 * - Reduced latency for multi-task workflows
 * - Lower token usage on agent-heavy operations
 *
 * @module AgentContextCache
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AgentContextCache extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      cacheDirectory: options.cacheDirectory || null,
      agentDirectory: options.agentDirectory || null,
      watchForChanges: options.watchForChanges !== false,
      maxCachedAgents: options.maxCachedAgents || 50,
      cacheLifetime: options.cacheLifetime || 300000, // 5 minutes
      preloadCommon: options.preloadCommon || true
    };

    // Cache storage
    this.agentCache = new Map();
    this.fileHashes = new Map(); // Track file modifications

    // Metadata
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      loadsAvoided: 0,
      tokensSaved: 0,
      avgAgentSize: 0,
      mostUsedAgents: new Map()
    };

    // File watchers
    this.watchers = new Map();

    // Start monitoring if enabled
    if (this.config.watchForChanges && this.config.agentDirectory) {
      this.initializeWatching().catch(err => {
        console.error('Failed to initialize agent watching:', err.message);
      });
    }
  }

  /**
   * Load agent context with caching
   * @param {string} agentId - Agent ID
   * @param {Object} options - Load options
   * @returns {Promise<Object>} - Agent context
   */
  async loadAgentContext(agentId, options = {}) {
    const cacheKey = this.generateCacheKey(agentId);

    // Check cache first
    const cached = this.agentCache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      // Cache hit!
      this.stats.cacheHits++;
      this.stats.loadsAvoided++;
      this.stats.tokensSaved += cached.estimatedTokens * 0.9; // 90% savings

      // Update usage tracking
      const usageCount = this.stats.mostUsedAgents.get(agentId) || 0;
      this.stats.mostUsedAgents.set(agentId, usageCount + 1);

      cached.lastAccess = Date.now();
      cached.hitCount++;

      this.emit('cache-hit', {
        agentId,
        estimatedSavings: Math.round(cached.estimatedTokens * 0.9),
        hitCount: cached.hitCount
      });

      return this.prepareCachedContext(cached);
    }

    // Cache miss - load from file
    this.stats.cacheMisses++;

    const context = await this.loadFromFile(agentId, options);

    // Cache the loaded context
    await this.cacheContext(agentId, context);

    this.emit('cache-miss', {
      agentId,
      contextSize: context.estimatedTokens
    });

    return context;
  }

  /**
   * Load agent context from file
   * @param {string} agentId - Agent ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Context
   */
  async loadFromFile(agentId, options) {
    if (!this.config.agentDirectory) {
      throw new Error('Agent directory not configured');
    }

    // Construct file path
    const agentPath = path.join(this.config.agentDirectory, agentId, 'CLAUDE.md');

    try {
      // Read agent file
      const content = await fs.readFile(agentPath, 'utf8');

      // Calculate file hash for change detection
      const fileHash = this.hashContent(content);
      this.fileHashes.set(agentId, fileHash);

      // Estimate tokens
      const estimatedTokens = Math.ceil(content.length / 4);

      // Parse metadata from content
      const metadata = this.parseAgentMetadata(content);

      const context = {
        agentId,
        content,
        metadata,
        estimatedTokens,
        filePath: agentPath,
        fileHash,
        loadedAt: Date.now()
      };

      // Update average size
      this.updateAverageSize(estimatedTokens);

      return context;
    } catch (error) {
      throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
    }
  }

  /**
   * Cache agent context
   * @param {string} agentId - Agent ID
   * @param {Object} context - Context to cache
   */
  async cacheContext(agentId, context) {
    const cacheKey = this.generateCacheKey(agentId);

    // Prepare cache entry
    const cacheEntry = {
      agentId,
      content: context.content,
      metadata: context.metadata,
      estimatedTokens: context.estimatedTokens,
      fileHash: context.fileHash,
      cachedAt: Date.now(),
      lastAccess: Date.now(),
      hitCount: 0,
      // Add cache control marker for Claude
      cacheControl: { type: 'ephemeral' }
    };

    this.agentCache.set(cacheKey, cacheEntry);

    // Enforce cache size limit
    if (this.agentCache.size > this.config.maxCachedAgents) {
      this.evictLeastUsed();
    }

    this.emit('context-cached', {
      agentId,
      estimatedTokens: context.estimatedTokens
    });
  }

  /**
   * Prepare cached context for use
   * @param {Object} cached - Cached entry
   * @returns {Object} - Prepared context
   */
  prepareCachedContext(cached) {
    return {
      agentId: cached.agentId,
      content: cached.content,
      metadata: cached.metadata,
      estimatedTokens: cached.estimatedTokens,
      fromCache: true,
      cacheAge: Date.now() - cached.cachedAt,
      cacheControl: cached.cacheControl // Include for Claude
    };
  }

  /**
   * Bulk load multiple agents with caching
   * @param {Array<string>} agentIds - Agent IDs to load
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Loaded contexts
   */
  async loadMultipleAgents(agentIds, options = {}) {
    const results = [];

    // Load in parallel
    const loadPromises = agentIds.map(agentId =>
      this.loadAgentContext(agentId, options)
    );

    const contexts = await Promise.all(loadPromises);

    for (const context of contexts) {
      results.push(context);
    }

    // Emit bulk load event
    this.emit('bulk-load', {
      count: agentIds.length,
      cacheHits: contexts.filter(c => c.fromCache).length,
      cacheMisses: contexts.filter(c => !c.fromCache).length
    });

    return results;
  }

  /**
   * Warm cache with commonly used agents
   * @param {Array<string>} agentIds - Agent IDs to preload
   */
  async warmCache(agentIds) {
    console.log(`🔥 Warming agent cache with ${agentIds.length} agents...`);

    const loaded = [];

    for (const agentId of agentIds) {
      try {
        const context = await this.loadAgentContext(agentId);
        loaded.push(agentId);
      } catch (error) {
        console.error(`Failed to warm cache for ${agentId}:`, error.message);
      }
    }

    console.log(`✅ Agent cache warmed (${loaded.length}/${agentIds.length} agents loaded)`);

    this.emit('cache-warmed', {
      requested: agentIds.length,
      loaded: loaded.length
    });

    return loaded;
  }

  /**
   * Invalidate cache for specific agent
   * @param {string} agentId - Agent ID
   */
  invalidate(agentId) {
    const cacheKey = this.generateCacheKey(agentId);

    if (this.agentCache.has(cacheKey)) {
      this.agentCache.delete(cacheKey);
      this.fileHashes.delete(agentId);

      this.emit('cache-invalidated', { agentId });

      console.log(`♻️  Cache invalidated for agent: ${agentId}`);
    }
  }

  /**
   * Check if file has changed and invalidate if needed
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} - True if invalidated
   */
  async checkAndInvalidateIfChanged(agentId) {
    if (!this.config.agentDirectory) return false;

    const agentPath = path.join(this.config.agentDirectory, agentId, 'CLAUDE.md');

    try {
      const content = await fs.readFile(agentPath, 'utf8');
      const newHash = this.hashContent(content);
      const oldHash = this.fileHashes.get(agentId);

      if (oldHash && newHash !== oldHash) {
        // File changed!
        this.invalidate(agentId);
        return true;
      }

      return false;
    } catch (error) {
      // File might not exist anymore
      this.invalidate(agentId);
      return true;
    }
  }

  /**
   * Initialize file watching for agent changes
   */
  async initializeWatching() {
    if (!this.config.agentDirectory) return;

    try {
      const fs = require('fs');

      // Watch agent directory
      const watcher = fs.watch(this.config.agentDirectory, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('CLAUDE.md')) {
          // Extract agent ID from path
          const parts = filename.split(path.sep);
          const agentId = parts[0];

          console.log(`📝 Agent file changed: ${agentId}`);
          this.invalidate(agentId);
        }
      });

      this.watchers.set('agent-directory', watcher);

      console.log(`👀 Watching for agent file changes: ${this.config.agentDirectory}`);
    } catch (error) {
      console.error('Failed to setup file watching:', error.message);
    }
  }

  /**
   * Parse agent metadata from content
   * @param {string} content - Agent content
   * @returns {Object} - Metadata
   */
  parseAgentMetadata(content) {
    const metadata = {};

    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) metadata.title = titleMatch[1];

    // Extract role
    const roleMatch = content.match(/\*\*Role\*\*:\s*(.+)$/m);
    if (roleMatch) metadata.role = roleMatch[1];

    // Extract primary focus
    const focusMatch = content.match(/\*\*Primary Focus\*\*:\s*(.+)$/m);
    if (focusMatch) metadata.primaryFocus = focusMatch[1];

    return metadata;
  }

  /**
   * Generate cache key for agent
   * @param {string} agentId - Agent ID
   * @returns {string} - Cache key
   */
  generateCacheKey(agentId) {
    return `agent:${agentId}`;
  }

  /**
   * Hash content for change detection
   * @param {string} content - Content to hash
   * @returns {string} - Hash
   */
  hashContent(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Check if cache entry is expired
   * @param {Object} entry - Cache entry
   * @returns {boolean} - Is expired
   */
  isCacheExpired(entry) {
    const age = Date.now() - entry.cachedAt;
    return age > this.config.cacheLifetime;
  }

  /**
   * Evict least used cache entries
   */
  evictLeastUsed() {
    // Sort by hit count and last access
    const entries = Array.from(this.agentCache.entries())
      .sort((a, b) => {
        const scoreA = a[1].hitCount * 1000 - (Date.now() - a[1].lastAccess);
        const scoreB = b[1].hitCount * 1000 - (Date.now() - b[1].lastAccess);
        return scoreA - scoreB;
      });

    // Evict bottom 20%
    const toEvict = Math.ceil(this.agentCache.size * 0.2);

    for (let i = 0; i < toEvict; i++) {
      const [key, entry] = entries[i];
      this.agentCache.delete(key);

      this.emit('cache-evicted', {
        agentId: entry.agentId,
        hitCount: entry.hitCount,
        age: Date.now() - entry.cachedAt
      });
    }
  }

  /**
   * Update average agent size
   * @param {number} size - Size to include
   */
  updateAverageSize(size) {
    const totalLoads = this.stats.cacheHits + this.stats.cacheMisses;

    if (totalLoads === 0) {
      this.stats.avgAgentSize = size;
    } else {
      this.stats.avgAgentSize =
        (this.stats.avgAgentSize * (totalLoads - 1) + size) / totalLoads;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const totalAttempts = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = totalAttempts > 0 ? (this.stats.cacheHits / totalAttempts) * 100 : 0;

    // Get top 10 most used agents
    const topAgents = Array.from(this.stats.mostUsedAgents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agentId, count]) => ({ agentId, usageCount: count }));

    return {
      cacheSize: this.agentCache.size,
      maxCacheSize: this.config.maxCachedAgents,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: parseFloat(hitRate.toFixed(1)),
      loadsAvoided: this.stats.loadsAvoided,
      tokensSaved: Math.round(this.stats.tokensSaved),
      avgAgentSize: Math.round(this.stats.avgAgentSize),
      topAgents: topAgents
    };
  }

  /**
   * Clear all cache
   */
  clearCache() {
    const size = this.agentCache.size;
    this.agentCache.clear();
    this.fileHashes.clear();

    this.emit('cache-cleared', { entriesCleared: size });

    console.log(`🗑️  Agent cache cleared (${size} entries removed)`);
  }

  /**
   * Cleanup and shutdown
   */
  destroy() {
    // Stop file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }

    this.watchers.clear();
    this.clearCache();
    this.removeAllListeners();
  }
}

module.exports = AgentContextCache;
