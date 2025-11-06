/**
 * A/B Testing Framework - Compare baseline vs optimized systems
 *
 * Provides statistical analysis and confidence scoring for optimization validation
 */

const fs = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');

class ABTesting {
  constructor(options = {}) {
    this.mongoUri = options.mongoUri || process.env.MONGODB_URI;
    this.confidenceThreshold = options.confidenceThreshold || 95;
    this.minSampleSize = options.minSampleSize || 10;
    this.workspaceBase = options.workspaceBase || path.join(__dirname, '../../workspace');
  }

  /**
   * Initialize A/B test
   */
  async initializeTest(testConfig) {
    const testId = `abtest-${Date.now()}`;

    const test = {
      testId,
      name: testConfig.name,
      description: testConfig.description,
      startTime: new Date().toISOString(),
      status: 'initialized',
      baseline: {
        version: testConfig.baselineVersion || 'current',
        samples: [],
        metrics: {}
      },
      optimized: {
        version: testConfig.optimizedVersion || 'proposed',
        samples: [],
        metrics: {}
      },
      comparison: null,
      confidence: 0,
      decision: null
    };

    // Save test configuration
    const testPath = path.join(this.workspaceBase, 'ab-tests', `${testId}.json`);
    await fs.mkdir(path.dirname(testPath), { recursive: true });
    await fs.writeFile(testPath, JSON.stringify(test, null, 2));

    return test;
  }

  /**
   * Record baseline sample
   */
  async recordBaselineSample(testId, metrics) {
    const test = await this.loadTest(testId);

    test.baseline.samples.push({
      timestamp: new Date().toISOString(),
      metrics
    });

    await this.saveTest(test);
    return test;
  }

  /**
   * Record optimized sample
   */
  async recordOptimizedSample(testId, metrics) {
    const test = await this.loadTest(testId);

    test.optimized.samples.push({
      timestamp: new Date().toISOString(),
      metrics
    });

    await this.saveTest(test);
    return test;
  }

  /**
   * Calculate aggregate metrics
   */
  calculateAggregateMetrics(samples) {
    if (samples.length === 0) {
      return null;
    }

    const metrics = {};
    const allKeys = new Set();

    // Collect all metric keys
    samples.forEach(sample => {
      Object.keys(sample.metrics).forEach(key => allKeys.add(key));
    });

    // Calculate aggregates for each metric
    allKeys.forEach(key => {
      const values = samples
        .map(s => s.metrics[key])
        .filter(v => typeof v === 'number');

      if (values.length > 0) {
        metrics[key] = {
          mean: this.mean(values),
          median: this.median(values),
          stdDev: this.standardDeviation(values),
          min: Math.min(...values),
          max: Math.max(...values),
          samples: values.length
        };
      }
    });

    return metrics;
  }

  /**
   * Compare baseline vs optimized
   */
  async compareResults(testId) {
    const test = await this.loadTest(testId);

    // Check minimum sample size
    if (test.baseline.samples.length < this.minSampleSize ||
        test.optimized.samples.length < this.minSampleSize) {
      return {
        error: 'Insufficient samples',
        required: this.minSampleSize,
        baseline: test.baseline.samples.length,
        optimized: test.optimized.samples.length
      };
    }

    // Calculate aggregate metrics
    test.baseline.metrics = this.calculateAggregateMetrics(test.baseline.samples);
    test.optimized.metrics = this.calculateAggregateMetrics(test.optimized.samples);

    // Compare metrics
    const comparison = {};
    const metricKeys = Object.keys(test.baseline.metrics);

    metricKeys.forEach(key => {
      const baseline = test.baseline.metrics[key];
      const optimized = test.optimized.metrics[key];

      if (baseline && optimized) {
        const improvement = this.calculateImprovement(baseline.mean, optimized.mean);
        const significance = this.calculateSignificance(
          test.baseline.samples.map(s => s.metrics[key]),
          test.optimized.samples.map(s => s.metrics[key])
        );

        comparison[key] = {
          baseline: baseline.mean,
          optimized: optimized.mean,
          improvement: improvement,
          percentChange: ((optimized.mean - baseline.mean) / baseline.mean * 100).toFixed(2),
          significance: significance,
          winner: improvement > 0 ? 'optimized' : (improvement < 0 ? 'baseline' : 'tie')
        };
      }
    });

    test.comparison = comparison;

    // Calculate overall confidence
    test.confidence = this.calculateOverallConfidence(comparison);

    // Make decision
    test.decision = this.makeDecision(test.confidence, comparison);
    test.status = 'completed';
    test.endTime = new Date().toISOString();

    await this.saveTest(test);
    return test;
  }

  /**
   * Calculate improvement (-1 to 1, where 1 is 100% improvement)
   */
  calculateImprovement(baseline, optimized) {
    if (baseline === 0) return 0;
    return (baseline - optimized) / baseline;
  }

  /**
   * Calculate statistical significance (T-test)
   */
  calculateSignificance(baselineSamples, optimizedSamples) {
    const n1 = baselineSamples.length;
    const n2 = optimizedSamples.length;

    const mean1 = this.mean(baselineSamples);
    const mean2 = this.mean(optimizedSamples);

    const variance1 = this.variance(baselineSamples);
    const variance2 = this.variance(optimizedSamples);

    // Pooled standard deviation
    const pooledVariance = ((n1 - 1) * variance1 + (n2 - 1) * variance2) / (n1 + n2 - 2);
    const pooledStdDev = Math.sqrt(pooledVariance);

    // T-statistic
    const tStat = Math.abs(mean1 - mean2) / (pooledStdDev * Math.sqrt(1/n1 + 1/n2));

    // Degrees of freedom
    const df = n1 + n2 - 2;

    // Convert to p-value (approximate)
    const pValue = this.tTestPValue(tStat, df);

    return {
      tStatistic: tStat.toFixed(4),
      degreesOfFreedom: df,
      pValue: pValue.toFixed(4),
      significant: pValue < 0.05
    };
  }

