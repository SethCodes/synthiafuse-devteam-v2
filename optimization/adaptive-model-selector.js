/**
 * Adaptive Model Selection Refinement
 *
 * Enhanced learning system that continuously improves model selection accuracy
 * through pattern recognition, auto-tuning, and historical analysis.
 *
 * Enhancements over base IntelligentModelSelector:
 * - Pattern recognition for task types
 * - Auto-tuning of complexity scoring weights
 * - Historical performance analysis
 * - Confidence-based routing
 * - A/B testing integration
 * - Continuous learning from outcomes
 *
 * Expected Impact:
 * - Improved selection accuracy over time
 * - Reduced over/under-provisioning
 * - Better cost optimization
 * - Enhanced quality through learning
 *
 * @module AdaptiveModelSelector
 */

const IntelligentModelSelector = require('./model-selector');
const EventEmitter = require('events');

class AdaptiveModelSelector extends IntelligentModelSelector {
  constructor(options = {}) {
    super(options);

    // Enhanced learning configuration
    this.adaptiveConfig = {
      patternRecognitionEnabled: options.patternRecognitionEnabled !== false,
      autoTuningEnabled: options.autoTuningEnabled !== false,
      minSamplesForTuning: options.minSamplesForTuning || 20,
      tuningInterval: options.tuningInterval || 50, // Tune every 50 selections
      confidenceThreshold: options.confidenceThreshold || 0.7,
      explorationRate: options.explorationRate || 0.1 // 10% exploration
    };

    // Pattern recognition
    this.taskPatterns = new Map(); // taskType -> { patterns, performance }
    this.characteristicPatterns = new Map(); // characteristic -> impact on complexity

    // Auto-tuning state
    this.weightAdjustments = new Map(); // weight -> adjustment factor
    this.tuningHistory = [];
    this.selectionsSinceTuning = 0;

    // Confidence tracking
    this.confidenceScores = [];

    // Performance by task type
    this.taskTypePerformance = new Map();
  }

  /**
   * Select model with adaptive learning
   * @param {Object} task - Task to select model for
   * @param {Object} context - Context
   * @returns {Object} - Model selection with confidence
   */
  selectModel(task, context = {}) {
    // Check if we should explore (try different model)
    const shouldExplore = Math.random() < this.adaptiveConfig.explorationRate;

    if (shouldExplore && this.adaptiveConfig.patternRecognitionEnabled) {
      return this.exploratorySelection(task, context);
    }

    // Standard selection with enhanced scoring
    const baseSelection = super.selectModel(task, context);

    // Calculate confidence based on historical performance
    const confidence = this.calculateSelectionConfidence(task, baseSelection);

    // Check for auto-tuning
    this.selectionsSinceTuning++;
    if (this.shouldAutoTune()) {
      this.performAutoTuning();
    }

    return {
      ...baseSelection,
      confidence,
      adaptive: true,
      explorationMode: false
    };
  }

  /**
   * Exploratory selection (try different models occasionally)
   * @param {Object} task - Task
   * @param {Object} context - Context
   * @returns {Object} - Selection
   */
  exploratorySelection(task, context) {
    const baseSelection = super.selectModel(task, context);
    const baseComplexity = this.scoreComplexity(task);

    // Try model one tier different
    let exploratoryModel;
    if (baseComplexity < 3 && Math.random() < 0.5) {
      // Try higher tier
      exploratoryModel = this.models.sonnet;
    } else if (baseComplexity > 7 && Math.random() < 0.5) {
      // Try lower tier
      exploratoryModel = this.models.sonnet;
    } else {
      // Use base selection
      return {
        ...baseSelection,
        confidence: 0.5,
        explorationMode: false
      };
    }

    return {
      ...baseSelection,
      model: exploratoryModel,
      modelName: exploratoryModel.id.includes('haiku') ? 'haiku' :
                 exploratoryModel.id.includes('sonnet') ? 'sonnet' : 'opus',
      confidence: 0.5,
      explorationMode: true,
      rationale: `Exploratory selection: Testing ${exploratoryModel.name} for learning`
    };
  }

