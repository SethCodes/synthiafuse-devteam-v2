/**
 * Intelligent Model Selector
 *
 * Routes tasks to optimal Claude model (Haiku/Sonnet/Opus) based on complexity
 * scoring to achieve 40-60% cost reduction while maintaining quality.
 *
 * Features:
 * - Complexity scoring (0-10 scale)
 * - Budget-aware model selection
 * - Learning from feedback
 * - Fallback and upgrade mechanisms
 * - Performance tracking and analytics
 *
 * Model Pricing (per M tokens):
 * - Haiku:  $0.25  (10x cheaper than Opus) - Simple tasks
 * - Sonnet: $3.00  (5x cheaper than Opus)  - Medium tasks
 * - Opus:   $15.00 (Most expensive)        - Complex tasks
 *
 * @module IntelligentModelSelector
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class IntelligentModelSelector extends EventEmitter {
  constructor(options = {}) {
    super();

    // Available models with metadata
    this.models = {
      haiku: {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        cost: 0.25,  // per M tokens (input)
        costOutput: 1.25,
        speed: 'fastest',
        capabilities: ['routing', 'formatting', 'simple_queries', 'status', 'matching'],
        maxComplexity: 2,
        tier: 1
      },
      sonnet: {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        cost: 3.0,
        costOutput: 15.0,
        speed: 'fast',
        capabilities: ['code_gen', 'debug', 'review', 'implementation', 'testing', 'refactoring'],
        maxComplexity: 7,
        tier: 2
      },
      opus: {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        cost: 15.0,
        costOutput: 75.0,
        speed: 'moderate',
        capabilities: ['architecture', 'security', 'complex_reasoning', 'critical_decisions', 'novel_problems'],
        maxComplexity: 10,
        tier: 3
      }
    };

    // Complexity weights for scoring
    this.complexityWeights = {
      // Factors that increase complexity
      requiresArchitecture: 5,
      criticalDecision: 4,
      securityCritical: 4,
      complianceRequired: 4,
      multiSystemIntegration: 3,
      complexAlgorithm: 3,
      largeRefactoring: 3,
      novelProblem: 3,
      requiresDeepReasoning: 3,
      crossDomainKnowledge: 2,
      performanceCritical: 2,
      dataIntensive: 2,

      // Factors that decrease complexity
      hasTemplate: -2,
      wellDocumented: -2,
      routineTask: -3,
      simpleQuery: -4,
      formattingOnly: -5,
      statusCheck: -4
    };

    // Usage tracking for learning
    this.usageTracking = {
      selections: [],
      accuracy: new Map(),
      corrections: [],
      modelPerformance: new Map()
    };

    // Historical complexity data for task types
    this.historicalComplexity = new Map();

    // Configuration
    this.config = {
      conservativeMode: options.conservativeMode || false, // Start with higher models
      learningEnabled: options.learningEnabled !== false,
      persistPath: options.persistPath || path.join(__dirname, 'model-selector-data.json')
    };

    // Load historical data if available
    this.loadHistoricalData().catch(() => {
      // Ignore load errors on first run
    });
  }

  /**
   * Select optimal model for a task
   * @param {Object} task - Task description and metadata
   * @param {Object} context - Additional context (budget level, cache availability)
   * @returns {Object} - Selected model with rationale and cost estimate
   */
  selectModel(task, context = {}) {
    // Score task complexity
    const complexity = this.scoreComplexity(task);

    // Consider budget constraints
    const budgetLevel = context.budgetLevel || 'standard';

    // Consider cache availability (cached = prefer same model as before)
    const cacheAvailable = context.cacheHitProbability || 0;

    // Make selection
    const model = this.makeSelection(complexity, budgetLevel, cacheAvailable, context);

    // Track selection for learning
    const selectionId = this.trackSelection(task, model, complexity);

    // Calculate cost estimate
    const costEstimate = this.estimateCost(task, model, context);

    // Select fallback model
    const fallback = this.selectFallback(model);

    const result = {
      model: model.id,
      modelName: model.name,
      tier: model.tier,
      complexity: complexity,
      rationale: this.explainSelection(complexity, model, budgetLevel),
      costEstimate: costEstimate,
      fallbackModel: fallback.id,
      selectionId: selectionId,
      confidence: this.calculateConfidence(task, model, complexity)
    };

    // Emit selection event
    this.emit('model-selected', result);

    return result;
  }

  /**
   * Score task complexity (0-10 scale)
   * @param {Object} task - Task to score
   * @returns {number} - Complexity score
   */
  scoreComplexity(task) {
    let score = 5; // Start at medium complexity

    // Analyze task characteristics
    for (const [factor, weight] of Object.entries(this.complexityWeights)) {
      if (this.taskHasCharacteristic(task, factor)) {
        score += weight;
      }
    }

    // Learn from history
    const historicalComplexity = this.getHistoricalComplexity(task.type);
    if (historicalComplexity !== null) {
      // Weighted average: 70% calculated, 30% historical
      score = (score * 0.7) + (historicalComplexity * 0.3);
    }

    // Adjust based on explicit hints
    if (task.complexityHint) {
      score = (score * 0.8) + (task.complexityHint * 0.2);
    }

    // Clamp to 0-10 range
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Check if task has a specific characteristic
   * @param {Object} task - Task to check
   * @param {string} characteristic - Characteristic to look for
   * @returns {boolean}
   */
  taskHasCharacteristic(task, characteristic) {
    // Check task metadata
    if (task.characteristics && task.characteristics.includes(characteristic)) {
      return true;
    }

    // Check task description for keywords
    const description = (task.description || task.task || '').toLowerCase();

    const keywordMap = {
      requiresArchitecture: ['architecture', 'system design', 'design system', 'structure'],
      criticalDecision: ['critical', 'important decision', 'crucial'],
      securityCritical: ['security', 'authentication', 'authorization', 'encrypt', 'secure'],
      complianceRequired: ['compliance', 'gdpr', 'hipaa', 'pci-dss', 'regulatory'],
      multiSystemIntegration: ['integration', 'multiple systems', 'api integration'],
      complexAlgorithm: ['algorithm', 'optimization', 'complex logic'],
      largeRefactoring: ['refactor', 'restructure', 'rewrite'],
      novelProblem: ['novel', 'new approach', 'innovative', 'never done'],
      requiresDeepReasoning: ['analyze', 'reason', 'deduce', 'infer'],
      hasTemplate: ['template', 'example', 'boilerplate'],
      wellDocumented: ['documented', 'documented code', 'clear docs'],
      routineTask: ['routine', 'standard', 'typical', 'normal'],
      simpleQuery: ['simple', 'quick', 'basic'],
      formattingOnly: ['format', 'formatting', 'prettify'],
      statusCheck: ['status', 'check status', 'get status']
    };

    const keywords = keywordMap[characteristic] || [];
    return keywords.some(keyword => description.includes(keyword));
  }

  /**
   * Make model selection based on complexity and context
   * @param {number} complexity - Complexity score
   * @param {string} budgetLevel - Budget level (standard, moderate, aggressive)
   * @param {number} cacheProb - Cache hit probability
   * @param {Object} context - Additional context
   * @returns {Object} - Selected model
   */
  makeSelection(complexity, budgetLevel, cacheProb, context) {
    // Budget-aware selection
    if (budgetLevel === 'aggressive') {
      // Use cheapest possible model
      if (complexity <= 3) return this.models.haiku;
      if (complexity <= 8) return this.models.sonnet;
      return this.models.opus; // Only for very critical
    }

    if (budgetLevel === 'moderate') {
      // Prefer cheaper models when possible
      if (complexity <= 2.5) return this.models.haiku;
      if (complexity <= 7.5) return this.models.sonnet;
      return this.models.opus;
    }

    // Standard selection (conservative mode if enabled)
    const adjustment = this.config.conservativeMode ? 1 : 0;

    if (complexity <= (2 + adjustment)) return this.models.haiku;
    if (complexity <= (7 + adjustment)) return this.models.sonnet;
    return this.models.opus;
  }

  /**
   * Calculate confidence in selection
   * @param {Object} task - Task
   * @param {Object} model - Selected model
   * @param {number} complexity - Complexity score
   * @returns {number} - Confidence (0-1)
   */
  calculateConfidence(task, model, complexity) {
    let confidence = 0.8; // Base confidence

    // Higher confidence if within model's optimal range
    const distance = Math.abs(complexity - (model.maxComplexity / 2));
    confidence -= (distance / 10) * 0.2;

    // Higher confidence if we have historical data
    const historicalComplexity = this.getHistoricalComplexity(task.type);
    if (historicalComplexity !== null) {
      confidence += 0.1;
    }

    // Higher confidence if model has good track record
    const accuracy = this.usageTracking.accuracy.get(model.id);
    if (accuracy) {
      const successRate = accuracy.correct / accuracy.total;
      confidence = (confidence * 0.7) + (successRate * 0.3);
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Explain why model was selected
   * @param {number} complexity - Complexity score
   * @param {Object} model - Selected model
   * @param {string} budgetLevel - Budget level
   * @returns {string} - Human-readable explanation
   */
  explainSelection(complexity, model, budgetLevel) {
    const reasons = [];

    reasons.push(`Complexity score: ${complexity.toFixed(1)}/10`);

    if (model.id.includes('haiku')) {
      reasons.push('Task is simple enough for Haiku (fastest, most cost-effective)');
    } else if (model.id.includes('sonnet')) {
      reasons.push('Task requires Sonnet for quality code generation/analysis');
    } else {
      reasons.push('Task complexity requires Opus for best results');
    }

    if (budgetLevel === 'aggressive') {
      reasons.push('Budget constraints: using most cost-effective option');
    } else if (budgetLevel === 'moderate') {
      reasons.push('Budget awareness: balancing cost and quality');
    }

    return reasons.join('. ');
  }

  /**
   * Estimate cost for task with selected model
   * @param {Object} task - Task
   * @param {Object} model - Selected model
   * @param {Object} context - Context with token estimates
   * @returns {Object} - Cost estimate
   */
  estimateCost(task, model, context) {
    const inputTokens = context.estimatedInputTokens || task.estimatedTokens || 5000;
    const outputTokens = context.estimatedOutputTokens || (inputTokens * 0.3); // Assume 30% output

    const inputCost = (inputTokens / 1000000) * model.cost;
    const outputCost = (outputTokens / 1000000) * model.costOutput;
    const totalCost = inputCost + outputCost;

    // Calculate savings vs other models
    const opusCost = (inputTokens / 1000000) * this.models.opus.cost +
                     (outputTokens / 1000000) * this.models.opus.costOutput;
    const savings = opusCost - totalCost;
    const savingsPercentage = (savings / opusCost) * 100;

    return {
      model: model.name,
      inputTokens,
      outputTokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: totalCost.toFixed(4),
      comparedToOpus: {
        savings: savings.toFixed(4),
        percentage: savingsPercentage.toFixed(1)
      }
    };
  }

  /**
   * Select fallback model if primary fails
   * @param {Object} model - Primary model
   * @returns {Object} - Fallback model
   */
  selectFallback(model) {
    // Upgrade to next tier
    if (model.tier === 1) return this.models.sonnet;
    if (model.tier === 2) return this.models.opus;
    return this.models.opus; // Opus has no fallback
  }

  /**
   * Track model selection for learning
   * @param {Object} task - Task
   * @param {Object} model - Selected model
   * @param {number} complexity - Complexity score
   * @returns {string} - Selection ID for feedback
   */
  trackSelection(task, model, complexity) {
    const selectionId = `sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.usageTracking.selections.push({
      id: selectionId,
      timestamp: Date.now(),
      taskType: task.type || 'unknown',
      taskDescription: task.description || task.task || '',
      model: model.id,
      complexity: complexity,
      outcome: null // Will be updated by feedback
    });

    // Keep last 1000 selections
    if (this.usageTracking.selections.length > 1000) {
      this.usageTracking.selections = this.usageTracking.selections.slice(-1000);
    }

    return selectionId;
  }

  /**
   * Receive feedback on model selection
   * @param {string} selectionId - Selection ID
   * @param {boolean} wasSuccessful - Whether task succeeded
   * @param {string} shouldHaveUsed - Model that should have been used (if different)
   * @param {Object} metrics - Performance metrics
   */
  async learnFromFeedback(selectionId, wasSuccessful, shouldHaveUsed = null, metrics = {}) {
    if (!this.config.learningEnabled) return;

    const selection = this.usageTracking.selections.find(s => s.id === selectionId);
    if (!selection) return;

    // Update selection outcome
    selection.outcome = {
      successful: wasSuccessful,
      shouldHaveUsed: shouldHaveUsed,
      metrics: metrics,
      timestamp: Date.now()
    };

    // Track accuracy
    const accuracy = this.usageTracking.accuracy.get(selection.model) || { correct: 0, total: 0 };
    accuracy.total++;
    if (wasSuccessful && !shouldHaveUsed) {
      accuracy.correct++;
    }
    this.usageTracking.accuracy.set(selection.model, accuracy);

    // If we underestimated complexity, record correction
    if (!wasSuccessful && shouldHaveUsed) {
      const shouldHaveUsedModel = Object.values(this.models).find(m => m.id === shouldHaveUsed);

      this.usageTracking.corrections.push({
        taskType: selection.taskType,
        selectedModel: selection.model,
        shouldHaveUsed: shouldHaveUsed,
        complexityScore: selection.complexity,
        adjustment: shouldHaveUsedModel ? shouldHaveUsedModel.tier - this.models[Object.keys(this.models).find(k => this.models[k].id === selection.model)].tier : 1
      });

      // Update historical complexity for this task type
      const currentHistorical = this.historicalComplexity.get(selection.taskType) || selection.complexity;
      const adjustment = shouldHaveUsedModel ? shouldHaveUsedModel.tier : 1;
      this.historicalComplexity.set(selection.taskType, currentHistorical + adjustment);

      console.log(`📚 Learning: ${selection.taskType} is more complex than estimated. Adjusting future selections.`);
    }

    // Track model performance
    const performance = this.usageTracking.modelPerformance.get(selection.model) || {
      totalTasks: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0
    };
    performance.totalTasks++;
    if (wasSuccessful) performance.successful++;
    else performance.failed++;
    if (metrics.responseTime) {
      performance.avgResponseTime = ((performance.avgResponseTime * (performance.totalTasks - 1)) + metrics.responseTime) / performance.totalTasks;
    }
    this.usageTracking.modelPerformance.set(selection.model, performance);

    // Persist learning data periodically
    if (this.usageTracking.selections.length % 10 === 0) {
      await this.saveHistoricalData();
    }

    // Emit learning event
    this.emit('learning-updated', {
      selectionId,
      wasSuccessful,
      taskType: selection.taskType,
      model: selection.model
    });
  }

  /**
   * Get historical complexity for task type
   * @param {string} taskType - Type of task
   * @returns {number|null} - Historical complexity or null
   */
  getHistoricalComplexity(taskType) {
    return this.historicalComplexity.get(taskType) || null;
  }

  /**
   * Update complexity model based on corrections
   * @param {string} taskType - Task type
   * @param {number} adjustment - Adjustment to apply
   */
  updateComplexityModel(taskType, adjustment) {
    const current = this.historicalComplexity.get(taskType) || 5;
    this.historicalComplexity.set(taskType, Math.max(0, Math.min(10, current + adjustment)));
  }

  /**
   * Get performance statistics
   * @returns {Object} - Performance stats
   */
  getStatistics() {
    const stats = {
      totalSelections: this.usageTracking.selections.length,
      modelAccuracy: {},
      modelPerformance: {},
      corrections: this.usageTracking.corrections.length,
      learningData: {
        taskTypes: this.historicalComplexity.size,
        avgCorrectionsPerType: this.usageTracking.corrections.length / Math.max(1, this.historicalComplexity.size)
      }
    };

    // Calculate accuracy per model
    for (const [model, accuracy] of this.usageTracking.accuracy.entries()) {
      stats.modelAccuracy[model] = {
        total: accuracy.total,
        correct: accuracy.correct,
        accuracy: accuracy.total > 0 ? (accuracy.correct / accuracy.total) * 100 : 0
      };
    }

    // Get performance per model
    for (const [model, perf] of this.usageTracking.modelPerformance.entries()) {
      stats.modelPerformance[model] = {
        ...perf,
        successRate: perf.totalTasks > 0 ? (perf.successful / perf.totalTasks) * 100 : 0
      };
    }

    return stats;
  }

  /**
   * Save historical data to file
   */
  async saveHistoricalData() {
    try {
      const data = {
        historicalComplexity: Array.from(this.historicalComplexity.entries()),
        corrections: this.usageTracking.corrections,
        accuracy: Array.from(this.usageTracking.accuracy.entries()),
        performance: Array.from(this.usageTracking.modelPerformance.entries()),
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(this.config.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save historical data:', error.message);
    }
  }

  /**
   * Load historical data from file
   */
  async loadHistoricalData() {
    try {
      const data = JSON.parse(await fs.readFile(this.config.persistPath, 'utf8'));

      this.historicalComplexity = new Map(data.historicalComplexity || []);
      this.usageTracking.corrections = data.corrections || [];
      this.usageTracking.accuracy = new Map(data.accuracy || []);
      this.usageTracking.modelPerformance = new Map(data.performance || []);

      console.log(`📚 Loaded historical data: ${this.historicalComplexity.size} task types`);
    } catch (error) {
      // Ignore - will start fresh
    }
  }

  /**
   * Reset learning data
   */
  resetLearning() {
    this.historicalComplexity.clear();
    this.usageTracking.corrections = [];
    this.usageTracking.accuracy.clear();
    this.usageTracking.modelPerformance.clear();
    console.log('🔄 Learning data reset');
  }
}

module.exports = IntelligentModelSelector;
