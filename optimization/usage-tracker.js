/**
 * Token Usage Tracker
 *
 * Comprehensive token usage tracking, analytics, and reporting system.
 * Integrates with TokenBudgetManager and provides deep insights into usage patterns.
 *
 * Features:
 * - Real-time usage tracking
 * - Per-project, per-agent, per-model analytics
 * - Cost calculations
 * - Trend analysis
 * - Export capabilities
 * - Dashboard integration
 * - Alert system
 *
 * @module TokenUsageTracker
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class TokenUsageTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    // Storage
    this.usageLog = [];
    this.aggregatedStats = {
      byProject: new Map(),
      byAgent: new Map(),
      byModel: new Map(),
      byTaskType: new Map(),
      byHour: new Map(),
      byDay: new Map()
    };

    // Configuration
    this.config = {
      persistPath: options.persistPath || path.join(__dirname, 'usage-data.json'),
      autoSave: options.autoSave !== false,
      saveInterval: options.saveInterval || 60000, // 1 minute
      maxLogSize: options.maxLogSize || 10000,
      budgetManager: options.budgetManager || null,
      modelSelector: options.modelSelector || null
    };

    // Start auto-save if enabled
    if (this.config.autoSave) {
      this.startAutoSave();
    }

    // Load existing data
    this.loadData().catch(() => {
      // Ignore load errors on first run
    });
  }

  /**
   * Track a usage event
   * @param {Object} event - Usage event details
   */
  async track(event) {
    const entry = {
      timestamp: Date.now(),
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tokens: {
        input: event.inputTokens || 0,
        output: event.outputTokens || 0,
        cached: event.cachedTokens || 0,
        total: (event.inputTokens || 0) + (event.outputTokens || 0)
      },
      cost: this.calculateCost(event),
      model: event.model || 'unknown',
      agent: event.agent || 'unknown',
      project: event.project || null,
      taskType: event.taskType || 'unknown',
      operation: event.operation || 'unknown',
      metadata: event.metadata || {},
      optimization: {
        budgetLevel: event.budgetLevel || 'standard',
        cached: (event.cachedTokens || 0) > 0,
        cacheHitRate: this.calculateCacheHitRate(event)
      }
    };

    // Add to log
    this.usageLog.push(entry);

    // Trim log if too large
    if (this.usageLog.length > this.config.maxLogSize) {
      this.usageLog = this.usageLog.slice(-this.config.maxLogSize);
    }

    // Update aggregated stats
    this.updateAggregatedStats(entry);

    // Emit event
    this.emit('usage-tracked', entry);

    return entry.id;
  }

  /**
   * Calculate cost for event
   * @param {Object} event - Event data
   * @returns {Object} - Cost breakdown
   */
  calculateCost(event) {
    const modelPricing = {
      'haiku': { input: 0.25, output: 1.25 },
      'sonnet': { input: 3.0, output: 15.0 },
      'opus': { input: 15.0, output: 75.0 }
    };

    // Detect model type
    let pricing = modelPricing.sonnet; // Default
    if (event.model && event.model.includes('haiku')) pricing = modelPricing.haiku;
    else if (event.model && event.model.includes('opus')) pricing = modelPricing.opus;

    const inputCost = ((event.inputTokens || 0) / 1000000) * pricing.input;
    const outputCost = ((event.outputTokens || 0) / 1000000) * pricing.output;
    const cachedCost = ((event.cachedTokens || 0) / 1000000) * (pricing.input * 0.1); // 90% savings on cached

    return {
      input: parseFloat(inputCost.toFixed(6)),
      output: parseFloat(outputCost.toFixed(6)),
      cached: parseFloat(cachedCost.toFixed(6)),
      total: parseFloat((inputCost + outputCost + cachedCost).toFixed(6))
    };
  }

  /**
   * Calculate cache hit rate for event
   * @param {Object} event - Event data
   * @returns {number} - Cache hit rate (0-1)
   */
  calculateCacheHitRate(event) {
    const total = (event.inputTokens || 0) + (event.cachedTokens || 0);
    if (total === 0) return 0;
    return (event.cachedTokens || 0) / total;
  }

  /**
   * Update aggregated statistics
   * @param {Object} entry - Usage entry
   */
  updateAggregatedStats(entry) {
    // By project
    if (entry.project) {
      const projectStats = this.aggregatedStats.byProject.get(entry.project) || this.initStats();
      this.updateStats(projectStats, entry);
      this.aggregatedStats.byProject.set(entry.project, projectStats);
    }

    // By agent
    const agentStats = this.aggregatedStats.byAgent.get(entry.agent) || this.initStats();
    this.updateStats(agentStats, entry);
    this.aggregatedStats.byAgent.set(entry.agent, agentStats);

    // By model
    const modelStats = this.aggregatedStats.byModel.get(entry.model) || this.initStats();
    this.updateStats(modelStats, entry);
    this.aggregatedStats.byModel.set(entry.model, modelStats);

    // By task type
    const taskStats = this.aggregatedStats.byTaskType.get(entry.taskType) || this.initStats();
    this.updateStats(taskStats, entry);
    this.aggregatedStats.byTaskType.set(entry.taskType, taskStats);

    // By hour
    const hour = new Date(entry.timestamp).toISOString().substring(0, 13);
    const hourStats = this.aggregatedStats.byHour.get(hour) || this.initStats();
    this.updateStats(hourStats, entry);
    this.aggregatedStats.byHour.set(hour, hourStats);

    // By day
    const day = new Date(entry.timestamp).toISOString().substring(0, 10);
    const dayStats = this.aggregatedStats.byDay.get(day) || this.initStats();
    this.updateStats(dayStats, entry);
    this.aggregatedStats.byDay.set(day, dayStats);
  }

  /**
   * Initialize stats object
   * @returns {Object} - Empty stats
   */
  initStats() {
    return {
      count: 0,
      tokens: { input: 0, output: 0, cached: 0, total: 0 },
      cost: { input: 0, output: 0, cached: 0, total: 0 },
      cacheHits: 0
    };
  }

  /**
   * Update stats object
   * @param {Object} stats - Stats to update
   * @param {Object} entry - New entry
   */
  updateStats(stats, entry) {
    stats.count++;
    stats.tokens.input += entry.tokens.input;
    stats.tokens.output += entry.tokens.output;
    stats.tokens.cached += entry.tokens.cached;
    stats.tokens.total += entry.tokens.total;
    stats.cost.input += entry.cost.input;
    stats.cost.output += entry.cost.output;
    stats.cost.cached += entry.cost.cached;
    stats.cost.total += entry.cost.total;
    if (entry.optimization.cached) stats.cacheHits++;
  }

  /**
   * Get comprehensive statistics
   * @param {Object} options - Query options
   * @returns {Object} - Statistics
   */
  getStatistics(options = {}) {
    const period = options.period || 'all'; // 'hour', 'day', 'week', 'all'
    const groupBy = options.groupBy || null; // 'project', 'agent', 'model', 'taskType'

    // Filter entries by period
    const filtered = this.filterByPeriod(this.usageLog, period);

    // Calculate overall stats
    const overall = this.calculateOverallStats(filtered);

    // Group stats if requested
    let grouped = null;
    if (groupBy) {
      grouped = this.groupStats(filtered, groupBy);
    }

    // Calculate trends
    const trends = this.calculateTrends();

    // Calculate efficiency metrics
    const efficiency = this.calculateEfficiencyMetrics(filtered);

    return {
      period,
      overall,
      grouped,
      trends,
      efficiency,
      timestamp: Date.now()
    };
  }

  /**
   * Filter entries by time period
   * @param {Array} entries - All entries
   * @param {string} period - Period to filter
   * @returns {Array} - Filtered entries
   */
  filterByPeriod(entries, period) {
    if (period === 'all') return entries;

    const now = Date.now();
    const periods = {
      hour: 3600000,
      day: 86400000,
      week: 604800000
    };

    const cutoff = now - (periods[period] || 0);
    return entries.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Calculate overall statistics
   * @param {Array} entries - Entries to analyze
   * @returns {Object} - Overall stats
   */
  calculateOverallStats(entries) {
    const stats = this.initStats();

    for (const entry of entries) {
      this.updateStats(stats, entry);
    }

    return {
      ...stats,
      cacheHitRate: stats.count > 0 ? (stats.cacheHits / stats.count) * 100 : 0,
      avgCostPerOperation: stats.count > 0 ? stats.cost.total / stats.count : 0,
      avgTokensPerOperation: stats.count > 0 ? stats.tokens.total / stats.count : 0
    };
  }

  /**
   * Group statistics by dimension
   * @param {Array} entries - Entries to group
   * @param {string} groupBy - Dimension to group by
   * @returns {Object} - Grouped stats
   */
  groupStats(entries, groupBy) {
    const groups = new Map();

    for (const entry of entries) {
      const key = entry[groupBy] || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, this.initStats());
      }
      this.updateStats(groups.get(key), entry);
    }

    // Convert to object and add percentages
    const result = {};
    const totalCost = Array.from(groups.values()).reduce((sum, g) => sum + g.cost.total, 0);

    for (const [key, stats] of groups.entries()) {
      result[key] = {
        ...stats,
        percentage: totalCost > 0 ? (stats.cost.total / totalCost) * 100 : 0
      };
    }

    return result;
  }

  /**
   * Calculate usage trends
   * @returns {Object} - Trend data
   */
  calculateTrends() {
    const hourly = Array.from(this.aggregatedStats.byHour.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-24); // Last 24 hours

    const daily = Array.from(this.aggregatedStats.byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30); // Last 30 days

    return {
      hourly: hourly.map(([time, stats]) => ({
        time,
        tokens: stats.tokens.total,
        cost: stats.cost.total
      })),
      daily: daily.map(([time, stats]) => ({
        time,
        tokens: stats.tokens.total,
        cost: stats.cost.total
      }))
    };
  }

  /**
   * Calculate efficiency metrics
   * @param {Array} entries - Entries to analyze
   * @returns {Object} - Efficiency metrics
   */
  calculateEfficiencyMetrics(entries) {
    if (entries.length === 0) {
      return {
        overallCacheHitRate: 0,
        tokensSavedByCaching: 0,
        costSavedByCaching: 0,
        avgOptimizationLevel: 'standard'
      };
    }

    let cachedTokens = 0;
    let totalInputTokens = 0;
    let optimizationLevels = { standard: 0, moderate: 0, aggressive: 0 };

    for (const entry of entries) {
      cachedTokens += entry.tokens.cached;
      totalInputTokens += entry.tokens.input + entry.tokens.cached;
      optimizationLevels[entry.optimization.budgetLevel]++;
    }

    const cacheHitRate = totalInputTokens > 0 ? (cachedTokens / totalInputTokens) * 100 : 0;
    const tokensSaved = cachedTokens * 0.9; // 90% savings on cached
    const avgCostPerToken = 0.000003; // Approximate
    const costSaved = tokensSaved * avgCostPerToken;

    // Determine most common optimization level
    const maxLevel = Object.entries(optimizationLevels)
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      overallCacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      tokensSavedByCaching: Math.round(tokensSaved),
      costSavedByCaching: parseFloat(costSaved.toFixed(6)),
      avgOptimizationLevel: maxLevel
    };
  }

  /**
   * Export usage data
   * @param {Object} options - Export options
   * @returns {Promise<string>} - Exported data path
   */
  async export(options = {}) {
    const format = options.format || 'json'; // 'json' or 'csv'
    const outputPath = options.outputPath || path.join(__dirname, `usage-export-${Date.now()}.${format}`);

    try {
      const data = this.getStatistics({ period: options.period || 'all' });

      if (format === 'json') {
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      } else if (format === 'csv') {
        const csv = this.convertToCSV(this.usageLog);
        await fs.writeFile(outputPath, csv);
      }

      console.log(`📊 Exported usage data to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to export data: ${error.message}`);
    }
  }

  /**
   * Convert usage log to CSV
   * @param {Array} entries - Usage entries
   * @returns {string} - CSV data
   */
  convertToCSV(entries) {
    const headers = [
      'timestamp',
      'model',
      'agent',
      'project',
      'taskType',
      'inputTokens',
      'outputTokens',
      'cachedTokens',
      'totalTokens',
      'totalCost',
      'cached'
    ];

    const rows = entries.map(e => [
      new Date(e.timestamp).toISOString(),
      e.model,
      e.agent,
      e.project || '',
      e.taskType,
      e.tokens.input,
      e.tokens.output,
      e.tokens.cached,
      e.tokens.total,
      e.cost.total,
      e.optimization.cached
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  /**
   * Save usage data to file
   */
  async saveData() {
    try {
      const data = {
        usageLog: this.usageLog.slice(-1000), // Keep last 1000
        aggregatedStats: {
          byProject: Array.from(this.aggregatedStats.byProject.entries()),
          byAgent: Array.from(this.aggregatedStats.byAgent.entries()),
          byModel: Array.from(this.aggregatedStats.byModel.entries()),
          byTaskType: Array.from(this.aggregatedStats.byTaskType.entries()),
          byHour: Array.from(this.aggregatedStats.byHour.entries()).slice(-168), // Last 7 days
          byDay: Array.from(this.aggregatedStats.byDay.entries()).slice(-90) // Last 90 days
        },
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(this.config.persistPath, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save usage data:', error.message);
    }
  }

  /**
   * Load usage data from file
   */
  async loadData() {
    const data = JSON.parse(await fs.readFile(this.config.persistPath, 'utf8'));

    this.usageLog = data.usageLog || [];
    this.aggregatedStats.byProject = new Map(data.aggregatedStats.byProject || []);
    this.aggregatedStats.byAgent = new Map(data.aggregatedStats.byAgent || []);
    this.aggregatedStats.byModel = new Map(data.aggregatedStats.byModel || []);
    this.aggregatedStats.byTaskType = new Map(data.aggregatedStats.byTaskType || []);
    this.aggregatedStats.byHour = new Map(data.aggregatedStats.byHour || []);
    this.aggregatedStats.byDay = new Map(data.aggregatedStats.byDay || []);

    console.log(`📚 Loaded ${this.usageLog.length} usage entries`);
  }

  /**
   * Start auto-save interval
   */
  startAutoSave() {
    this.saveInterval = setInterval(() => {
      this.saveData();
    }, this.config.saveInterval);
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.saveData(); // Final save
    this.removeAllListeners();
  }
}

module.exports = TokenUsageTracker;