  /**
   * Approximate p-value from t-statistic (simplified)
   */
  tTestPValue(tStat, df) {
    // Simplified approximation - in production, use proper statistical library
    if (tStat < 1.5) return 0.15;
    if (tStat < 2.0) return 0.05;
    if (tStat < 2.5) return 0.02;
    if (tStat < 3.0) return 0.01;
    return 0.001;
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(comparison) {
    const metrics = Object.values(comparison);
    if (metrics.length === 0) return 0;

    let totalConfidence = 0;
    let significantImprovements = 0;
    let totalMetrics = 0;

    metrics.forEach(metric => {
      totalMetrics++;

      // Base confidence on improvement magnitude and significance
      let metricConfidence = 0;

      if (metric.winner === 'optimized') {
        // Positive improvement
        const improvementPercent = Math.abs(parseFloat(metric.percentChange));

        if (metric.significance.significant) {
          // Statistically significant improvement
          metricConfidence = Math.min(98, 70 + improvementPercent / 3);
          significantImprovements++;
        } else {
          // Improvement but not statistically significant
          metricConfidence = Math.min(85, 50 + improvementPercent / 5);
        }
      } else if (metric.winner === 'baseline') {
        // Regression - reduce confidence
        const regressionPercent = Math.abs(parseFloat(metric.percentChange));
        metricConfidence = Math.max(0, 60 - regressionPercent);
      } else {
        // Tie - neutral
        metricConfidence = 75;
      }

      totalConfidence += metricConfidence;
    });

    // Weight by number of significant improvements
    const significanceBonus = (significantImprovements / totalMetrics) * 10;

    const averageConfidence = totalConfidence / totalMetrics;
    const finalConfidence = Math.min(99, Math.round(averageConfidence + significanceBonus));

    return finalConfidence;
  }

  /**
   * Make deployment decision
   */
  makeDecision(confidence, comparison) {
    const decision = {
      recommendation: 'unknown',
      rationale: [],
      risks: [],
      benefits: []
    };

    // Check confidence threshold
    if (confidence >= this.confidenceThreshold) {
      decision.recommendation = 'deploy';
      decision.rationale.push(`Confidence (${confidence}%) meets threshold (${this.confidenceThreshold}%)`);
    } else {
      decision.recommendation = 'review';
      decision.rationale.push(`Confidence (${confidence}%) below threshold (${this.confidenceThreshold}%)`);
      decision.risks.push('Insufficient confidence for automatic deployment');
    }

    // Analyze metrics
    const metrics = Object.entries(comparison);
    let improvements = 0;
    let regressions = 0;

    metrics.forEach(([key, metric]) => {
      if (metric.winner === 'optimized') {
        improvements++;
        decision.benefits.push(`${key}: ${metric.percentChange}% improvement`);
      } else if (metric.winner === 'baseline') {
        regressions++;
        decision.risks.push(`${key}: ${metric.percentChange}% regression`);
      }
    });

    // Check for critical regressions
    const criticalMetrics = ['tokensUsed', 'cost', 'errorRate', 'responseTime'];
    const hasCriticalRegression = metrics.some(([key, metric]) =>
      criticalMetrics.includes(key) && metric.winner === 'baseline'
    );

    if (hasCriticalRegression) {
      decision.recommendation = 'reject';
      decision.rationale.push('Critical regression detected');
    }

    // Add summary
    decision.summary = {
      improvements,
      regressions,
      confidence,
      meetsThreshold: confidence >= this.confidenceThreshold
    };

    return decision;
  }

  /**
   * Generate A/B test report
   */
  async generateReport(testId) {
    const test = await this.loadTest(testId);

    const report = {
      testId: test.testId,
      name: test.name,
      description: test.description,
      duration: this.calculateDuration(test.startTime, test.endTime),
      status: test.status,
      baseline: {
        version: test.baseline.version,
        sampleCount: test.baseline.samples.length,
        metrics: test.baseline.metrics
      },
      optimized: {
        version: test.optimized.version,
        sampleCount: test.optimized.samples.length,
        metrics: test.optimized.metrics
      },
      comparison: test.comparison,
      confidence: test.confidence,
      decision: test.decision,
      timestamp: new Date().toISOString()
    };

    // Save report
    const reportPath = path.join(this.workspaceBase, 'ab-tests', `${testId}-report.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Calculate duration between timestamps
   */
  calculateDuration(start, end) {
    if (!end) return null;

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    return {
      milliseconds: durationMs,
      formatted: `${hours}h ${minutes}m ${seconds}s`
    };
  }

  /**
   * Statistical helper functions
   */
  mean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  variance(values) {
    const avg = this.mean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }

  standardDeviation(values) {
    return Math.sqrt(this.variance(values));
  }

  /**
   * Load test from file
   */
  async loadTest(testId) {
    const testPath = path.join(this.workspaceBase, 'ab-tests', `${testId}.json`);
    const data = await fs.readFile(testPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save test to file
   */
  async saveTest(test) {
    const testPath = path.join(this.workspaceBase, 'ab-tests', `${test.testId}.json`);
    await fs.writeFile(testPath, JSON.stringify(test, null, 2));
  }
}

module.exports = ABTesting;