  /**
   * Learn from task outcome with enhanced pattern recognition
   * @param {string} selectionId - Selection ID
   * @param {boolean} wasSuccessful - Success status
   * @param {string} actualModelNeeded - Actual model that should have been used
   * @param {Object} metadata - Additional metadata
   */
  async learnFromFeedback(selectionId, wasSuccessful, actualModelNeeded = null, metadata = {}) {
    // Call parent learning
    await super.learnFromFeedback(selectionId, wasSuccessful, actualModelNeeded, metadata);

    const selection = this.usageTracking.selections.find(s => s.id === selectionId);
    if (!selection) return;

    // Enhanced learning: Pattern recognition
    if (this.adaptiveConfig.patternRecognitionEnabled) {
      this.updateTaskPatterns(selection, wasSuccessful, metadata);
    }

    // Update confidence scores
    this.updateConfidenceTracking(selection, wasSuccessful);

    // Update task type performance
    this.updateTaskTypePerformance(selection, wasSuccessful, metadata);
  }

  /**
   * Update task patterns based on outcomes
   * @param {Object} selection - Selection
   * @param {boolean} wasSuccessful - Success
   * @param {Object} metadata - Metadata
   */
  updateTaskPatterns(selection, wasSuccessful, metadata) {
    const taskType = selection.taskType || 'unknown';

    if (!this.taskPatterns.has(taskType)) {
      this.taskPatterns.set(taskType, {
        totalAttempts: 0,
        successful: 0,
        avgComplexity: 0,
        modelDistribution: {},
        commonCharacteristics: new Map()
      });
    }

    const pattern = this.taskPatterns.get(taskType);
    pattern.totalAttempts++;

    if (wasSuccessful) {
      pattern.successful++;
    }

    // Update average complexity
    pattern.avgComplexity =
      (pattern.avgComplexity * (pattern.totalAttempts - 1) + selection.complexity) /
      pattern.totalAttempts;

    // Update model distribution - extract model name from ID
    const modelId = selection.model;
    const modelName = modelId.includes('haiku') ? 'haiku' :
                      modelId.includes('sonnet') ? 'sonnet' :
                      modelId.includes('opus') ? 'opus' : 'unknown';

    pattern.modelDistribution[modelName] =
      (pattern.modelDistribution[modelName] || 0) + 1;

    // Track characteristics from metadata if provided
    if (metadata.characteristics) {
      for (const char of metadata.characteristics) {
        const count = pattern.commonCharacteristics.get(char) || 0;
        pattern.commonCharacteristics.set(char, count + 1);
      }
    }
  }

  /**
   * Update confidence tracking
   * @param {Object} selection - Selection
   * @param {boolean} wasSuccessful - Success
   */
  updateConfidenceTracking(selection, wasSuccessful) {
    // Create a minimal task object from selection data
    const task = {
      type: selection.taskType,
      description: selection.taskDescription
    };

    const confidence = this.calculateSelectionConfidence(task, selection);

    this.confidenceScores.push({
      confidence,
      wasSuccessful,
      complexity: selection.complexity,
      taskType: selection.taskType
    });

    // Keep only recent scores
    if (this.confidenceScores.length > 1000) {
      this.confidenceScores = this.confidenceScores.slice(-1000);
    }
  }

  /**
   * Update task type performance
   * @param {Object} selection - Selection
   * @param {boolean} wasSuccessful - Success
   * @param {Object} metadata - Metadata
   */
  updateTaskTypePerformance(selection, wasSuccessful, metadata) {
    const taskType = selection.taskType || 'unknown';

    if (!this.taskTypePerformance.has(taskType)) {
      this.taskTypePerformance.set(taskType, {
        total: 0,
        successful: 0,
        avgResponseTime: 0,
        avgQuality: 0
      });
    }

    const perf = this.taskTypePerformance.get(taskType);
    perf.total++;

    if (wasSuccessful) {
      perf.successful++;
    }

    // Update response time if provided
    if (metadata.responseTime) {
      perf.avgResponseTime =
        (perf.avgResponseTime * (perf.total - 1) + metadata.responseTime) /
        perf.total;
    }

    // Update quality if provided
    if (metadata.quality) {
      const qualityScore = metadata.quality === 'high' ? 1.0 :
                          metadata.quality === 'medium' ? 0.7 : 0.4;

      perf.avgQuality =
        (perf.avgQuality * (perf.total - 1) + qualityScore) /
        perf.total;
    }
  }

