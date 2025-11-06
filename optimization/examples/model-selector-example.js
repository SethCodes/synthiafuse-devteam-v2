/**
 * Intelligent Model Selector - Usage Example
 *
 * Demonstrates how to use the IntelligentModelSelector for optimal
 * model selection and cost savings
 */

const IntelligentModelSelector = require('../model-selector');

async function main() {
  console.log('🚀 Intelligent Model Selector Example\n');

  // Initialize selector
  const selector = new IntelligentModelSelector({
    conservativeMode: false,
    learningEnabled: true
  });

  // Listen to events
  selector.on('model-selected', (event) => {
    console.log(`\n✅ Model Selected: ${event.modelName}`);
    console.log(`   Complexity: ${event.complexity.toFixed(1)}/10`);
    console.log(`   Confidence: ${(event.confidence * 100).toFixed(1)}%`);
    console.log(`   Cost: $${event.costEstimate.totalCost}`);
    console.log(`   Savings vs Opus: ${event.costEstimate.comparedToOpus.percentage}%`);
  });

  selector.on('learning-updated', (event) => {
    console.log(`\n📚 Learning Updated: ${event.taskType} - ${event.wasSuccessful ? 'Success' : 'Failed'}`);
  });

  // Example 1: Simple task → Should use Haiku
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 1: Simple Status Check');
  console.log('═══════════════════════════════════════════════');
  const result1 = selector.selectModel({
    type: 'status-check',
    description: 'Check the status of the deployment',
    characteristics: ['statusCheck']
  }, {
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 200
  });
  console.log('Rationale:', result1.rationale);

  // Example 2: Medium task → Should use Sonnet
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 2: Code Generation');
  console.log('═══════════════════════════════════════════════');
  const result2 = selector.selectModel({
    type: 'code-generation',
    description: 'Implement user authentication API with JWT',
    characteristics: []
  }, {
    estimatedInputTokens: 5000,
    estimatedOutputTokens: 2000
  });
  console.log('Rationale:', result2.rationale);

  // Example 3: Complex task → Should use Opus
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 3: System Architecture');
  console.log('═══════════════════════════════════════════════');
  const result3 = selector.selectModel({
    type: 'architecture-design',
    description: 'Design distributed microservices architecture with security compliance (GDPR, HIPAA)',
    characteristics: ['requiresArchitecture', 'securityCritical', 'complianceRequired']
  }, {
    estimatedInputTokens: 10000,
    estimatedOutputTokens: 5000
  });
  console.log('Rationale:', result3.rationale);

  // Example 4: Budget-aware selection
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 4: Budget-Aware Selection (Aggressive)');
  console.log('═══════════════════════════════════════════════');
  const result4 = selector.selectModel({
    type: 'refactoring',
    description: 'Refactor legacy code for better maintainability',
    characteristics: []
  }, {
    budgetLevel: 'aggressive',
    estimatedInputTokens: 8000
  });
  console.log('Rationale:', result4.rationale);
  console.log('Note: Aggressive budget mode prefers cheaper models');

  // Example 5: Learning from feedback
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 5: Learning from Feedback');
  console.log('═══════════════════════════════════════════════');

  // Task that succeeded
  const result5 = selector.selectModel({
    type: 'bug-fix',
    description: 'Fix null pointer exception in payment processing'
  });
  await selector.learnFromFeedback(result5.selectionId, true, null, {
    responseTime: 2000,
    quality: 'high'
  });

  // Task that failed - model was too simple
  const result6 = selector.selectModel({
    type: 'complex-algorithm',
    description: 'Implement graph traversal algorithm'
  });
  console.log(`Initial selection: ${result6.modelName}`);
  await selector.learnFromFeedback(
    result6.selectionId,
    false,
    selector.models.opus.id, // Should have used Opus
    {
      reason: 'Algorithm too complex for selected model'
    }
  );

  // Try same task type again - should learn
  const result7 = selector.selectModel({
    type: 'complex-algorithm',
    description: 'Implement another graph algorithm'
  });
  console.log(`After learning: ${result7.modelName} (should be higher tier)`);

  // Example 6: Statistics
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 6: Performance Statistics');
  console.log('═══════════════════════════════════════════════');
  const stats = selector.getStatistics();
  console.log('Total Selections:', stats.totalSelections);
  console.log('Corrections:', stats.corrections);
  console.log('\nModel Accuracy:');
  for (const [model, accuracy] of Object.entries(stats.modelAccuracy)) {
    if (accuracy.total > 0) {
      console.log(`  ${model}: ${accuracy.accuracy.toFixed(1)}% (${accuracy.correct}/${accuracy.total})`);
    }
  }

  console.log('\nModel Performance:');
  for (const [model, perf] of Object.entries(stats.modelPerformance)) {
    if (perf.totalTasks > 0) {
      console.log(`  ${model}:`);
      console.log(`    Success Rate: ${perf.successRate.toFixed(1)}%`);
      console.log(`    Avg Response Time: ${perf.avgResponseTime.toFixed(0)}ms`);
    }
  }

  // Example 7: Cost Comparison
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 7: Cost Comparison for 100 Tasks');
  console.log('═══════════════════════════════════════════════');

  const tasks = [
    { type: 'simple', count: 40, tokens: 1000 },
    { type: 'medium', count: 50, tokens: 5000 },
    { type: 'complex', count: 10, tokens: 10000 }
  ];

  let totalCostOptimized = 0;
  let totalCostAllOpus = 0;

  for (const taskGroup of tasks) {
    for (let i = 0; i < taskGroup.count; i++) {
      const result = selector.selectModel({
        type: taskGroup.type,
        description: `${taskGroup.type} task`
      }, {
        estimatedInputTokens: taskGroup.tokens,
        estimatedOutputTokens: taskGroup.tokens * 0.3
      });

      totalCostOptimized += parseFloat(result.costEstimate.totalCost);
    }

    // Calculate if all were Opus
    const opusCost = (taskGroup.tokens / 1000000) * 15 + ((taskGroup.tokens * 0.3) / 1000000) * 75;
    totalCostAllOpus += opusCost * taskGroup.count;
  }

  console.log(`\nOptimized Selection: $${totalCostOptimized.toFixed(4)}`);
  console.log(`All Opus (no optimization): $${totalCostAllOpus.toFixed(4)}`);
  console.log(`Savings: $${(totalCostAllOpus - totalCostOptimized).toFixed(4)} (${((1 - totalCostOptimized/totalCostAllOpus) * 100).toFixed(1)}%)`);

  console.log('\n✅ Example complete!\n');
  console.log('💡 Key Takeaways:');
  console.log('   • Haiku for simple tasks: 90%+ cost savings');
  console.log('   • Sonnet for most work: Good balance of cost/quality');
  console.log('   • Opus only for critical tasks: Use sparingly');
  console.log('   • Learning improves over time: Gets smarter with feedback');
  console.log('   • 40-60% overall cost reduction possible!');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
