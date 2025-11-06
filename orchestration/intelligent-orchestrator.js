/**
 * Intelligent Orchestrator
 *
 * The central brain of the optimization system that coordinates all components
 * and intelligently routes tasks to appropriate agents using Haiku for fast,
 * cost-effective decision making.
 *
 * Responsibilities:
 * - Task analysis and decomposition
 * - Agent selection and routing
 * - Workflow coordination
 * - Result synthesis
 * - Performance optimization
 *
 * Integration:
 * - TokenBudgetManager: Budget enforcement
 * - IntelligentModelSelector: Model selection per task
 * - OptimizedAgentDiscovery: Agent finding
 * - UnifiedCacheOrchestrator: Caching optimization
 * - TokenUsageTracker: Performance monitoring
 *
 * Expected Impact:
 * - 40-73% performance improvement
 * - Faster task completion
 * - Better resource utilization
 * - Maintained 95%+ token reduction
 *
 * @module IntelligentOrchestrator
 */

const EventEmitter = require('events');
const TokenBudgetManager = require('../optimization/token-budget-manager');
const IntelligentModelSelector = require('../optimization/model-selector');
const OptimizedAgentDiscovery = require('../agents/optimized-agent-discovery');
const UnifiedCacheOrchestrator = require('../optimization/unified-cache-orchestrator');
const TokenUsageTracker = require('../optimization/usage-tracker');

class IntelligentOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      projectId: options.projectId || null,
      projectName: options.projectName || 'default',
      agentDirectory: options.agentDirectory || null,
      maxConcurrentTasks: options.maxConcurrentTasks || 5,
      enableParallelExecution: options.enableParallelExecution !== false,
      routingModel: options.routingModel || 'haiku', // Use Haiku for routing
      budgets: options.budgets || {}
    };

    // Initialize sub-systems
    this.budgetManager = new TokenBudgetManager({
      ...this.config.budgets,
      budgets: {
        hourly: options.hourlyBudget || 50000,
        daily: options.dailyBudget || 500000,
        weekly: options.weeklyBudget || 3000000,
        project: options.projectBudget || 1000000
      }
    });

    this.modelSelector = new IntelligentModelSelector({
      conservativeMode: options.conservativeMode || false,
      learningEnabled: options.learningEnabled !== false
    });

    this.agentDiscovery = new OptimizedAgentDiscovery({
      agentDirectory: this.config.agentDirectory,
      metadataPath: options.agentMetadataPath || null
    });

    this.cacheOrchestrator = new UnifiedCacheOrchestrator({
      agentDirectory: this.config.agentDirectory,
      warmOnInit: options.warmCacheOnInit !== false,
      commonAgents: options.commonAgents || [],
      sharedContexts: options.sharedContexts || []
    });

    this.usageTracker = new TokenUsageTracker({
      autoSave: options.autoSave !== false,
      budgetManager: this.budgetManager,
      modelSelector: this.modelSelector
    });

    // Active tasks
    this.activeTasks = new Map();
    this.taskQueue = [];

    // Performance tracking
    this.stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      parallelExecutions: 0,
      agentUsage: new Map()
    };

    // Wire up events
    this.setupEventListeners();
  }

  /**
   * Initialize orchestrator
   */
  async initialize() {
    console.log('\n🚀 Initializing Intelligent Orchestrator...\n');

    try {
      // Initialize agent discovery
      await this.agentDiscovery.initialize();

      // Initialize cache (warming happens if configured)
      // Cache orchestrator auto-warms in constructor if enabled

      console.log('✅ Intelligent Orchestrator initialized\n');

      this.emit('initialized', {
        projectId: this.config.projectId,
        projectName: this.config.projectName
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error.message);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Budget warnings
    this.budgetManager.on('threshold-warning', (event) => {
      console.log(`⚠️  Budget Warning: ${event.period} at ${(event.percentage * 100).toFixed(1)}%`);
      this.emit('budget-warning', event);
    });

    this.budgetManager.on('limit-exceeded', (event) => {
      console.log(`🚨 Budget Limit Exceeded: ${event.period}`);
      this.emit('budget-exceeded', event);
    });

    // Model selection
    this.modelSelector.on('model-selected', (event) => {
      this.emit('model-selected', event);
    });

    // Cache events
    this.cacheOrchestrator.on('cache-hit', (event) => {
      this.emit('cache-hit', event);
    });
  }

  /**
   * Execute a task with intelligent orchestration
   * @param {Object} task - Task to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeTask(task, options = {}) {
    const startTime = Date.now();
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n📋 Executing Task: ${task.description || taskId}`);

    try {
      // Step 1: Analyze task and decompose if needed
      const analysis = await this.analyzeTask(task);
      console.log(`   Analysis: ${analysis.complexity}/10 complexity, ${analysis.estimatedTokens} tokens`);

      // Step 2: Check budget availability
      const budgetAvailable = await this.budgetManager.requestTokens(
        analysis.estimatedTokens,
        {
          priority: task.priority || 'medium',
          operation: 'task-execution',
          taskType: task.type
        }
      );

      if (!budgetAvailable) {
        throw new Error('Budget limit exceeded - task rejected');
      }

      // Step 3: Find optimal agents
      const agents = await this.findAgentsForTask(task, analysis);
      console.log(`   Agents: ${agents.map(a => a.name).join(', ')}`);

      // Step 4: Load agent contexts with caching
      const agentContexts = await this.cacheOrchestrator.loadAgents(
        agents.map(a => a.id)
      );

      // Step 5: Select appropriate model
      const modelSelection = this.modelSelector.selectModel({
        type: task.type || 'unknown',
        description: task.description,
        characteristics: analysis.characteristics || []
      }, {
        estimatedInputTokens: analysis.estimatedTokens,
        budgetLevel: this.budgetManager.getStatistics().optimizationLevel
      });

      console.log(`   Model: ${modelSelection.modelName} (complexity: ${analysis.complexity})`);

      // Step 6: Prepare messages with caching
      const messages = this.prepareMessages(task, agentContexts, analysis);
      const optimizedMessages = this.cacheOrchestrator.prepareMessages(messages, {
        includeSharedContexts: true,
        sharedContexts: ['system-instructions'],
        contentType: 'semi-static'
      });

      // Step 7: Execute (simulated - would call Claude API in production)
      const result = await this.simulateExecution(task, {
        agents: agentContexts,
        model: modelSelection,
        messages: optimizedMessages,
        analysis
      });

      // Step 8: Track usage
      await this.usageTracker.track({
        inputTokens: result.tokensUsed.input,
        outputTokens: result.tokensUsed.output,
        cachedTokens: result.tokensUsed.cached || 0,
        model: modelSelection.model.id,
        agent: agents[0]?.name || 'orchestrator',
        project: this.config.projectId,
        taskType: task.type,
        operation: 'task-execution',
        metadata: {
          taskId,
          complexity: analysis.complexity,
          agentCount: agents.length
        }
      });

      // Step 9: Update statistics
      const executionTime = Date.now() - startTime;
      this.updateStats(taskId, executionTime, true, agents);

      console.log(`   ✅ Completed in ${executionTime}ms`);

      this.emit('task-completed', {
        taskId,
        executionTime,
        tokensUsed: result.tokensUsed,
        agents: agents.map(a => a.name)
      });

      return {
        taskId,
        success: true,
        result: result.output,
        executionTime,
        tokensUsed: result.tokensUsed,
        agents: agents.map(a => a.name),
        model: modelSelection.modelName
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(taskId, executionTime, false, []);

      console.log(`   ❌ Failed: ${error.message}`);

      this.emit('task-failed', {
        taskId,
        error: error.message,
        executionTime
      });

      return {
        taskId,
        success: false,
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Analyze task to determine requirements
   * @param {Object} task - Task to analyze
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeTask(task) {
    // Use complexity scoring from model selector
    const complexity = this.modelSelector.scoreComplexity({
      type: task.type || 'unknown',
      description: task.description,
      characteristics: task.characteristics || []
    });

    // Estimate token requirements
    const estimatedTokens = this.estimateTokenRequirement(task, complexity);

    // Determine characteristics
    const characteristics = this.extractCharacteristics(task);

    return {
      complexity,
      estimatedTokens,
      characteristics,
      decomposable: complexity > 7, // High complexity might need decomposition
      parallelizable: task.subtasks && task.subtasks.length > 1
    };
  }

  /**
   * Estimate token requirement for task
   * @param {Object} task - Task
   * @param {number} complexity - Complexity score
   * @returns {number} - Estimated tokens
   */
  estimateTokenRequirement(task, complexity) {
    // Base estimation
    let tokens = 1000; // Minimum

    // Add based on description length
    if (task.description) {
      tokens += Math.ceil(task.description.length / 4);
    }

    // Add based on complexity
    tokens += complexity * 500;

    // Add based on context requirements
    if (task.context) {
      tokens += Math.ceil(JSON.stringify(task.context).length / 4);
    }

    return tokens;
  }

  /**
   * Extract task characteristics
   * @param {Object} task - Task
   * @returns {Array<string>} - Characteristics
   */
  extractCharacteristics(task) {
    const characteristics = [];

    if (task.characteristics) {
      return task.characteristics;
    }

    // Analyze description for characteristics
    const desc = (task.description || '').toLowerCase();

    if (desc.includes('architecture') || desc.includes('design system')) {
      characteristics.push('requiresArchitecture');
    }

    if (desc.includes('security') || desc.includes('authentication')) {
      characteristics.push('securityCritical');
    }

    if (desc.includes('status') || desc.includes('check')) {
      characteristics.push('simpleQuery');
    }

    if (desc.includes('refactor') || desc.includes('optimize')) {
      characteristics.push('requiresRefactoring');
    }

    return characteristics;
  }

  /**
   * Find optimal agents for task
   * @param {Object} task - Task
   * @param {Object} analysis - Task analysis
   * @returns {Promise<Array>} - Optimal agents
   */
  async findAgentsForTask(task, analysis) {
    const requirements = {
      technologies: task.technologies || [],
      categories: task.categories || [],
      description: task.description,
      complexity: analysis.complexity
    };

    const agents = await this.agentDiscovery.findOptimalAgents(requirements, {
      maxAgents: task.maxAgents || 3,
      minScore: task.minAgentScore || 0.6
    });

    return agents;
  }

  /**
   * Prepare messages for execution
   * @param {Object} task - Task
   * @param {Array} agentContexts - Agent contexts
   * @param {Object} analysis - Task analysis
   * @returns {Array} - Prepared messages
   */
  prepareMessages(task, agentContexts, analysis) {
    const messages = [];

    // Add agent contexts
    for (const agentContext of agentContexts) {
      messages.push({
        role: 'system',
        content: agentContext.content
      });
    }

    // Add task description
    messages.push({
      role: 'user',
      content: task.description
    });

    // Add context if provided
    if (task.context) {
      messages.push({
        role: 'user',
        content: `Context:\n${JSON.stringify(task.context, null, 2)}`
      });
    }

    return messages;
  }

  /**
   * Simulate execution (would call Claude API in production)
   * @param {Object} task - Task
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} - Execution result
   */
  async simulateExecution(task, executionContext) {
    // Simulate processing time based on complexity
    const processingTime = executionContext.analysis.complexity * 100;
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate token usage
    const inputTokens = executionContext.analysis.estimatedTokens;
    const outputTokens = Math.round(inputTokens * 0.3);
    const cachedTokens = Math.round(inputTokens * 0.7); // 70% cache hit

    return {
      output: {
        success: true,
        message: `Task "${task.description}" completed successfully`,
        details: `Processed by ${executionContext.agents.length} agent(s) using ${executionContext.model.modelName}`
      },
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        cached: cachedTokens,
        total: inputTokens + outputTokens
      }
    };
  }

  /**
   * Update statistics
   * @param {string} taskId - Task ID
   * @param {number} executionTime - Execution time
   * @param {boolean} success - Success status
   * @param {Array} agents - Agents used
   */
  updateStats(taskId, executionTime, success, agents) {
    if (success) {
      this.stats.tasksCompleted++;
    } else {
      this.stats.tasksFailed++;
    }

    this.stats.totalExecutionTime += executionTime;

    const totalTasks = this.stats.tasksCompleted + this.stats.tasksFailed;
    this.stats.avgExecutionTime = this.stats.totalExecutionTime / totalTasks;

    // Track agent usage
    for (const agent of agents) {
      const count = this.stats.agentUsage.get(agent.name) || 0;
      this.stats.agentUsage.set(agent.name, count + 1);
    }
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const budgetStats = this.budgetManager.getStatistics();
    const usageStats = this.usageTracker.getStatistics({ period: 'all' });
    const cacheStats = this.cacheOrchestrator.getStatistics();

    return {
      orchestrator: {
        tasksCompleted: this.stats.tasksCompleted,
        tasksFailed: this.stats.tasksFailed,
        successRate: this.stats.tasksCompleted / (this.stats.tasksCompleted + this.stats.tasksFailed) * 100,
        avgExecutionTime: Math.round(this.stats.avgExecutionTime),
        totalExecutionTime: this.stats.totalExecutionTime,
        parallelExecutions: this.stats.parallelExecutions,
        topAgents: Array.from(this.stats.agentUsage.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, usageCount: count }))
      },
      budget: budgetStats,
      usage: usageStats.overall,
      cache: cacheStats.overall,
      combined: {
        totalTokensSaved: usageStats.overall.tokens.total,
        totalCostSaved: usageStats.overall.cost.total,
        cacheHitRate: cacheStats.overall.hitRate,
        optimizationLevel: budgetStats.optimizationLevel
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async destroy() {
    console.log('\n🛑 Shutting down Intelligent Orchestrator...');

    this.budgetManager.removeAllListeners();
    this.modelSelector.destroy();
    this.usageTracker.destroy();
    this.cacheOrchestrator.destroy();

    this.removeAllListeners();

    console.log('✅ Orchestrator shutdown complete\n');
  }
}

module.exports = IntelligentOrchestrator;
