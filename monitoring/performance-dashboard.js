/**
 * Performance Monitoring Dashboard
 *
 * Comprehensive monitoring system that aggregates metrics from all optimization
 * components and provides real-time visibility, alerts, and historical analysis.
 *
 * Features:
 * - Real-time metrics collection
 * - Historical trend analysis
 * - Alert configuration and triggering
 * - Report generation
 * - Export capabilities (JSON, CSV)
 * - Dashboard API for external tools
 *
 * Monitored Components:
 * - Token Budget Manager
 * - Model Selector (Adaptive)
 * - Agent Discovery
 * - Cache Orchestrator
 * - Usage Tracker
 * - Intelligent Orchestrator
 *
 * @module PerformanceDashboard
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class PerformanceDashboard extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      collectionInterval: options.collectionInterval || 60000, // 1 minute
      retentionDays: options.retentionDays || 30,
      alertsEnabled: options.alertsEnabled !== false,
      exportPath: options.exportPath || path.join(__dirname, '../reports'),
      maxHistorySize: options.maxHistorySize || 10000
    };

    // Component references
    this.components = {
      budgetManager: options.budgetManager || null,
      modelSelector: options.modelSelector || null,
      agentDiscovery: options.agentDiscovery || null,
      cacheOrchestrator: options.cacheOrchestrator || null,
      usageTracker: options.usageTracker || null,
      orchestrator: options.orchestrator || null
    };

    // Metrics storage
    this.metrics = {
      current: {},
      history: [],
      aggregated: {}
    };

    // Alert configuration
    this.alerts = new Map();
    this.triggeredAlerts = [];

    // Baseline for comparisons
    this.baseline = null;

    // Start collection
    if (options.autoStart !== false) {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    console.log('📊 Starting performance monitoring...\n');

    // Initial collection
    this.collectMetrics();

    // Set up periodic collection
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);

    this.emit('monitoring-started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    console.log('📊 Performance monitoring stopped\n');

    this.emit('monitoring-stopped');
  }

  /**
   * Collect metrics from all components
   */
  collectMetrics() {
    const snapshot = {
      timestamp: Date.now(),
      budget: this.collectBudgetMetrics(),
      model: this.collectModelMetrics(),
      cache: this.collectCacheMetrics(),
      usage: this.collectUsageMetrics(),
      orchestration: this.collectOrchestrationMetrics(),
      system: this.collectSystemMetrics()
    };

    // Store current
    this.metrics.current = snapshot;

    // Add to history
    this.metrics.history.push(snapshot);

    // Trim history if too large
    if (this.metrics.history.length > this.config.maxHistorySize) {
      this.metrics.history = this.metrics.history.slice(-this.config.maxHistorySize);
    }

    // Update aggregated metrics
    this.updateAggregatedMetrics();

    // Check alerts
    if (this.config.alertsEnabled) {
      this.checkAlerts(snapshot);
    }

    this.emit('metrics-collected', snapshot);
  }

  /**
   * Collect budget metrics
   * @returns {Object} - Budget metrics
   */
  collectBudgetMetrics() {
    if (!this.components.budgetManager) return null;

    const stats = this.components.budgetManager.getStatistics();

    return {
      usage: {
        hourly: stats.usage.hour,
        daily: stats.usage.day,
        weekly: stats.usage.week,
        session: stats.usage.session
      },
      limits: stats.budgets,
      utilization: {
        hourly: (stats.usage.hour / stats.budgets.hourly) * 100,
        daily: (stats.usage.day / stats.budgets.daily) * 100,
        weekly: (stats.usage.week / stats.budgets.weekly) * 100
      },
      optimizationLevel: stats.optimizationLevel,
      stats: stats.stats
    };
  }

  /**
   * Collect model selection metrics
   * @returns {Object} - Model metrics
   */
  collectModelMetrics() {
    if (!this.components.modelSelector) return null;

    const stats = this.components.modelSelector.getStatistics();

    return {
      totalSelections: stats.totalSelections,
      corrections: stats.corrections,
      accuracy: stats.corrections > 0 ?
        ((stats.totalSelections - stats.corrections) / stats.totalSelections * 100) : 100,
      modelDistribution: stats.modelAccuracy,
      performance: stats.modelPerformance,
      avgComplexity: stats.avgComplexity || 0,
      // Adaptive metrics if available
      adaptive: stats.adaptive || null,
      insights: stats.insights || null
    };
  }

  /**
   * Collect cache metrics
   * @returns {Object} - Cache metrics
   */
  collectCacheMetrics() {
    if (!this.components.cacheOrchestrator) return null;

    const stats = this.components.cacheOrchestrator.getStatistics();

    return {
      overall: stats.overall,
      promptCache: stats.promptCache,
      agentCache: stats.agentCache,
      sharedContexts: stats.sharedContexts
    };
  }

  /**
   * Collect usage metrics
   * @returns {Object} - Usage metrics
   */
  collectUsageMetrics() {
    if (!this.components.usageTracker) return null;

    const stats = this.components.usageTracker.getStatistics({ period: 'all' });

    return {
      overall: stats.overall,
      trends: stats.trends,
      efficiency: stats.efficiency
    };
  }

  /**
   * Collect orchestration metrics
   * @returns {Object} - Orchestration metrics
   */
  collectOrchestrationMetrics() {
    if (!this.components.orchestrator) return null;

    const stats = this.components.orchestrator.getStatistics();

    return {
      tasks: {
        completed: stats.orchestrator.tasksCompleted,
        failed: stats.orchestrator.tasksFailed,
        successRate: stats.orchestrator.successRate,
        avgExecutionTime: stats.orchestrator.avgExecutionTime
      },
      parallelExecutions: stats.orchestrator.parallelExecutions,
      topAgents: stats.orchestrator.topAgents
    };
  }

  /**
   * Collect system metrics
   * @returns {Object} - System metrics
   */
  collectSystemMetrics() {
    return {
      uptime: process.uptime() * 1000, // ms
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  /**
   * Update aggregated metrics
   */
  updateAggregatedMetrics() {
    if (this.metrics.history.length === 0) return;

    const recent = this.metrics.history.slice(-60); // Last hour (if 1min intervals)

    this.metrics.aggregated = {
      tokens: this.aggregateTokenMetrics(recent),
      cost: this.aggregateCostMetrics(recent),
      performance: this.aggregatePerformanceMetrics(recent),
      cache: this.aggregateCacheMetrics(recent),
      quality: this.aggregateQualityMetrics(recent)
    };
  }

  /**
   * Aggregate token metrics
   * @param {Array} snapshots - Snapshots
   * @returns {Object} - Aggregated metrics
   */
  aggregateTokenMetrics(snapshots) {
    const total = snapshots.reduce((sum, s) =>
      sum + (s.usage?.overall?.tokens?.total || 0), 0
    );

    const saved = snapshots.reduce((sum, s) =>
      sum + (s.cache?.overall?.totalTokensSaved || 0), 0
    );

    return {
      total,
      saved,
      savingsRate: total > 0 ? (saved / (total + saved)) * 100 : 0
    };
  }

  /**
   * Aggregate cost metrics
   * @param {Array} snapshots - Snapshots
   * @returns {Object} - Aggregated metrics
   */
  aggregateCostMetrics(snapshots) {
    const total = snapshots.reduce((sum, s) =>
      sum + (s.usage?.overall?.cost?.total || 0), 0
    );

    return {
      total,
      avgPerOperation: snapshots.length > 0 ? total / snapshots.length : 0,
      trend: this.calculateTrend(snapshots, 'usage.overall.cost.total')
    };
  }

  /**
   * Aggregate performance metrics
   * @param {Array} snapshots - Snapshots
   * @returns {Object} - Aggregated metrics
   */
  aggregatePerformanceMetrics(snapshots) {
    const execTimes = snapshots
      .map(s => s.orchestration?.tasks?.avgExecutionTime)
      .filter(t => t != null);

    return {
      avgExecutionTime: execTimes.length > 0 ?
        execTimes.reduce((sum, t) => sum + t, 0) / execTimes.length : 0,
      successRate: this.calculateAverageSuccessRate(snapshots),
      throughput: this.calculateThroughput(snapshots)
    };
  }

  /**
   * Aggregate cache metrics
   * @param {Array} snapshots - Snapshots
   * @returns {Object} - Aggregated metrics
   */
  aggregateCacheMetrics(snapshots) {
    const hitRates = snapshots
      .map(s => s.cache?.overall?.hitRate)
      .filter(r => r != null);

    return {
      avgHitRate: hitRates.length > 0 ?
        hitRates.reduce((sum, r) => sum + r, 0) / hitRates.length : 0,
      trend: this.calculateTrend(snapshots, 'cache.overall.hitRate')
    };
  }

  /**
   * Aggregate quality metrics
   * @param {Array} snapshots - Snapshots
   * @returns {Object} - Aggregated metrics
   */
  aggregateQualityMetrics(snapshots) {
    return {
      modelAccuracy: this.calculateAverageModelAccuracy(snapshots),
      confidenceScore: this.calculateAverageConfidence(snapshots)
    };
  }

  /**
   * Calculate trend
   * @param {Array} snapshots - Snapshots
   * @param {string} metricPath - Path to metric
   * @returns {string} - Trend direction
   */
  calculateTrend(snapshots, metricPath) {
    if (snapshots.length < 2) return 'stable';

    const getValue = (snapshot, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], snapshot);
    };

    const recent = snapshots.slice(-10);
    const older = snapshots.slice(-20, -10);

    const recentAvg = recent.reduce((sum, s) => sum + (getValue(s, metricPath) || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + (getValue(s, metricPath) || 0), 0) / older.length;

    if (recentAvg > olderAvg * 1.05) return 'increasing';
    if (recentAvg < olderAvg * 0.95) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate average success rate
   * @param {Array} snapshots - Snapshots
   * @returns {number} - Success rate
   */
  calculateAverageSuccessRate(snapshots) {
    const rates = snapshots
      .map(s => s.orchestration?.tasks?.successRate)
      .filter(r => r != null);

    return rates.length > 0 ?
      rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;
  }

  /**
   * Calculate throughput
   * @param {Array} snapshots - Snapshots
   * @returns {number} - Tasks per minute
   */
  calculateThroughput(snapshots) {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    const timeSpan = (last.timestamp - first.timestamp) / 60000; // minutes
    const tasksCompleted = (last.orchestration?.tasks?.completed || 0) -
                           (first.orchestration?.tasks?.completed || 0);

    return timeSpan > 0 ? tasksCompleted / timeSpan : 0;
  }

  /**
   * Calculate average model accuracy
   * @param {Array} snapshots - Snapshots
   * @returns {number} - Accuracy percentage
   */
  calculateAverageModelAccuracy(snapshots) {
    const accuracies = snapshots
      .map(s => s.model?.accuracy)
      .filter(a => a != null);

    return accuracies.length > 0 ?
      accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length : 0;
  }

  /**
   * Calculate average confidence
   * @param {Array} snapshots - Snapshots
   * @returns {number} - Confidence score
   */
  calculateAverageConfidence(snapshots) {
    const confidences = snapshots
      .map(s => s.model?.adaptive?.avgConfidence)
      .filter(c => c != null);

    return confidences.length > 0 ?
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
  }

  /**
   * Configure alert
   * @param {Object} alert - Alert configuration
   */
  configureAlert(alert) {
    this.alerts.set(alert.id, {
      id: alert.id,
      name: alert.name,
      metric: alert.metric,
      condition: alert.condition,
      threshold: alert.threshold,
      enabled: alert.enabled !== false,
      severity: alert.severity || 'warning'
    });

    console.log(`🔔 Alert configured: ${alert.name}`);
  }

  /**
   * Check alerts against current metrics
   * @param {Object} snapshot - Current snapshot
   */
  checkAlerts(snapshot) {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      const value = this.getMetricValue(snapshot, alert.metric);
      if (value == null) continue;

      const triggered = this.evaluateCondition(value, alert.condition, alert.threshold);

      if (triggered) {
        this.triggerAlert(alert, value);
      }
    }
  }

  /**
   * Get metric value from snapshot
   * @param {Object} snapshot - Snapshot
   * @param {string} metricPath - Metric path
   * @returns {*} - Metric value
   */
  getMetricValue(snapshot, metricPath) {
    return metricPath.split('.').reduce((obj, key) => obj?.[key], snapshot);
  }

  /**
   * Evaluate alert condition
   * @param {*} value - Current value
   * @param {string} condition - Condition
   * @param {*} threshold - Threshold
   * @returns {boolean} - Is triggered
   */
  evaluateCondition(value, condition, threshold) {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Trigger alert
   * @param {Object} alert - Alert configuration
   * @param {*} value - Current value
   */
  triggerAlert(alert, value) {
    const alertEvent = {
      id: `alert_${Date.now()}`,
      alertId: alert.id,
      name: alert.name,
      metric: alert.metric,
      value,
      threshold: alert.threshold,
      severity: alert.severity,
      timestamp: Date.now()
    };

    this.triggeredAlerts.push(alertEvent);

    // Keep only recent alerts
    if (this.triggeredAlerts.length > 1000) {
      this.triggeredAlerts = this.triggeredAlerts.slice(-1000);
    }

    this.emit('alert-triggered', alertEvent);

    console.log(`🚨 Alert: ${alert.name} - ${alert.metric} = ${value} (threshold: ${alert.threshold})`);
  }

  /**
   * Generate comprehensive report
   * @returns {Object} - Report
   */
  generateReport() {
    return {
      generatedAt: new Date().toISOString(),
      period: {
        start: this.metrics.history[0]?.timestamp || Date.now(),
        end: this.metrics.history[this.metrics.history.length - 1]?.timestamp || Date.now(),
        duration: this.metrics.history.length * this.config.collectionInterval
      },
      summary: {
        current: this.metrics.current,
        aggregated: this.metrics.aggregated,
        baseline: this.baseline
      },
      trends: this.analyzeTrends(),
      alerts: {
        configured: this.alerts.size,
        triggered: this.triggeredAlerts.length,
        recent: this.triggeredAlerts.slice(-10)
      },
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Analyze trends
   * @returns {Object} - Trends
   */
  analyzeTrends() {
    return {
      tokens: this.metrics.aggregated.tokens,
      cost: this.metrics.aggregated.cost,
      performance: this.metrics.aggregated.performance,
      cache: this.metrics.aggregated.cache,
      quality: this.metrics.aggregated.quality
    };
  }

  /**
   * Generate recommendations
   * @returns {Array<string>} - Recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const current = this.metrics.current;

    // Budget recommendations
    if (current.budget?.utilization?.hourly > 80) {
      recommendations.push('Consider increasing hourly budget or optimizing token usage');
    }

    // Cache recommendations
    if (current.cache?.overall?.hitRate < 70) {
      recommendations.push('Cache hit rate below 70% - consider warming cache or reviewing cache strategy');
    }

    // Model selection recommendations
    if (current.model?.accuracy < 85) {
      recommendations.push('Model selection accuracy below 85% - review complexity scoring weights');
    }

    // Performance recommendations
    if (current.orchestration?.tasks?.successRate < 90) {
      recommendations.push('Task success rate below 90% - investigate failures and adjust model selection');
    }

    return recommendations;
  }

  /**
   * Export metrics
   * @param {string} format - Format (json, csv)
   * @returns {Promise<string>} - Export path
   */
  async exportMetrics(format = 'json') {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `performance-report-${timestamp}.${format}`;
    const filepath = path.join(this.config.exportPath, filename);

    // Ensure directory exists
    await fs.mkdir(this.config.exportPath, { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(report);
      await fs.writeFile(filepath, csv);
    }

    console.log(`📄 Report exported: ${filepath}`);

    return filepath;
  }

  /**
   * Convert report to CSV
   * @param {Object} report - Report
   * @returns {string} - CSV
   */
  convertToCSV(report) {
    // Simplified CSV export - full implementation would be more comprehensive
    const headers = ['Timestamp', 'Tokens Total', 'Cost Total', 'Cache Hit Rate', 'Success Rate'];
    const rows = this.metrics.history.map(s => [
      new Date(s.timestamp).toISOString(),
      s.usage?.overall?.tokens?.total || 0,
      s.usage?.overall?.cost?.total || 0,
      s.cache?.overall?.hitRate || 0,
      s.orchestration?.tasks?.successRate || 0
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  /**
   * Get current metrics
   * @returns {Object} - Current metrics
   */
  getCurrentMetrics() {
    return this.metrics.current;
  }

  /**
   * Get historical metrics
   * @param {Object} options - Query options
   * @returns {Array} - Historical metrics
   */
  getHistoricalMetrics(options = {}) {
    let history = [...this.metrics.history];

    if (options.since) {
      history = history.filter(s => s.timestamp >= options.since);
    }

    if (options.until) {
      history = history.filter(s => s.timestamp <= options.until);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Set baseline for comparisons
   * @param {Object} baseline - Baseline metrics
   */
  setBaseline(baseline) {
    this.baseline = baseline;
    console.log('📊 Baseline set for performance comparisons');
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

module.exports = PerformanceDashboard;
