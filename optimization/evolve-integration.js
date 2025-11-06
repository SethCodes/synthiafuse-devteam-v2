/**
 * Evolve Dev Team - V2 Optimization Integration
 *
 * Integrates SynthiaFuse V2 optimization layer with Evolve Dev Team project.
 * Provides unified interface for token-optimized AI operations with knowledge base integration.
 *
 * Features:
 * - Token budget management with Evolve-specific limits
 * - Intelligent model selection for ticket workflows
 * - Knowledge base context loading with caching
 * - MongoDB integration for learning and tracking
 * - Performance metrics and AB testing support
 *
 * @module EvolveIntegration
 */

const TokenBudgetManager = require('./token-budget-manager');
const IntelligentModelSelector = require('./model-selector');
const TokenUsageTracker = require('./usage-tracker');
const CacheManager = require('./cache-manager');
const { MongoClient } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');

class EvolveIntegration {
  constructor(options = {}) {
    this.config = {
      mongoUri: options.mongoUri || process.env.MONGODB_URI,
      claudeApiKey: options.claudeApiKey || process.env.CLAUDE_API_KEY,
      budgets: {
        hourly: options.hourlyBudget || 50000,
        daily: options.dailyBudget || 500000,
        weekly: options.weeklyBudget || 3000000
      },
      company: options.company || 'evolve',
      instance: options.instance || 'v2', // v1 or v2 for AB testing
      ...options
    };

    // Initialize optimization components
    this.budgetManager = new TokenBudgetManager({
      hourlyBudget: this.config.budgets.hourly,
      dailyBudget: this.config.budgets.daily,
      weeklyBudget: this.config.budgets.weekly
    });

    this.modelSelector = new IntelligentModelSelector({
      defaultBudgetLevel: 'standard'
    });

    this.usageTracker = new TokenUsageTracker({
      budgetManager: this.budgetManager,
      modelSelector: this.modelSelector
    });

    this.cacheManager = new CacheManager({
      maxSize: 100 * 1024 * 1024, // 100MB
      ttl: 3600000 // 1 hour
    });

    // Anthropic client
    this.anthropic = new Anthropic({
      apiKey: this.config.claudeApiKey
    });

    // MongoDB connection (lazy initialization)
    this.mongoClient = null;
    this.db = null;

    // Statistics
    this.stats = {
      startTime: Date.now(),
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0
      },
      tokens: {
        total: 0,
        saved: 0,
        cached: 0
      },
      cost: {
        total: 0,
        saved: 0
      }
    };
  }

  /**
   * Initialize MongoDB connection
   */
  async connectMongoDB() {
    if (this.mongoClient) return;

    try {
      this.mongoClient = new MongoClient(this.config.mongoUri);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('admin');
      console.log('✅ Connected to MongoDB (Evolve Dev Team)');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Load knowledge base context for a task
   * @param {Object} taskContext - Task context (game, technologies, patterns)
   * @returns {Promise<Array>} Relevant knowledge objects
   */
  async loadKnowledgeContext(taskContext) {
    await this.connectMongoDB();

    const cacheKey = `kb_context_${JSON.stringify(taskContext)}`;

    // Check cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.stats.operations.cached++;
      return cached;
    }

    try {
      const KnowledgeObject = this.db.collection('knowledgeobjects');

      // Build query based on context
      const query = {
        company: this.config.company,
        approvalStatus: 'approved',
        $or: []
      };

      if (taskContext.technologies && taskContext.technologies.length > 0) {
        query.$or.push({ 'knowledge.technologies': { $in: taskContext.technologies } });
      }

      if (taskContext.patterns && taskContext.patterns.length > 0) {
        query.$or.push({ 'knowledge.keyPatterns': { $in: taskContext.patterns } });
      }

      if (taskContext.game) {
        query.$or.push({ 'relatedGames.game': taskContext.game });
      }

      if (taskContext.system) {
        query.$or.push({ 'relatedSystems.system': taskContext.system });
      }

      if (query.$or.length === 0) {
        delete query.$or;
      }

      const knowledgeItems = await KnowledgeObject
        .find(query)
        .sort({ 'usage.effectiveness': -1, criticality: -1 })
        .limit(15)
        .toArray();

      // Transform for context
      const contextData = knowledgeItems.map(k => ({
        name: k.name,
        type: k.type,
        category: k.category,
        description: k.knowledge.description,
        keyPatterns: k.knowledge.keyPatterns || [],
        codePatterns: (k.codePatterns || []).slice(0, 2),
        solutions: (k.solutions || []).filter(s => s.successRate > 80).slice(0, 2),
        criticality: k.criticality
      }));

      // Cache the result
      await this.cacheManager.set(cacheKey, contextData);

      return contextData;
    } catch (error) {
      console.error('❌ Knowledge context loading failed:', error.message);
      return [];
    }
  }

  /**
   * Execute optimized Claude API call
   * @param {Object} request - API request parameters
   * @returns {Promise<Object>} API response with optimization metadata
   */
  async optimizedCall(request) {
    this.stats.operations.total++;

    try {
      // Extract task details
      const task = {
        description: request.task || request.prompt || 'Unknown task',
        context: request.context || {},
        requiresCode: request.requiresCode || false,
        requiresArchitecture: request.requiresArchitecture || false,
        criticalDecision: request.criticalDecision || false,
        agent: request.agent || 'unknown'
      };

      // Select optimal model
      const modelSelection = await this.modelSelector.selectModel(task);
      const selectedModel = modelSelection.model;

      console.log(`🎯 Model selected: ${selectedModel.name} (complexity: ${modelSelection.complexityScore}/10)`);

      // Estimate token usage
      const estimatedTokens = this.estimateTokens(request);

      // Request budget approval
      const budgetApproval = await this.budgetManager.requestTokens(estimatedTokens, {
        task: task.description,
        model: selectedModel.id,
        agent: task.agent,
        project: request.project
      });

      if (!budgetApproval.allowed) {
        throw new Error(`Budget limit reached: ${budgetApproval.reason}`);
      }

      // Prepare messages with caching
      const messages = this.prepareCachedMessages(request, modelSelection);

      // Make API call
      const startTime = Date.now();
      const response = await this.anthropic.messages.create({
        model: selectedModel.id,
        max_tokens: request.maxTokens || 4096,
        messages: messages,
        temperature: request.temperature || 1.0,
        system: request.system || undefined
      });

      const duration = Date.now() - startTime;

      // Track usage
      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedTokens: response.usage.cache_read_input_tokens || 0,
        model: selectedModel.id,
        agent: task.agent,
        project: request.project,
        taskType: task.description.substring(0, 50),
        operation: 'optimized_call',
        metadata: {
          complexity: modelSelection.complexityScore,
          duration,
          cacheHit: (response.usage.cache_read_input_tokens || 0) > 0
        }
      };

      await this.usageTracker.track(usage);
      await this.budgetManager.recordUsage(usage.inputTokens + usage.outputTokens, {
        project: request.project
      });

      // Update stats
      this.stats.operations.successful++;
      this.stats.tokens.total += usage.inputTokens + usage.outputTokens;
      this.stats.tokens.cached += usage.cachedTokens;

      const cost = this.calculateCost(usage);
      this.stats.cost.total += cost;

      // Calculate savings
      if (modelSelection.originalModel && modelSelection.originalModel !== selectedModel.id) {
        const originalCost = this.calculateCostForModel(usage, modelSelection.originalModel);
        const saved = originalCost - cost;
        this.stats.cost.saved += saved;
      }

      console.log(`✅ Call completed: ${usage.inputTokens + usage.outputTokens} tokens, $${cost.toFixed(4)}, ${duration}ms`);

      return {
        content: response.content,
        usage: usage,
        model: selectedModel.id,
        optimization: {
          selectedModel: selectedModel.name,
          complexity: modelSelection.complexityScore,
          reasoning: modelSelection.reasoning,
          budgetLevel: budgetApproval.optimizationLevel,
          cached: usage.cachedTokens > 0,
          cost: cost,
          duration: duration
        },
        response: response
      };

    } catch (error) {
      this.stats.operations.failed++;
      console.error('❌ Optimized call failed:', error.message);
      throw error;
    }
  }

  /**
   * Prepare messages with cache control headers
   */
  prepareCachedMessages(request, modelSelection) {
    const messages = [];

    // If there's static context (knowledge base, system docs), mark as cacheable
    if (request.knowledgeContext) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `# Knowledge Base Context\n\n${JSON.stringify(request.knowledgeContext, null, 2)}`,
            cache_control: { type: 'ephemeral' } // Cache this!
          }
        ]
      });
    }

    // Add the actual task/prompt
    if (request.messages) {
      messages.push(...request.messages);
    } else if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    return messages;
  }

  /**
   * Estimate token count for a request
   */
  estimateTokens(request) {
    // Rough estimation: 1 token ≈ 4 characters
    let text = '';

    if (request.prompt) text += request.prompt;
    if (request.system) text += request.system;
    if (request.context) text += JSON.stringify(request.context);
    if (request.knowledgeContext) text += JSON.stringify(request.knowledgeContext);

    const inputEstimate = Math.ceil(text.length / 4);
    const outputEstimate = request.maxTokens || 4096;

    return inputEstimate + outputEstimate;
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(usage) {
    const modelId = usage.model;
    let modelConfig;

    if (modelId.includes('haiku')) {
      modelConfig = { input: 0.25, output: 1.25 };
    } else if (modelId.includes('sonnet')) {
      modelConfig = { input: 3.0, output: 15.0 };
    } else if (modelId.includes('opus')) {
      modelConfig = { input: 15.0, output: 75.0 };
    } else {
      modelConfig = { input: 3.0, output: 15.0 }; // Default to Sonnet
    }

    const inputCost = (usage.inputTokens - usage.cachedTokens) * modelConfig.input / 1000000;
    const cachedCost = usage.cachedTokens * modelConfig.input * 0.1 / 1000000; // 90% discount on cached
    const outputCost = usage.outputTokens * modelConfig.output / 1000000;

    return inputCost + cachedCost + outputCost;
  }

  /**
   * Calculate cost for a different model (for savings calculation)
   */
  calculateCostForModel(usage, modelId) {
    const tempUsage = { ...usage, model: modelId };
    return this.calculateCost(tempUsage);
  }

  /**
   * Get current statistics
   */
  getStats() {
    const runtime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      runtime: {
        milliseconds: runtime,
        minutes: Math.floor(runtime / 60000),
        formatted: this.formatDuration(runtime)
      },
      efficiency: {
        successRate: this.stats.operations.total > 0
          ? (this.stats.operations.successful / this.stats.operations.total * 100).toFixed(2) + '%'
          : 'N/A',
        cacheHitRate: this.stats.operations.total > 0
          ? (this.stats.operations.cached / this.stats.operations.total * 100).toFixed(2) + '%'
          : 'N/A',
        avgCostPerOperation: this.stats.operations.successful > 0
          ? '$' + (this.stats.cost.total / this.stats.operations.successful).toFixed(4)
          : 'N/A',
        totalSavings: '$' + this.stats.cost.saved.toFixed(4),
        tokensSavedPercent: this.stats.tokens.total > 0
          ? ((this.stats.tokens.saved + this.stats.tokens.cached) / this.stats.tokens.total * 100).toFixed(2) + '%'
          : 'N/A'
      },
      budgetStatus: this.budgetManager.getStatistics(),
      instance: this.config.instance
    };
  }

  /**
   * Format duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Store metrics to MongoDB evolve collection
   */
  async storeMetrics(sessionId, metrics) {
    await this.connectMongoDB();

    try {
      const collection = this.db.collection('evolve');
      await collection.insertOne({
        sessionId,
        instance: this.config.instance,
        timestamp: new Date(),
        metrics,
        company: this.config.company,
        type: 'optimization_metrics'
      });

      console.log(`📊 Metrics stored to evolve collection: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to store metrics:', error.message);
    }
  }

  /**
   * Close connections
   */
  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }

    // Save final stats
    await this.usageTracker.saveData();

    console.log('✅ Evolve integration closed gracefully');
  }
}

module.exports = EvolveIntegration;
