/**
 * Token Budget Manager
 *
 * Tracks, limits, and optimizes token usage across all operations to prevent
 * runaway costs and enable aggressive optimization when approaching limits.
 *
 * Features:
 * - Multi-level budget tracking (hourly, daily, weekly, project)
 * - Alert thresholds (70%, 85%, 100%)
 * - Hard limit enforcement with graceful degradation
 * - Aggressive optimization mode
 * - Comprehensive metrics and logging
 *
 * @module TokenBudgetManager
 */

const EventEmitter = require('events');

class TokenBudgetManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Budget limits (configurable)
    this.budgets = {
      hourly: options.hourlyBudget || 50000,      // 50k tokens/hour
      daily: options.dailyBudget || 500000,       // 500k tokens/day
      weekly: options.weeklyBudget || 3000000,    // 3M tokens/week
      project: options.projectBudget || 1000000   // 1M tokens/project
    };

    // Current usage tracking
    this.usage = {
      current: {
        hour: 0,
        day: 0,
        week: 0,
        session: 0
      },
      history: [],
      projects: new Map(),
      startTime: {
        hour: Date.now(),
        day: Date.now(),
        week: Date.now(),
        session: Date.now()
      }
    };

    // Alert thresholds
    this.thresholds = {
      warning: options.warningThreshold || 0.70,      // 70% usage warning
      aggressive: options.aggressiveThreshold || 0.85, // 85% enable aggressive optimization
      limit: 1.0                                       // 100% hard limit
    };

    // Current optimization level
    this.optimizationLevel = 'standard'; // 'standard', 'moderate', 'aggressive'

    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      optimizedRequests: 0,
      tokensSaved: 0,
      alerts: []
    };

    // Auto-reset timers
    this.startAutoReset();
  }

  /**
   * Request tokens for an operation
   * @param {number} amount - Number of tokens requested
   * @param {Object} context - Operation context (task, model, agent, project)
   * @returns {Promise<Object>} - Authorization result with optimization suggestions
   */
  async requestTokens(amount, context = {}) {
    this.stats.totalRequests++;

    // Check time-based resets
    this.checkAndResetPeriods();

    // Check budget availability
    const availability = this.checkAvailability(amount, context);

    if (!availability.allowed) {
      this.stats.blockedRequests++;

      // Try optimization strategies
      const optimized = await this.optimizeRequest(amount, context);

      if (optimized.tokens < amount) {
        console.log(`💰 Budget optimization: ${amount} → ${optimized.tokens} tokens (${Math.round((1 - optimized.tokens/amount) * 100)}% reduction)`);
        this.stats.optimizedRequests++;
        this.stats.tokensSaved += (amount - optimized.tokens);

        // Recurse with optimized amount
        return await this.requestTokens(optimized.tokens, {
          ...context,
          optimized: true,
          originalAmount: amount
        });
      }

      // Still over budget even after optimization
      this.emit('budget-exceeded', {
        requested: amount,
        available: availability.available,
        period: availability.limitingPeriod
      });

      return {
        allowed: false,
        reason: 'budget-exceeded',
        requested: amount,
        available: availability.available,
        period: availability.limitingPeriod,
        optimizationSuggestions: optimized.suggestions
      };
    }

    // Record usage
    await this.recordUsage(amount, context);

    // Adjust optimization level based on usage
    this.adjustOptimizationLevel();

    // Check if alerts should be triggered
    this.checkThresholds(context);

    return {
      allowed: true,
      tokens: amount,
      optimization: this.optimizationLevel,
      remaining: this.getRemainingBudgets(),
      suggestions: this.getOptimizationSuggestions()
    };
  }

  /**
   * Check if tokens are available within budgets
   * @param {number} amount - Tokens requested
   * @param {Object} context - Request context
   * @returns {Object} - Availability status
   */
  checkAvailability(amount, context) {
    const periods = ['hour', 'day', 'week'];

    for (const period of periods) {
      const budgetKey = period === 'hour' ? 'hourly' : period === 'day' ? 'daily' : 'weekly';
      const limit = this.budgets[budgetKey];
      const current = this.usage.current[period];
      const available = limit - current;

      if (amount > available) {
        return {
          allowed: false,
          available: available,
          limit: limit,
          current: current,
          limitingPeriod: period
        };
      }
    }

    // Check project budget if applicable
    if (context.projectId) {
      const projectUsage = this.usage.projects.get(context.projectId) || 0;
      const projectLimit = this.budgets.project;
      const projectAvailable = projectLimit - projectUsage;

      if (amount > projectAvailable) {
        return {
          allowed: false,
          available: projectAvailable,
          limit: projectLimit,
          current: projectUsage,
          limitingPeriod: 'project'
        };
      }
    }

    return {
      allowed: true,
      available: Infinity
    };
  }

  /**
   * Record token usage
   * @param {number} amount - Tokens used
   * @param {Object} context - Operation context
   */
  async recordUsage(amount, context) {
    const timestamp = Date.now();

    // Update current usage
    this.usage.current.hour += amount;
    this.usage.current.day += amount;
    this.usage.current.week += amount;
    this.usage.current.session += amount;

    // Update project usage if applicable
    if (context.projectId) {
      const current = this.usage.projects.get(context.projectId) || 0;
      this.usage.projects.set(context.projectId, current + amount);
    }

    // Add to history
    this.usage.history.push({
      timestamp,
      amount,
      context: {
        task: context.task || 'unknown',
        model: context.model || 'unknown',
        agent: context.agent || 'unknown',
        project: context.projectId || null,
        optimized: context.optimized || false,
        optimizationLevel: this.optimizationLevel
      }
    });

    // Emit usage event
    this.emit('usage-recorded', {
      amount,
      total: this.usage.current.session,
      context
    });
  }

  /**
   * Adjust optimization level based on current usage
   */
  adjustOptimizationLevel() {
    // Calculate usage percentage for most restrictive period
    const usagePercentages = {
      hour: this.usage.current.hour / this.budgets.hourly,
      day: this.usage.current.day / this.budgets.daily,
      week: this.usage.current.week / this.budgets.weekly
    };

    const maxUsage = Math.max(...Object.values(usagePercentages));

    const previousLevel = this.optimizationLevel;

    if (maxUsage > this.thresholds.aggressive) {
      this.optimizationLevel = 'aggressive';
    } else if (maxUsage > this.thresholds.warning) {
      this.optimizationLevel = 'moderate';
    } else {
      this.optimizationLevel = 'standard';
    }

    // Emit event if level changed
    if (previousLevel !== this.optimizationLevel) {
      this.emit('optimization-level-changed', {
        from: previousLevel,
        to: this.optimizationLevel,
        usage: maxUsage,
        reason: maxUsage > this.thresholds.aggressive ? 'approaching-limit' :
                maxUsage > this.thresholds.warning ? 'moderate-usage' : 'normal-usage'
      });

      console.log(`📊 Optimization level changed: ${previousLevel} → ${this.optimizationLevel} (${Math.round(maxUsage * 100)}% usage)`);
    }
  }

  /**
   * Optimize request to reduce token usage
   * @param {number} amount - Original token amount
   * @param {Object} context - Request context
   * @returns {Promise<Object>} - Optimized request
   */
  async optimizeRequest(amount, context) {
    const strategies = [];
    let optimizedAmount = amount;

    // Strategy 1: Use smaller model if possible
    if (context.model && context.model.includes('opus')) {
      strategies.push('switch-to-sonnet');
      optimizedAmount *= 0.5; // Rough estimate
    } else if (context.model && context.model.includes('sonnet')) {
      strategies.push('switch-to-haiku');
      optimizedAmount *= 0.2; // Rough estimate
    }

    // Strategy 2: Compress context
    if (context.canCompressContext) {
      strategies.push('compress-context');
      optimizedAmount *= 0.7; // 30% reduction through compression
    }

    // Strategy 3: Use cached content more aggressively
    if (context.hasCacheableContent) {
      strategies.push('aggressive-caching');
      optimizedAmount *= 0.5; // 50% reduction through caching
    }

    // Strategy 4: Reduce context window
    if (optimizedAmount > this.budgets.hourly * 0.1) {
      strategies.push('reduce-context-window');
      optimizedAmount *= 0.8; // 20% reduction
    }

    return {
      tokens: Math.floor(optimizedAmount),
      originalTokens: amount,
      reduction: amount - Math.floor(optimizedAmount),
      strategies: strategies,
      suggestions: this.generateOptimizationSuggestions(strategies, context)
    };
  }

  /**
   * Generate optimization suggestions
   * @param {Array} strategies - Applied strategies
   * @param {Object} context - Request context
   * @returns {Array} - Suggestions for developer
   */
  generateOptimizationSuggestions(strategies, context) {
    const suggestions = [];

    if (strategies.includes('switch-to-sonnet') || strategies.includes('switch-to-haiku')) {
      suggestions.push({
        type: 'model-downgrade',
        message: 'Consider using a smaller model (Haiku/Sonnet) for this task',
        impact: 'high',
        savings: '50-80%'
      });
    }

    if (strategies.includes('compress-context')) {
      suggestions.push({
        type: 'context-compression',
        message: 'Context can be compressed or summarized',
        impact: 'medium',
        savings: '20-40%'
      });
    }

    if (strategies.includes('aggressive-caching')) {
      suggestions.push({
        type: 'caching',
        message: 'More content can be cached to reduce repeat costs',
        impact: 'high',
        savings: '50-90%'
      });
    }

    if (strategies.includes('reduce-context-window')) {
      suggestions.push({
        type: 'context-reduction',
        message: 'Load only essential context, not full project',
        impact: 'medium',
        savings: '20-30%'
      });
    }

    return suggestions;
  }

  /**
   * Check thresholds and emit alerts
   * @param {Object} context - Current context
   */
  checkThresholds(context) {
    const usagePercentages = {
      hour: this.usage.current.hour / this.budgets.hourly,
      day: this.usage.current.day / this.budgets.daily,
      week: this.usage.current.week / this.budgets.weekly
    };

    for (const [period, percentage] of Object.entries(usagePercentages)) {
      if (percentage >= this.thresholds.warning && percentage < this.thresholds.aggressive) {
        this.emitAlert('warning', period, percentage);
      } else if (percentage >= this.thresholds.aggressive && percentage < this.thresholds.limit) {
        this.emitAlert('aggressive', period, percentage);
      } else if (percentage >= this.thresholds.limit) {
        this.emitAlert('limit', period, percentage);
      }
    }
  }

  /**
   * Emit budget alert
   * @param {string} level - Alert level (warning, aggressive, limit)
   * @param {string} period - Time period
   * @param {number} percentage - Usage percentage
   */
  emitAlert(level, period, percentage) {
    const alert = {
      level,
      period,
      percentage,
      timestamp: Date.now(),
      current: this.usage.current[period],
      limit: this.budgets[period === 'hour' ? 'hourly' : period === 'day' ? 'daily' : 'weekly']
    };

    // Only emit if we haven't alerted recently for this period
    const recentAlert = this.stats.alerts.find(a =>
      a.period === period &&
      a.level === level &&
      Date.now() - a.timestamp < 300000 // 5 minutes
    );

    if (!recentAlert) {
      this.stats.alerts.push(alert);
      this.emit('budget-alert', alert);

      const emoji = level === 'limit' ? '🚨' : level === 'aggressive' ? '⚠️' : '💡';
      console.log(`${emoji} Budget Alert: ${Math.round(percentage * 100)}% of ${period}ly budget used (${level})`);
    }
  }

  /**
   * Get remaining budgets
   * @returns {Object} - Remaining tokens for each period
   */
  getRemainingBudgets() {
    return {
      hour: this.budgets.hourly - this.usage.current.hour,
      day: this.budgets.daily - this.usage.current.day,
      week: this.budgets.weekly - this.usage.current.week
    };
  }

  /**
   * Get optimization suggestions based on current usage
   * @returns {Array} - Optimization suggestions
   */
  getOptimizationSuggestions() {
    const suggestions = [];
    const usagePercentage = this.usage.current.hour / this.budgets.hourly;

    if (usagePercentage > 0.5) {
      suggestions.push({
        type: 'general',
        message: 'Consider enabling cache warming for frequently used agents',
        impact: 'high'
      });
    }

    if (usagePercentage > 0.7) {
      suggestions.push({
        type: 'urgent',
        message: 'Review recent operations for optimization opportunities',
        impact: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Check and reset time-based periods
   */
  checkAndResetPeriods() {
    const now = Date.now();
    const hour = 3600000;  // 1 hour in ms
    const day = 86400000;  // 1 day in ms
    const week = 604800000; // 1 week in ms

    // Reset hourly
    if (now - this.usage.startTime.hour >= hour) {
      console.log(`🔄 Resetting hourly budget (used: ${this.usage.current.hour.toLocaleString()} tokens)`);
      this.usage.current.hour = 0;
      this.usage.startTime.hour = now;
    }

    // Reset daily
    if (now - this.usage.startTime.day >= day) {
      console.log(`🔄 Resetting daily budget (used: ${this.usage.current.day.toLocaleString()} tokens)`);
      this.usage.current.day = 0;
      this.usage.startTime.day = now;
    }

    // Reset weekly
    if (now - this.usage.startTime.week >= week) {
      console.log(`🔄 Resetting weekly budget (used: ${this.usage.current.week.toLocaleString()} tokens)`);
      this.usage.current.week = 0;
      this.usage.startTime.week = now;
    }
  }

  /**
   * Start auto-reset timers
   */
  startAutoReset() {
    // Check every minute
    this.resetInterval = setInterval(() => {
      this.checkAndResetPeriods();
    }, 60000);
  }

  /**
   * Get current statistics
   * @returns {Object} - Usage statistics
   */
  getStatistics() {
    return {
      usage: {
        hour: this.usage.current.hour,
        day: this.usage.current.day,
        week: this.usage.current.week,
        session: this.usage.current.session
      },
      budgets: this.budgets,
      remaining: this.getRemainingBudgets(),
      optimizationLevel: this.optimizationLevel,
      stats: {
        totalRequests: this.stats.totalRequests,
        blockedRequests: this.stats.blockedRequests,
        optimizedRequests: this.stats.optimizedRequests,
        tokensSaved: this.stats.tokensSaved,
        blockRate: this.stats.blockedRequests / this.stats.totalRequests,
        optimizationRate: this.stats.optimizedRequests / this.stats.totalRequests
      },
      alerts: this.stats.alerts.slice(-10) // Last 10 alerts
    };
  }

  /**
   * Reset session statistics
   */
  resetSession() {
    this.usage.current.session = 0;
    this.usage.startTime.session = Date.now();
    this.usage.history = [];
    console.log('🔄 Session statistics reset');
  }

  /**
   * Cleanup and stop auto-reset
   */
  destroy() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = TokenBudgetManager;