  /**
   * Calculate selection confidence based on historical data
   * @param {Object} task - Task
   * @param {Object} selection - Selection
   * @returns {number} - Confidence (0-1)
   */
  calculateSelectionConfidence(task, selection) {
    let confidence = 0.5; // Base confidence

    // Factor 1: Historical success for this task type
    const taskType = task.type || 'unknown';
    if (this.taskPatterns.has(taskType)) {
      const pattern = this.taskPatterns.get(taskType);
      const successRate = pattern.successful / pattern.totalAttempts;
      confidence += successRate * 0.3;
    }

    // Factor 2: Model accuracy for this complexity range
    const complexity = selection.complexity || this.scoreComplexity(task);
    const modelStats = this.usageTracking?.modelPerformance?.get(selection.modelName);

    if (modelStats && modelStats.totalTasks > 10) {
      confidence += (modelStats.successfulTasks / modelStats.totalTasks) * 0.3;
    }

    // Factor 3: Complexity match to model tier
    const modelTier = this.models[selection.modelName]?.tier || 2;
    const expectedTier = complexity <= 2 ? 1 : complexity <= 7 ? 2 : 3;

    if (modelTier === expectedTier) {
      confidence += 0.2;
    } else if (Math.abs(modelTier - expectedTier) === 1) {
      confidence += 0.1;
    }

    // Factor 4: Number of similar tasks seen
    if (this.taskPatterns.has(taskType)) {
      const pattern = this.taskPatterns.get(taskType);
      if (pattern.totalAttempts > 50) {
        confidence += 0.2;
      } else if (pattern.totalAttempts > 20) {
        confidence += 0.1;
      }
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Check if auto-tuning should be performed
   * @returns {boolean} - Should tune
   */
  shouldAutoTune() {
    if (!this.adaptiveConfig.autoTuningEnabled) return false;

    return this.selectionsSinceTuning >= this.adaptiveConfig.tuningInterval &&
           this.usageTracking.selections.length >= this.adaptiveConfig.minSamplesForTuning;
  }

  /**
   * Perform auto-tuning of complexity weights
   */
  performAutoTuning() {
    console.log('\n⚙️  Performing auto-tuning of complexity weights...');

    const adjustments = {};

    // Analyze which characteristics are over/under-weighted
    for (const [taskType, pattern] of this.taskPatterns.entries()) {
      if (pattern.totalAttempts < 10) continue;

      const successRate = pattern.successful / pattern.totalAttempts;

      // If success rate is low, analyze what might be wrong
      if (successRate < 0.7) {
        // Tasks are being under-provisioned
        for (const [char, count] of pattern.commonCharacteristics.entries()) {
          if (count / pattern.totalAttempts > 0.5) {
            // This characteristic appears in >50% of failed tasks
            adjustments[char] = (adjustments[char] || 1.0) * 1.1;
          }
        }
      } else if (successRate > 0.95) {
        // Tasks might be over-provisioned
        for (const [char, count] of pattern.commonCharacteristics.entries()) {
          if (count / pattern.totalAttempts > 0.5) {
            adjustments[char] = (adjustments[char] || 1.0) * 0.95;
          }
        }
      }
    }

    // Apply adjustments
    for (const [char, adjustment] of Object.entries(adjustments)) {
      if (this.complexityWeights[char]) {
        const oldWeight = this.complexityWeights[char];
        const newWeight = Math.round(oldWeight * adjustment);

        if (newWeight !== oldWeight) {
          console.log(`   Adjusted "${char}": ${oldWeight} → ${newWeight}`);
          this.complexityWeights[char] = newWeight;
          this.weightAdjustments.set(char, adjustment);
        }
      }
    }

    // Record tuning
    this.tuningHistory.push({
      timestamp: Date.now(),
      selectionsAnalyzed: this.usageTracking.selections.length,
      adjustments: Object.keys(adjustments).length
    });

    this.selectionsSinceTuning = 0;

    console.log(`✅ Auto-tuning complete (${Object.keys(adjustments).length} adjustments)\n`);

    this.emit('auto-tuned', {
      adjustments: Object.keys(adjustments).length,
      totalSelections: this.usageTracking.selections.length
    });
  }

  /**
   * Get pattern insights
   * @returns {Object} - Pattern insights
   */
  getPatternInsights() {
    const insights = {
      taskPatterns: {},
      characteristicImpacts: {},
      modelRecommendations: {}
    };

    // Task patterns
    for (const [taskType, pattern] of this.taskPatterns.entries()) {
      if (pattern.totalAttempts < 5) continue;

      insights.taskPatterns[taskType] = {
        successRate: (pattern.successful / pattern.totalAttempts * 100).toFixed(1) + '%',
        avgComplexity: pattern.avgComplexity.toFixed(1),
        mostUsedModel: this.getMostUsedModel(pattern.modelDistribution),
        sampleSize: pattern.totalAttempts
      };
    }

    // Characteristic impacts
    for (const [char, weight] of Object.entries(this.complexityWeights)) {
      const adjustment = this.weightAdjustments.get(char);

      insights.characteristicImpacts[char] = {
        currentWeight: weight,
        adjustment: adjustment ? `${((adjustment - 1) * 100).toFixed(1)}%` : '0%',
        impact: weight > 3 ? 'high' : weight > 1 ? 'medium' : 'low'
      };
    }

    // Model recommendations
    for (const [taskType, perf] of this.taskTypePerformance.entries()) {
      if (perf.total < 10) continue;

      const pattern = this.taskPatterns.get(taskType);
      if (!pattern) continue;

      insights.modelRecommendations[taskType] = {
        recommendedModel: this.getMostUsedModel(pattern.modelDistribution),
        successRate: (perf.successful / perf.total * 100).toFixed(1) + '%',
        avgResponseTime: perf.avgResponseTime ? `${Math.round(perf.avgResponseTime)}ms` : 'N/A',
        avgQuality: (perf.avgQuality * 100).toFixed(1) + '%'
      };
    }

    return insights;
  }

  /**
   * Get most used model from distribution
   * @param {Object} distribution - Model distribution
   * @returns {string} - Most used model
   */
  getMostUsedModel(distribution) {
    let maxCount = 0;
    let mostUsed = 'unknown';

    for (const [model, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsed = model;
      }
    }

    return mostUsed;
  }

  /**
   * Get enhanced statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const baseStats = super.getStatistics();

    return {
      ...baseStats,
      adaptive: {
        patternRecognitionEnabled: this.adaptiveConfig.patternRecognitionEnabled,
        autoTuningEnabled: this.adaptiveConfig.autoTuningEnabled,
        taskPatternsLearned: this.taskPatterns.size,
        tuningsPerformed: this.tuningHistory.length,
        avgConfidence: this.getAverageConfidence(),
        explorationRate: this.adaptiveConfig.explorationRate * 100 + '%'
      },
      insights: this.getPatternInsights()
    };
  }

  /**
   * Get average confidence across recent selections
   * @returns {number} - Average confidence
   */
  getAverageConfidence() {
    if (this.confidenceScores.length === 0) return 0;

    const recentScores = this.confidenceScores.slice(-100);
    const sum = recentScores.reduce((acc, s) => acc + s.confidence, 0);

    return sum / recentScores.length;
  }
}

module.exports = AdaptiveModelSelector;
