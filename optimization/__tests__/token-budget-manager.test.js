/**
 * Token Budget Manager Tests
 *
 * Comprehensive test suite for TokenBudgetManager
 */

const TokenBudgetManager = require('../token-budget-manager');

describe('TokenBudgetManager', () => {
  let budgetManager;

  beforeEach(() => {
    budgetManager = new TokenBudgetManager({
      hourlyBudget: 10000,
      dailyBudget: 100000,
      weeklyBudget: 500000,
      projectBudget: 50000
    });
  });

  afterEach(() => {
    budgetManager.destroy();
  });

  describe('Budget Tracking', () => {
    test('should allow tokens within budget', async () => {
      const result = await budgetManager.requestTokens(5000, {
        task: 'test-task',
        model: 'claude-sonnet'
      });

      expect(result.allowed).toBe(true);
      expect(result.tokens).toBe(5000);
      expect(result.optimization).toBe('standard');
    });

    test('should block tokens exceeding hourly budget', async () => {
      const result = await budgetManager.requestTokens(15000, {
        task: 'test-task'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('budget-exceeded');
      expect(result.period).toBe('hour');
    });

    test('should track cumulative usage', async () => {
      await budgetManager.requestTokens(3000);
      await budgetManager.requestTokens(2000);
      await budgetManager.requestTokens(1000);

      const stats = budgetManager.getStatistics();
      expect(stats.usage.hour).toBe(6000);
      expect(stats.usage.session).toBe(6000);
    });

    test('should track project-specific budgets', async () => {
      await budgetManager.requestTokens(20000, { projectId: 'project-1' });
      await budgetManager.requestTokens(25000, { projectId: 'project-1' });

      const result = await budgetManager.requestTokens(10000, { projectId: 'project-1' });

      expect(result.allowed).toBe(false);
      expect(result.period).toBe('project');
    });
  });

  describe('Optimization Levels', () => {
    test('should start at standard optimization level', () => {
      expect(budgetManager.optimizationLevel).toBe('standard');
    });

    test('should switch to moderate at 70% usage', async () => {
      await budgetManager.requestTokens(7000); // 70% of 10000

      expect(budgetManager.optimizationLevel).toBe('moderate');
    });

    test('should switch to aggressive at 85% usage', async () => {
      await budgetManager.requestTokens(8500); // 85% of 10000

      expect(budgetManager.optimizationLevel).toBe('aggressive');
    });

    test('should emit event when optimization level changes', async () => {
      const events = [];
      budgetManager.on('optimization-level-changed', (event) => {
        events.push(event);
      });

      await budgetManager.requestTokens(7000); // moderate
      await budgetManager.requestTokens(1500); // aggressive (total 8500)

      expect(events.length).toBe(2);
      expect(events[0].to).toBe('moderate');
      expect(events[1].to).toBe('aggressive');
    });
  });

  describe('Alerts', () => {
    test('should emit warning alert at 70% usage', async () => {
      const alerts = [];
      budgetManager.on('budget-alert', (alert) => {
        alerts.push(alert);
      });

      await budgetManager.requestTokens(7000);

      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].period).toBe('hour');
    });

    test('should emit aggressive alert at 85% usage', async () => {
      const alerts = [];
      budgetManager.on('budget-alert', (alert) => {
        alerts.push(alert);
      });

      await budgetManager.requestTokens(8500);

      const aggressiveAlert = alerts.find(a => a.level === 'aggressive');
      expect(aggressiveAlert).toBeDefined();
    });

    test('should not spam alerts for same period', async () => {
      const alerts = [];
      budgetManager.on('budget-alert', (alert) => {
        alerts.push(alert);
      });

      await budgetManager.requestTokens(7000);
      await budgetManager.requestTokens(100);
      await budgetManager.requestTokens(100);

      const warningAlerts = alerts.filter(a => a.level === 'warning');
      expect(warningAlerts.length).toBe(1); // Should only alert once
    });
  });

  describe('Optimization Strategies', () => {
    test('should suggest model downgrade for optimization', async () => {
      const result = await budgetManager.optimizeRequest(5000, {
        model: 'claude-opus',
        canCompressContext: true
      });

      expect(result.tokens).toBeLessThan(5000);
      expect(result.strategies).toContain('switch-to-sonnet');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should calculate token savings correctly', async () => {
      const result = await budgetManager.optimizeRequest(10000, {
        model: 'claude-opus',
        canCompressContext: true,
        hasCacheableContent: true
      });

      expect(result.reduction).toBe(10000 - result.tokens);
      expect(result.reduction).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    test('should track total requests', async () => {
      await budgetManager.requestTokens(1000);
      await budgetManager.requestTokens(2000);
      await budgetManager.requestTokens(3000);

      const stats = budgetManager.getStatistics();
      expect(stats.stats.totalRequests).toBe(3);
    });

    test('should track blocked requests', async () => {
      await budgetManager.requestTokens(15000); // Will be blocked

      const stats = budgetManager.getStatistics();
      expect(stats.stats.blockedRequests).toBeGreaterThan(0);
    });

    test('should calculate remaining budgets', () => {
      const remaining = budgetManager.getRemainingBudgets();

      expect(remaining.hour).toBe(10000);
      expect(remaining.day).toBe(100000);
      expect(remaining.week).toBe(500000);
    });
  });

  describe('Usage Events', () => {
    test('should emit usage-recorded event', async () => {
      const events = [];
      budgetManager.on('usage-recorded', (event) => {
        events.push(event);
      });

      await budgetManager.requestTokens(2000, {
        task: 'test-task',
        agent: 'test-agent'
      });

      expect(events.length).toBe(1);
      expect(events[0].amount).toBe(2000);
      expect(events[0].context.task).toBe('test-task');
      expect(events[0].context.agent).toBe('test-agent');
    });

    test('should emit budget-exceeded event', async () => {
      const events = [];
      budgetManager.on('budget-exceeded', (event) => {
        events.push(event);
      });

      await budgetManager.requestTokens(20000); // Over hourly budget

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].requested).toBe(20000);
      expect(events[0].period).toBe('hour');
    });
  });

  describe('Session Management', () => {
    test('should reset session statistics', async () => {
      await budgetManager.requestTokens(5000);
      expect(budgetManager.usage.current.session).toBe(5000);

      budgetManager.resetSession();
      expect(budgetManager.usage.current.session).toBe(0);
      expect(budgetManager.usage.history.length).toBe(0);
    });

    test('should maintain period statistics after session reset', async () => {
      await budgetManager.requestTokens(5000);
      budgetManager.resetSession();

      expect(budgetManager.usage.current.hour).toBe(5000); // Not reset
      expect(budgetManager.usage.current.session).toBe(0); // Reset
    });
  });

  describe('Optimization Suggestions', () => {
    test('should provide suggestions when approaching limits', async () => {
      await budgetManager.requestTokens(6000); // 60% of hourly

      const suggestions = budgetManager.getOptimizationSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('general');
    });

    test('should provide urgent suggestions at high usage', async () => {
      await budgetManager.requestTokens(8000); // 80% of hourly

      const suggestions = budgetManager.getOptimizationSuggestions();
      const urgentSuggestion = suggestions.find(s => s.type === 'urgent');
      expect(urgentSuggestion).toBeDefined();
    });
  });
});
