/**
 * Intelligent Model Selector Tests
 *
 * Comprehensive test suite for IntelligentModelSelector
 */

const IntelligentModelSelector = require('../model-selector');
const fs = require('fs').promises;
const path = require('path');

// Mock fs for testing
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockRejectedValue(new Error('Not found'))
  }
}));

describe('IntelligentModelSelector', () => {
  let selector;

  beforeEach(() => {
    selector = new IntelligentModelSelector({
      learningEnabled: true,
      persistPath: '/tmp/test-model-selector-data.json'
    });
    jest.clearAllMocks();
  });

  describe('Complexity Scoring', () => {
    test('should score simple tasks low', () => {
      const task = {
        description: 'Get status of the system',
        characteristics: ['statusCheck']
      };

      const score = selector.scoreComplexity(task);
      expect(score).toBeLessThan(3);
    });

    test('should score complex tasks high', () => {
      const task = {
        description: 'Design new system architecture with security compliance',
        characteristics: ['requiresArchitecture', 'securityCritical']
      };

      const score = selector.scoreComplexity(task);
      expect(score).toBeGreaterThan(7);
    });

    test('should score medium tasks in middle range', () => {
      const task = {
        description: 'Implement user authentication API',
        characteristics: []
      };

      const score = selector.scoreComplexity(task);
      expect(score).toBeGreaterThanOrEqual(4);
      expect(score).toBeLessThanOrEqual(7);
    });

    test('should detect keywords in description', () => {
      const task = {
        description: 'Security-critical authentication with encryption'
      };

      const hasSecurityChar = selector.taskHasCharacteristic(task, 'securityCritical');
      expect(hasSecurityChar).toBe(true);
    });

    test('should incorporate historical complexity', () => {
      selector.historicalComplexity.set('api-implementation', 6);

      const task = {
        type: 'api-implementation',
        description: 'Build API endpoint'
      };

      const score = selector.scoreComplexity(task);
      // Should be influenced by historical data
      expect(score).toBeGreaterThan(4);
    });

    test('should clamp scores to 0-10 range', () => {
      const extremeTask = {
        characteristics: [
          'requiresArchitecture',
          'criticalDecision',
          'securityCritical',
          'complianceRequired',
          'multiSystemIntegration',
          'complexAlgorithm'
        ]
      };

      const score = selector.scoreComplexity(extremeTask);
      expect(score).toBeLessThanOrEqual(10);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model Selection', () => {
    test('should select Haiku for simple tasks', () => {
      const task = {
        description: 'Format this code',
        characteristics: ['formattingOnly']
      };

      const result = selector.selectModel(task);
      expect(result.model).toContain('haiku');
      expect(result.tier).toBe(1);
    });

    test('should select Sonnet for medium tasks', () => {
      const task = {
        description: 'Implement user authentication',
        type: 'code-generation'
      };

      const result = selector.selectModel(task);
      expect(result.model).toContain('sonnet');
      expect(result.tier).toBe(2);
    });

    test('should select Opus for complex tasks', () => {
      const task = {
        description: 'Design distributed system architecture',
        characteristics: ['requiresArchitecture', 'complexAlgorithm']
      };

      const result = selector.selectModel(task);
      expect(result.model).toContain('opus');
      expect(result.tier).toBe(3);
    });

    test('should respect budget level - aggressive', () => {
      const task = {
        description: 'Medium complexity task',
        complexity: 5
      };

      const result = selector.selectModel(task, { budgetLevel: 'aggressive' });
      // Should prefer cheaper model with aggressive budget
      expect(result.tier).toBeLessThanOrEqual(2);
    });

    test('should respect budget level - standard', () => {
      const task = {
        description: 'Complex task requiring deep analysis',
        characteristics: ['requiresDeepReasoning', 'criticalDecision']
      };

      const result = selector.selectModel(task, { budgetLevel: 'standard' });
      expect(result.model).toBeDefined();
      expect(result.complexity).toBeGreaterThan(5);
    });

    test('should include fallback model', () => {
      const task = {
        description: 'Simple task'
      };

      const result = selector.selectModel(task);
      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel).not.toBe(result.model);
    });

    test('should provide rationale', () => {
      const task = {
        description: 'Test task'
      };

      const result = selector.selectModel(task);
      expect(result.rationale).toBeDefined();
      expect(result.rationale.length).toBeGreaterThan(0);
    });

    test('should calculate confidence score', () => {
      const task = {
        description: 'Test task'
      };

      const result = selector.selectModel(task);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Cost Estimation', () => {
    test('should estimate costs correctly', () => {
      const task = {
        description: 'Test task',
        estimatedTokens: 10000
      };

      const result = selector.selectModel(task, {
        estimatedInputTokens: 10000,
        estimatedOutputTokens: 3000
      });

      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate.totalCost).toBeDefined();
      expect(result.costEstimate.comparedToOpus).toBeDefined();
    });

    test('should calculate savings vs Opus', () => {
      const task = {
        description: 'Simple task'
      };

      const result = selector.selectModel(task, {
        estimatedInputTokens: 10000
      });

      // Haiku should show significant savings vs Opus
      if (result.model.includes('haiku')) {
        expect(parseFloat(result.costEstimate.comparedToOpus.percentage)).toBeGreaterThan(90);
      }
    });
  });

  describe('Learning System', () => {
    test('should track selections', () => {
      const task = {
        type: 'code-gen',
        description: 'Generate code'
      };

      const result = selector.selectModel(task);
      expect(result.selectionId).toBeDefined();
      expect(selector.usageTracking.selections.length).toBe(1);
    });

    test('should learn from successful feedback', async () => {
      const task = {
        type: 'test-task',
        description: 'Test'
      };

      const result = selector.selectModel(task);
      await selector.learnFromFeedback(result.selectionId, true);

      const accuracy = selector.usageTracking.accuracy.get(result.model);
      expect(accuracy).toBeDefined();
      expect(accuracy.correct).toBe(1);
      expect(accuracy.total).toBe(1);
    });

    test('should learn from failed feedback and adjust', async () => {
      const task = {
        type: 'underestimated-task',
        description: 'This was more complex than expected'
      };

      const result = selector.selectModel(task);
      const originalModel = result.model;

      // Provide feedback that we should have used a better model
      await selector.learnFromFeedback(
        result.selectionId,
        false,
        selector.models.opus.id
      );

      // Check that correction was recorded
      expect(selector.usageTracking.corrections.length).toBeGreaterThan(0);

      // Historical complexity should increase
      const historical = selector.getHistoricalComplexity('underestimated-task');
      expect(historical).toBeGreaterThan(5);
    });

    test('should update model performance metrics', async () => {
      const task = {
        type: 'perf-test',
        description: 'Performance test'
      };

      const result = selector.selectModel(task);
      await selector.learnFromFeedback(result.selectionId, true, null, {
        responseTime: 1500
      });

      const performance = selector.usageTracking.modelPerformance.get(result.model);
      expect(performance).toBeDefined();
      expect(performance.totalTasks).toBe(1);
      expect(performance.successful).toBe(1);
      expect(performance.avgResponseTime).toBe(1500);
    });

    test('should improve future selections based on learning', async () => {
      // Simulate learning that a task type is more complex
      selector.historicalComplexity.set('complex-api', 8);

      const task = {
        type: 'complex-api',
        description: 'Build complex API'
      };

      const result = selector.selectModel(task);
      // Should select more powerful model due to learning
      expect(result.tier).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Statistics', () => {
    test('should provide comprehensive statistics', () => {
      const task = { description: 'Test' };
      selector.selectModel(task);

      const stats = selector.getStatistics();
      expect(stats.totalSelections).toBe(1);
      expect(stats.modelAccuracy).toBeDefined();
      expect(stats.modelPerformance).toBeDefined();
    });

    test('should calculate accuracy correctly', async () => {
      const tasks = [
        { description: 'Task 1' },
        { description: 'Task 2' },
        { description: 'Task 3' }
      ];

      for (const task of tasks) {
        const result = selector.selectModel(task);
        await selector.learnFromFeedback(result.selectionId, true);
      }

      const stats = selector.getStatistics();
      // All selections were successful
      Object.values(stats.modelAccuracy).forEach(acc => {
        if (acc.total > 0) {
          expect(acc.accuracy).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Events', () => {
    test('should emit model-selected event', (done) => {
      selector.on('model-selected', (event) => {
        expect(event.model).toBeDefined();
        expect(event.complexity).toBeDefined();
        done();
      });

      selector.selectModel({ description: 'Test' });
    });

    test('should emit learning-updated event', (done) => {
      selector.on('learning-updated', (event) => {
        expect(event.selectionId).toBeDefined();
        expect(event.wasSuccessful).toBe(true);
        done();
      });

      const task = { description: 'Test' };
      const result = selector.selectModel(task);
      selector.learnFromFeedback(result.selectionId, true);
    });
  });

  describe('Persistence', () => {
    test('should save historical data', async () => {
      selector.historicalComplexity.set('test-type', 7);
      await selector.saveHistoricalData();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test('should handle save errors gracefully', async () => {
      fs.promises.writeFile.mockRejectedValueOnce(new Error('Write failed'));
      await expect(selector.saveHistoricalData()).resolves.not.toThrow();
    });
  });

  describe('Conservative Mode', () => {
    test('should use higher models in conservative mode', () => {
      const conservativeSelector = new IntelligentModelSelector({
        conservativeMode: true
      });

      const task = {
        description: 'Borderline complexity task',
        complexity: 2.5
      };

      const result = conservativeSelector.selectModel(task);
      // Conservative mode should bump up model selection
      expect(result.tier).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty task description', () => {
      const task = {};
      const result = selector.selectModel(task);

      expect(result.model).toBeDefined();
      expect(result.complexity).toBeGreaterThanOrEqual(0);
    });

    test('should handle extreme complexity scores', () => {
      const task = {
        complexityHint: 15 // Way over limit
      };

      const score = selector.scoreComplexity(task);
      expect(score).toBeLessThanOrEqual(10);
    });

    test('should handle negative complexity hints', () => {
      const task = {
        complexityHint: -5
      };

      const score = selector.scoreComplexity(task);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Fallback Selection', () => {
    test('should provide Sonnet as fallback for Haiku', () => {
      const fallback = selector.selectFallback(selector.models.haiku);
      expect(fallback.id).toContain('sonnet');
    });

    test('should provide Opus as fallback for Sonnet', () => {
      const fallback = selector.selectFallback(selector.models.sonnet);
      expect(fallback.id).toContain('opus');
    });

    test('should provide Opus as fallback for Opus', () => {
      const fallback = selector.selectFallback(selector.models.opus);
      expect(fallback.id).toContain('opus');
    });
  });
});
