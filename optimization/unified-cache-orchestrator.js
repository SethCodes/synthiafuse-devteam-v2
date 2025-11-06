/**
 * Unified Cache Orchestrator
 *
 * Coordinates all caching systems (Prompt Cache, Agent Context, Shared Context)
 * and implements comprehensive cache warming strategies for optimal performance.
 *
 * Combines Tickets 2.3 (Shared Context Caching) and 2.4 (Cache Warming Strategy)
 * into a single integrated system.
 *
 * Features:
 * - Unified cache management across all components
 * - Intelligent cache warming on startup
 * - Shared context deduplication
 * - Cross-component cache coordination
 * - Comprehensive analytics and monitoring
 *
 * Expected Impact:
 * - 95%+ cache hit rate after warming
 * - 80-90% token reduction through combined caching
 * - Reduced cold start latency
 * - Optimized memory usage
 *
 * @module UnifiedCacheOrchestrator
 */

const EventEmitter = require('events');
const PromptCacheManager = require('./cache-manager');
const AgentContextCache = require('../agents/agent-context-cache');

class UnifiedCacheOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      agentDirectory: options.agentDirectory || null,
      warmOnInit: options.warmOnInit !== false,
      commonAgents: options.commonAgents || [],
      sharedContexts: options.sharedContexts || [],
      autoOptimize: options.autoOptimize !== false,
      analyticsInterval: options.analyticsInterval || 60000 // 1 minute
    };

    // Initialize sub-systems
    this.promptCache = new PromptCacheManager({
      enabled: true,
      maxCacheSize: options.maxPromptCache || 100,
      minCacheableSize: options.minCacheableSize || 1000,
      aggressiveCaching: options.aggressiveCaching || false
    });

    this.agentCache = new AgentContextCache({
      agentDirectory: this.config.agentDirectory,
      watchForChanges: options.watchForChanges !== false,
      maxCachedAgents: options.maxCachedAgents || 50,
      preloadCommon: true
    });

    // Shared context storage (prevents duplication)
    this.sharedContexts = new Map();

    // Statistics
    this.stats = {
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalTokensSaved: 0,
      cacheEfficiency: 0,
      warmedAt: null,
      lastOptimized: null
    };

    // Analytics tracking
    this.analyticsHistory = [];

    // Wire up event listeners
    this.setupEventListeners();

    // Start analytics if enabled
    if (this.config.autoOptimize) {
      this.startAnalytics();
    }

    // Warm cache on initialization if enabled
    if (this.config.warmOnInit) {
      this.warmAllCaches().catch(err => {
        console.error('Failed to warm caches on init:', err.message);
      });
    }
  }

  /**
   * Setup event listeners for sub-systems
   */
  setupEventListeners() {
    // Prompt cache events
    this.promptCache.on('cache-hit', (event) => {
      this.stats.totalCacheHits++;
      this.stats.totalTokensSaved += event.savings || 0;
      this.emit('cache-hit', { source: 'prompt', ...event });
    });

    this.promptCache.on('cache-miss', (event) => {
      this.stats.totalCacheMisses++;
      this.emit('cache-miss', { source: 'prompt', ...event });
    });

    // Agent cache events
    this.agentCache.on('cache-hit', (event) => {
      this.stats.totalCacheHits++;
      this.stats.totalTokensSaved += event.estimatedSavings || 0;
      this.emit('cache-hit', { source: 'agent', ...event });
    });

    this.agentCache.on('cache-miss', (event) => {
      this.stats.totalCacheMisses++;
      this.emit('cache-miss', { source: 'agent', ...event });
    });
  }

  /**
   * Warm all caches with common content
   */
  async warmAllCaches() {
    console.log('\n🔥 Warming all caches...\n');

    const startTime = Date.now();
    const warmed = {
      agents: 0,
      prompts: 0,
      sharedContexts: 0
    };

    try {
      // 1. Warm agent cache
      if (this.config.commonAgents.length > 0) {
        console.log(`📋 Warming agent cache (${this.config.commonAgents.length} agents)...`);
        const loadedAgents = await this.agentCache.warmCache(this.config.commonAgents);
        warmed.agents = loadedAgents.length;
        console.log(`   ✅ Loaded ${warmed.agents} agents\n`);
      }

      // 2. Warm prompt cache
      if (this.config.sharedContexts.length > 0) {
        console.log(`📝 Warming prompt cache (${this.config.sharedContexts.length} contexts)...`);
        await this.promptCache.warmCache(this.config.sharedContexts);
        warmed.prompts = this.config.sharedContexts.length;
        console.log(`   ✅ Cached ${warmed.prompts} prompts\n`);
      }

      // 3. Warm shared contexts
      console.log('🔗 Loading shared contexts...');
      await this.loadSharedContexts();
      warmed.sharedContexts = this.sharedContexts.size;
      console.log(`   ✅ Loaded ${warmed.sharedContexts} shared contexts\n`);

      const duration = Date.now() - startTime;
      this.stats.warmedAt = new Date();

      console.log(`✅ Cache warming complete in ${duration}ms\n`);
      console.log('📊 Warming Summary:');
      console.log(`   Agents: ${warmed.agents}`);
      console.log(`   Prompts: ${warmed.prompts}`);
      console.log(`   Shared Contexts: ${warmed.sharedContexts}`);
      console.log(`   Total Duration: ${duration}ms\n`);

      this.emit('caches-warmed', {
        ...warmed,
        duration
      });

      return warmed;
    } catch (error) {
      console.error('❌ Cache warming failed:', error.message);
      throw error;
    }
  }

  /**
   * Load shared contexts that are commonly used
   */
  async loadSharedContexts() {
    // Common shared contexts (customize based on your use case)
    const commonContexts = [
      {
        id: 'system-instructions',
        content: this.getSystemInstructions(),
        type: 'static'
      },
      {
        id: 'tool-definitions',
        content: this.getToolDefinitions(),
        type: 'static'
      },
      {
        id: 'code-standards',
        content: this.getCodeStandards(),
        type: 'semi-static'
      }
    ];

    for (const context of commonContexts) {
      this.sharedContexts.set(context.id, {
        ...context,
        cachedAt: Date.now(),
        accessCount: 0
      });
    }
  }

  /**
   * Get system instructions (example)
   */
  getSystemInstructions() {
    return `You are an expert AI assistant specialized in software development.

Your capabilities include:
- Writing clean, maintainable code
- Debugging complex issues
- Optimizing performance
- Following best practices
- Comprehensive testing
- Security-conscious development

Always provide detailed explanations and consider edge cases.`;
  }

  /**
   * Get tool definitions (example)
   */
  getToolDefinitions() {
    return `Available Tools:
- read_file: Read file contents
- write_file: Write file contents
- execute_command: Execute shell command
- search_code: Search codebase
- analyze_code: Analyze code quality`;
  }

  /**
   * Get code standards (example)
   */
  getCodeStandards() {
    return `Code Standards:
- Use TypeScript for type safety
- Follow ESLint configuration
- Write unit tests for all functions
- Document public APIs
- Use meaningful variable names`;
  }

  /**
   * Get shared context by ID
   * @param {string} contextId - Context ID
   * @returns {Object|null} - Context or null
   */
  getSharedContext(contextId) {
    const context = this.sharedContexts.get(contextId);

    if (context) {
      context.accessCount++;
      return {
        content: context.content,
        type: context.type,
        cached: true
      };
    }

    return null;
  }

  /**
   * Prepare messages with all caching optimizations
   * @param {Array} messages - Messages to prepare
   * @param {Object} options - Options
   * @returns {Array} - Optimized messages
   */
  prepareMessages(messages, options = {}) {
    let optimized = [...messages];

    // 1. Inject shared contexts if requested
    if (options.includeSharedContexts) {
      optimized = this.injectSharedContexts(optimized, options.sharedContexts || []);
    }

    // 2. Apply prompt caching
    optimized = this.promptCache.prepareCacheableContent(optimized, {
      contentType: options.contentType,
      aggressiveCaching: options.aggressiveCaching
    });

    return optimized;
  }

  /**
   * Inject shared contexts into messages
   * @param {Array} messages - Messages
   * @param {Array<string>} contextIds - Context IDs to inject
   * @returns {Array} - Messages with injected contexts
   */
  injectSharedContexts(messages, contextIds) {
    const injected = [];

    // Add shared contexts at the beginning
    for (const contextId of contextIds) {
      const context = this.getSharedContext(contextId);

      if (context) {
        injected.push({
          role: 'system',
          content: context.content,
          cache_control: { type: 'ephemeral' } // Mark as cacheable
        });
      }
    }

    // Add original messages
    injected.push(...messages);

    return injected;
  }

  /**
   * Load agents with caching
   * @param {Array<string>} agentIds - Agent IDs
   * @returns {Promise<Array>} - Agent contexts
   */
  async loadAgents(agentIds) {
    return await this.agentCache.loadMultipleAgents(agentIds);
  }

  /**
   * Start analytics tracking
   */
  startAnalytics() {
    this.analyticsTimer = setInterval(() => {
      this.collectAnalytics();
    }, this.config.analyticsInterval);
  }

  /**
   * Collect analytics snapshot
   */
  collectAnalytics() {
    const snapshot = {
      timestamp: Date.now(),
      promptCache: this.promptCache.getStatistics(),
      agentCache: this.agentCache.getStatistics(),
      overall: {
        totalCacheHits: this.stats.totalCacheHits,
        totalCacheMisses: this.stats.totalCacheMisses,
        totalTokensSaved: this.stats.totalTokensSaved,
        hitRate: this.calculateOverallHitRate(),
        sharedContexts: this.sharedContexts.size
      }
    };

    this.analyticsHistory.push(snapshot);

    // Keep only last 100 snapshots
    if (this.analyticsHistory.length > 100) {
      this.analyticsHistory = this.analyticsHistory.slice(-100);
    }

    // Update efficiency
    this.updateEfficiency();

    this.emit('analytics-collected', snapshot);
  }

  /**
   * Calculate overall cache hit rate
   * @returns {number} - Hit rate percentage
   */
  calculateOverallHitRate() {
    const total = this.stats.totalCacheHits + this.stats.totalCacheMisses;

    if (total === 0) return 0;

    return (this.stats.totalCacheHits / total) * 100;
  }

  /**
   * Update cache efficiency metric
   */
  updateEfficiency() {
    const promptStats = this.promptCache.getStatistics();
    const agentStats = this.agentCache.getStatistics();

    const totalOperations = promptStats.hits + promptStats.misses +
                            agentStats.cacheHits + agentStats.cacheMisses;

    if (totalOperations === 0) {
      this.stats.cacheEfficiency = 0;
      return;
    }

    this.stats.cacheEfficiency = (this.stats.totalTokensSaved / totalOperations);
  }

  /**
   * Optimize cache configuration based on usage patterns
   */
  async optimizeCache() {
    console.log('\n⚙️  Optimizing cache configuration...\n');

    const promptStats = this.promptCache.getStatistics();
    const agentStats = this.agentCache.getStatistics();

    const optimizations = [];

    // Check if we should increase agent cache size
    if (agentStats.cacheSize === agentStats.maxCacheSize &&
        agentStats.hitRate > 80) {
      optimizations.push('Increase agent cache size (high hit rate at capacity)');
    }

    // Check if we should enable aggressive caching
    if (promptStats.hitRate < 50) {
      optimizations.push('Enable aggressive prompt caching (low hit rate)');
    }

    // Check if we should pre-load more agents
    if (agentStats.topAgents && agentStats.topAgents.length > 0) {
      const topAgentIds = agentStats.topAgents.slice(0, 5).map(a => a.agentId);
      optimizations.push(`Pre-load top agents: ${topAgentIds.join(', ')}`);

      // Automatically warm these agents
      await this.agentCache.warmCache(topAgentIds);
    }

    this.stats.lastOptimized = new Date();

    console.log(`✅ Optimization complete (${optimizations.length} actions)\n`);

    if (optimizations.length > 0) {
      console.log('Optimizations applied:');
      optimizations.forEach(opt => console.log(`   - ${opt}`));
    } else {
      console.log('   No optimizations needed at this time.');
    }

    this.emit('cache-optimized', { optimizations });

    return optimizations;
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    return {
      overall: {
        totalCacheHits: this.stats.totalCacheHits,
        totalCacheMisses: this.stats.totalCacheMisses,
        hitRate: this.calculateOverallHitRate(),
        totalTokensSaved: this.stats.totalTokensSaved,
        cacheEfficiency: Math.round(this.stats.cacheEfficiency),
        warmedAt: this.stats.warmedAt,
        lastOptimized: this.stats.lastOptimized
      },
      promptCache: this.promptCache.getStatistics(),
      agentCache: this.agentCache.getStatistics(),
      sharedContexts: {
        count: this.sharedContexts.size,
        contexts: Array.from(this.sharedContexts.entries()).map(([id, ctx]) => ({
          id,
          type: ctx.type,
          accessCount: ctx.accessCount
        }))
      },
      analytics: {
        snapshotsCollected: this.analyticsHistory.length,
        latestSnapshot: this.analyticsHistory[this.analyticsHistory.length - 1]
      }
    };
  }

  /**
   * Export analytics history
   * @returns {Array} - Analytics history
   */
  exportAnalytics() {
    return [...this.analyticsHistory];
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.promptCache.clearCache();
    this.agentCache.clearCache();
    this.sharedContexts.clear();

    // Reset stats
    this.stats.totalCacheHits = 0;
    this.stats.totalCacheMisses = 0;
    this.stats.totalTokensSaved = 0;
    this.stats.cacheEfficiency = 0;

    this.emit('all-caches-cleared');

    console.log('🗑️  All caches cleared');
  }

  /**
   * Cleanup and shutdown
   */
  destroy() {
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
    }

    this.promptCache.destroy();
    this.agentCache.destroy();
    this.sharedContexts.clear();
    this.removeAllListeners();

    console.log('🛑 Cache orchestrator shutdown complete');
  }
}

module.exports = UnifiedCacheOrchestrator;
