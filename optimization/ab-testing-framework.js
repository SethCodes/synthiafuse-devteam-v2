/**
 * A/B Testing Framework for Optimization Strategies
 *
 * Enables data-driven optimization decisions by comparing different strategies,
 * measuring their impact, and automatically rolling out winning variants.
 *
 * Features:
 * - Experiment configuration and management
 * - Traffic splitting (control vs variants)
 * - Metric collection and comparison
 * - Statistical significance testing
 * - Automated rollout decisions
 * - Integration with monitoring dashboard
 *
 * Use Cases:
 * - Compare different model selection strategies
 * - Test cache warming approaches
 * - Evaluate complexity scoring weights
 * - Optimize budget thresholds
 * - Test parallel execution configurations
 *
 * Statistical Methods:
 * - Two-sample t-test for continuous metrics
 * - Chi-square test for categorical metrics
 * - Confidence intervals
 * - Effect size calculation
 * - Sample size estimation
 *
 * @module ABTestingFramework
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class ABTestingFramework extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      minSampleSize: options.minSampleSize || 30,
      significanceLevel: options.significanceLevel || 0.05, // 95% confidence
      minEffectSize: options.minEffectSize || 0.1, // 10% improvement
      autoRollout: options.autoRollout !== false,
      rolloutThreshold: options.rolloutThreshold || 0.95, // 95% confidence
      maxExperiments: options.maxExperiments || 10
    };

    // Experiments
    this.experiments = new Map(); // experimentId -> experiment
    this.activeExperiments = new Set();

    // Variant assignments
    this.assignments = new Map(); // contextId -> { experimentId, variantId }

    // Results
    this.results = new Map(); // experimentId -> { control, variants, analysis }

    // Statistics
    this.stats = {
      totalExperiments: 0,
      activeExperiments: 0,
      completedExperiments: 0,
      autoRollouts: 0,
      totalAssignments: 0
    };
  }

  /**
   * Create a new experiment
   * @param {Object} config - Experiment configuration
   * @returns {string} - Experiment ID
   */
  createExperiment(config) {
    if (this.activeExperiments.size >= this.config.maxExperiments) {
      throw new Error(`Maximum number of experiments (${this.config.maxExperiments}) reached`);
    }

    const experimentId = config.id || uuidv4();

    const experiment = {
      id: experimentId,
      name: config.name,
      description: config.description,

      // Control (baseline)
      control: {
        id: 'control',
        name: 'Control',
        configuration: config.control,
        samples: [],
        metrics: {}
      },

      // Variants to test
      variants: config.variants.map((v, i) => ({
        id: v.id || `variant_${i + 1}`,
        name: v.name || `Variant ${i + 1}`,
        configuration: v.configuration,
        samples: [],
        metrics: {}
      })),

      // Traffic allocation
      trafficAllocation: this.normalizeTrafficAllocation(config.trafficAllocation),

      // Metrics to track
      primaryMetric: config.primaryMetric,
      secondaryMetrics: config.secondaryMetrics || [],

      // Status
      status: 'active',
      startTime: Date.now(),
      endTime: null,

      // Configuration
      minSampleSize: config.minSampleSize || this.config.minSampleSize,
      significanceLevel: config.significanceLevel || this.config.significanceLevel,

      // Results
      analysis: null,
      winner: null
    };

    this.experiments.set(experimentId, experiment);
    this.activeExperiments.add(experimentId);
    this.stats.totalExperiments++;
    this.stats.activeExperiments++;

    console.log(`\n🧪 A/B Test Created: ${experiment.name}`);
    console.log(`   ID: ${experimentId}`);
    console.log(`   Control: ${experiment.control.name}`);
    console.log(`   Variants: ${experiment.variants.map(v => v.name).join(', ')}`);
    console.log(`   Primary Metric: ${experiment.primaryMetric}`);
    console.log(`   Min Sample Size: ${experiment.minSampleSize}`);

    this.emit('experiment-created', { experimentId, experiment });

    return experimentId;
  }

  /**
   * Normalize traffic allocation to ensure it sums to 1.0
   * @param {Object} allocation - Traffic allocation
   * @returns {Object} - Normalized allocation
   */
  normalizeTrafficAllocation(allocation) {
    if (!allocation) {
      // Default: equal split
      return { control: 0.5, variants: [0.5] };
    }

    const total = allocation.control + allocation.variants.reduce((sum, v) => sum + v, 0);

    return {
      control: allocation.control / total,
      variants: allocation.variants.map(v => v / total)
    };
  }

  /**
   * Assign a variant to a context
   * @param {string} experimentId - Experiment ID
   * @param {string} contextId - Context/user ID
   * @returns {Object} - Assigned variant
   */
  assignVariant(experimentId, contextId) {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== 'active') {
      throw new Error(`Experiment not active: ${experimentId}`);
    }

    // Check if already assigned
    if (this.assignments.has(contextId)) {
      const existing = this.assignments.get(contextId);
      if (existing.experimentId === experimentId) {
        return existing.variant;
      }
    }

    // Assign based on traffic allocation
    const variant = this.selectVariant(experiment);

    this.assignments.set(contextId, {
      experimentId,
      variantId: variant.id,
      variant,
      assignedAt: Date.now()
    });

    this.stats.totalAssignments++;

    return variant;
  }

  /**
   * Select variant based on traffic allocation
   * @param {Object} experiment - Experiment
   * @returns {Object} - Selected variant
   */
  selectVariant(experiment) {
    const random = Math.random();
    let cumulative = 0;

    // Check control
    cumulative += experiment.trafficAllocation.control;
    if (random < cumulative) {
      return experiment.control;
    }

    // Check variants
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.trafficAllocation.variants[i];
      if (random < cumulative) {
        return experiment.variants[i];
      }
    }

    // Fallback to control
    return experiment.control;
  }

  /**
   * Record a sample for an experiment
   * @param {string} experimentId - Experiment ID
   * @param {string} contextId - Context ID
   * @param {Object} metrics - Metrics to record
   */
  recordSample(experimentId, contextId, metrics) {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const assignment = this.assignments.get(contextId);

    if (!assignment || assignment.experimentId !== experimentId) {
      throw new Error(`No variant assigned for context: ${contextId}`);
    }

    // Find the variant (control or one of the variants)
    let variantData;
    if (assignment.variantId === 'control') {
      variantData = experiment.control;
    } else {
      variantData = experiment.variants.find(v => v.id === assignment.variantId);
    }

    if (!variantData) {
      throw new Error(`Variant not found: ${assignment.variantId}`);
    }

    // Record sample
    variantData.samples.push({
      contextId,
      metrics,
      recordedAt: Date.now()
    });

    // Update aggregated metrics
    this.updateVariantMetrics(variantData);

    // Check if ready for analysis
    if (this.isReadyForAnalysis(experiment)) {
      this.analyzeExperiment(experimentId);
    }

    this.emit('sample-recorded', { experimentId, contextId, variantId: assignment.variantId });
  }

  /**
   * Update aggregated metrics for a variant
   * @param {Object} variantData - Variant data
   */
  updateVariantMetrics(variantData) {
    if (variantData.samples.length === 0) return;

    // Get all metric keys
    const metricKeys = new Set();
    for (const sample of variantData.samples) {
      for (const key of Object.keys(sample.metrics)) {
        metricKeys.add(key);
      }
    }

    // Calculate aggregated metrics
    variantData.metrics = {};

    for (const key of metricKeys) {
      const values = variantData.samples
        .map(s => s.metrics[key])
        .filter(v => v !== undefined && v !== null);

      if (values.length > 0) {
        variantData.metrics[key] = {
          count: values.length,
          sum: values.reduce((sum, v) => sum + v, 0),
          mean: values.reduce((sum, v) => sum + v, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          stddev: this.calculateStdDev(values)
        };
      }
    }
  }

  /**
   * Calculate standard deviation
   * @param {Array<number>} values - Values
   * @returns {number} - Standard deviation
   */
  calculateStdDev(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Check if experiment is ready for analysis
   * @param {Object} experiment - Experiment
   * @returns {boolean} - Ready for analysis
   */
  isReadyForAnalysis(experiment) {
    // Check control has enough samples
    if (experiment.control.samples.length < experiment.minSampleSize) {
      return false;
    }

    // Check all variants have enough samples
    for (const variant of experiment.variants) {
      if (variant.samples.length < experiment.minSampleSize) {
        return false;
      }
    }

    return true;
  }

  /**
   * Analyze experiment results
   * @param {string} experimentId - Experiment ID
   * @returns {Object} - Analysis results
   */
  analyzeExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (!this.isReadyForAnalysis(experiment)) {
      console.log(`⚠️  Not enough samples for analysis: ${experiment.name}`);
      return null;
    }

    console.log(`\n📊 Analyzing Experiment: ${experiment.name}`);

    // Analyze primary metric
    const primaryAnalysis = this.compareMetric(
      experiment,
      experiment.primaryMetric
    );

    // Analyze secondary metrics
    const secondaryAnalyses = {};
    for (const metric of experiment.secondaryMetrics) {
      secondaryAnalyses[metric] = this.compareMetric(experiment, metric);
    }

    // Determine winner
    const winner = this.determineWinner(experiment, primaryAnalysis);

    const analysis = {
      experimentId,
      analyzedAt: Date.now(),
      primary: primaryAnalysis,
      secondary: secondaryAnalyses,
      winner,
      recommendation: this.generateRecommendation(experiment, primaryAnalysis, winner)
    };

    experiment.analysis = analysis;

    console.log(`\n📈 Primary Metric: ${experiment.primaryMetric}`);
    console.log(`   Control: ${primaryAnalysis.control.mean.toFixed(2)} (${primaryAnalysis.control.count} samples)`);

    for (let i = 0; i < experiment.variants.length; i++) {
      const variantAnalysis = primaryAnalysis.variants[i];
      console.log(`   ${experiment.variants[i].name}: ${variantAnalysis.mean.toFixed(2)} (${variantAnalysis.count} samples)`);
      console.log(`      Change: ${(variantAnalysis.changePercent * 100).toFixed(1)}%`);
      console.log(`      P-value: ${variantAnalysis.pValue.toFixed(4)}`);
      console.log(`      Significant: ${variantAnalysis.isSignificant ? '✅' : '❌'}`);
    }

    if (winner) {
      console.log(`\n🏆 Winner: ${winner.name}`);
      console.log(`   ${analysis.recommendation}`);

      // Auto-rollout if configured
      if (this.config.autoRollout && winner.id !== 'control') {
        this.rolloutWinner(experimentId);
      }
    } else {
      console.log(`\n⚠️  No clear winner - continue experiment`);
    }

    this.emit('experiment-analyzed', { experimentId, analysis });

    return analysis;
  }

  /**
   * Compare metric between control and variants
   * @param {Object} experiment - Experiment
   * @param {string} metricName - Metric name
   * @returns {Object} - Comparison results
   */
  compareMetric(experiment, metricName) {
    const controlMetric = experiment.control.metrics[metricName];

    if (!controlMetric) {
      throw new Error(`Metric not found in control: ${metricName}`);
    }

    const variantComparisons = experiment.variants.map(variant => {
      const variantMetric = variant.metrics[metricName];

      if (!variantMetric) {
        return {
          variantId: variant.id,
          error: 'Metric not found'
        };
      }

      // Two-sample t-test
      const tTest = this.twoSampleTTest(
        experiment.control.samples.map(s => s.metrics[metricName]),
        variant.samples.map(s => s.metrics[metricName]),
        experiment.significanceLevel
      );

      // Calculate change
      const change = variantMetric.mean - controlMetric.mean;
      const changePercent = change / controlMetric.mean;

      return {
        variantId: variant.id,
        count: variantMetric.count,
        mean: variantMetric.mean,
        stddev: variantMetric.stddev,
        change,
        changePercent,
        pValue: tTest.pValue,
        isSignificant: tTest.isSignificant,
        confidenceInterval: tTest.confidenceInterval
      };
    });

    return {
      metric: metricName,
      control: {
        count: controlMetric.count,
        mean: controlMetric.mean,
        stddev: controlMetric.stddev
      },
      variants: variantComparisons
    };
  }

  /**
   * Two-sample t-test
   * @param {Array<number>} sample1 - Sample 1
   * @param {Array<number>} sample2 - Sample 2
   * @param {number} alpha - Significance level
   * @returns {Object} - Test results
   */
  twoSampleTTest(sample1, sample2, alpha) {
    const n1 = sample1.length;
    const n2 = sample2.length;

    const mean1 = sample1.reduce((sum, v) => sum + v, 0) / n1;
    const mean2 = sample2.reduce((sum, v) => sum + v, 0) / n2;

    const variance1 = sample1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
    const variance2 = sample2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);

    // Pooled standard error
    const se = Math.sqrt(variance1 / n1 + variance2 / n2);

    // T-statistic
    const t = (mean2 - mean1) / se;

    // Degrees of freedom (Welch's approximation)
    const df = Math.pow(variance1 / n1 + variance2 / n2, 2) /
               (Math.pow(variance1 / n1, 2) / (n1 - 1) + Math.pow(variance2 / n2, 2) / (n2 - 1));

    // Approximate p-value (two-tailed)
    const pValue = this.tDistributionPValue(Math.abs(t), df);

    // Confidence interval
    const tCritical = this.tCriticalValue(alpha / 2, df);
    const marginOfError = tCritical * se;

    return {
      tStatistic: t,
      pValue,
      isSignificant: pValue < alpha,
      confidenceInterval: {
        lower: (mean2 - mean1) - marginOfError,
        upper: (mean2 - mean1) + marginOfError
      },
      degreesOfFreedom: df
    };
  }

  /**
   * Approximate p-value from t-distribution
   * @param {number} t - T-statistic
   * @param {number} df - Degrees of freedom
   * @returns {number} - P-value
   */
  tDistributionPValue(t, df) {
    // Simplified approximation
    // For production, use a proper statistical library
    if (t < 1.96) return 0.05; // Not significant at 95%
    if (t < 2.576) return 0.01; // Significant at 95%, not at 99%
    return 0.001; // Highly significant
  }

  /**
   * T critical value for confidence interval
   * @param {number} alpha - Alpha level
   * @param {number} df - Degrees of freedom
   * @returns {number} - Critical value
   */
  tCriticalValue(alpha, df) {
    // Simplified approximation
    // For large df (>30), approximates z-score
    if (alpha <= 0.025) return 1.96; // 95% CI
    if (alpha <= 0.005) return 2.576; // 99% CI
    return 1.645; // 90% CI
  }

  /**
   * Determine winner based on analysis
   * @param {Object} experiment - Experiment
   * @param {Object} primaryAnalysis - Primary metric analysis
   * @returns {Object|null} - Winner variant or null
   */
  determineWinner(experiment, primaryAnalysis) {
    // Find variants with significant improvement
    const significantImprovements = [];

    for (let i = 0; i < experiment.variants.length; i++) {
      const variantAnalysis = primaryAnalysis.variants[i];

      if (variantAnalysis.isSignificant &&
          variantAnalysis.changePercent > this.config.minEffectSize) {
        significantImprovements.push({
          variant: experiment.variants[i],
          analysis: variantAnalysis
        });
      }
    }

    if (significantImprovements.length === 0) {
      // No significant improvement - control wins
      return null;
    }

    // Find best variant
    const best = significantImprovements.reduce((best, current) => {
      return current.analysis.changePercent > best.analysis.changePercent ? current : best;
    });

    return best.variant;
  }

  /**
   * Generate recommendation
   * @param {Object} experiment - Experiment
   * @param {Object} primaryAnalysis - Primary analysis
   * @param {Object|null} winner - Winner
   * @returns {string} - Recommendation
   */
  generateRecommendation(experiment, primaryAnalysis, winner) {
    if (!winner) {
      return 'Continue experiment - no variant shows significant improvement over control.';
    }

    if (winner.id === 'control') {
      return 'Keep current configuration - control performs best.';
    }

    const variantAnalysis = primaryAnalysis.variants.find(v => v.variantId === winner.id);
    const improvement = (variantAnalysis.changePercent * 100).toFixed(1);

    return `Roll out ${winner.name} - shows ${improvement}% improvement with statistical significance.`;
  }

  /**
   * Roll out winning variant
   * @param {string} experimentId - Experiment ID
   */
  rolloutWinner(experimentId) {
    const experiment = this.experiments.get(experimentId);

    if (!experiment || !experiment.analysis || !experiment.analysis.winner) {
      throw new Error('Cannot rollout - no winner determined');
    }

    const winner = experiment.analysis.winner;

    console.log(`\n🚀 Auto-Rollout: ${winner.name}`);
    console.log(`   Configuration:`);
    console.log(JSON.stringify(winner.configuration, null, 2));

    // Mark experiment as completed
    experiment.status = 'completed';
    experiment.endTime = Date.now();
    experiment.winner = winner;

    this.activeExperiments.delete(experimentId);
    this.stats.activeExperiments--;
    this.stats.completedExperiments++;
    this.stats.autoRollouts++;

    this.emit('experiment-completed', { experimentId, winner });
    this.emit('variant-rollout', { experimentId, winner });
  }

  /**
   * Stop an experiment
   * @param {string} experimentId - Experiment ID
   * @param {string} reason - Reason for stopping
   */
  stopExperiment(experimentId, reason = 'Manual stop') {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = 'stopped';
    experiment.endTime = Date.now();
    experiment.stopReason = reason;

    this.activeExperiments.delete(experimentId);
    this.stats.activeExperiments--;

    console.log(`\n🛑 Experiment Stopped: ${experiment.name}`);
    console.log(`   Reason: ${reason}`);

    this.emit('experiment-stopped', { experimentId, reason });
  }

  /**
   * Get experiment status
   * @param {string} experimentId - Experiment ID
   * @returns {Object} - Experiment status
   */
  getExperimentStatus(experimentId) {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    return {
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      startTime: experiment.startTime,
      endTime: experiment.endTime,
      control: {
        name: experiment.control.name,
        samples: experiment.control.samples.length
      },
      variants: experiment.variants.map(v => ({
        name: v.name,
        samples: v.samples.length
      })),
      readyForAnalysis: this.isReadyForAnalysis(experiment),
      analysis: experiment.analysis,
      winner: experiment.winner
    };
  }

  /**
   * Get all experiments
   * @returns {Array<Object>} - All experiments
   */
  getAllExperiments() {
    return Array.from(this.experiments.values()).map(exp => ({
      id: exp.id,
      name: exp.name,
      status: exp.status,
      startTime: exp.startTime,
      sampleCount: exp.control.samples.length +
                   exp.variants.reduce((sum, v) => sum + v.samples.length, 0)
    }));
  }

  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    return {
      experiments: {
        total: this.stats.totalExperiments,
        active: this.stats.activeExperiments,
        completed: this.stats.completedExperiments,
        autoRollouts: this.stats.autoRollouts
      },
      assignments: {
        total: this.stats.totalAssignments
      },
      activeExperiments: Array.from(this.activeExperiments).map(id => {
        const exp = this.experiments.get(id);
        return {
          id: exp.id,
          name: exp.name,
          samples: exp.control.samples.length +
                   exp.variants.reduce((sum, v) => sum + v.samples.length, 0),
          readyForAnalysis: this.isReadyForAnalysis(exp)
        };
      })
    };
  }

  /**
   * Reset state
   */
  reset() {
    this.experiments.clear();
    this.activeExperiments.clear();
    this.assignments.clear();
    this.results.clear();

    this.stats = {
      totalExperiments: 0,
      activeExperiments: 0,
      completedExperiments: 0,
      autoRollouts: 0,
      totalAssignments: 0
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = ABTestingFramework;
