/**
 * A/B Testing Framework Example
 *
 * Demonstrates how to use the A/B testing framework to compare
 * different optimization strategies and make data-driven decisions.
 *
 * This example compares two model selection strategies:
 * - Control: Current complexity scoring weights
 * - Variant A: More aggressive Haiku usage (lower thresholds)
 * - Variant B: More conservative approach (higher quality)
 */

const ABTestingFramework = require('../ab-testing-framework');

async function runABTestExample() {
  console.log('='.repeat(80));
  console.log('A/B TESTING FRAMEWORK - EXAMPLE');
  console.log('='.repeat(80));

  // Initialize framework
  const abTesting = new ABTestingFramework({
    minSampleSize: 30,
    significanceLevel: 0.05, // 95% confidence
    minEffectSize: 0.1, // 10% improvement required
    autoRollout: true
  });

  // ============================================================================
  // EXPERIMENT 1: Model Selection Strategy
  // ============================================================================

  console.log('\n📋 Creating Experiment: Model Selection Strategy\n');

  const experiment1 = abTesting.createExperiment({
    name: 'Model Selection Strategy',
    description: 'Compare different complexity thresholds for model selection',

    // Control: Current strategy
    control: {
      name: 'Current Strategy',
      haikuThreshold: 2,
      sonnetThreshold: 7,
      weights: {
        requiresReasoning: 2,
        multiStepProcess: 2,
        requiresContext: 1,
        codeGeneration: 2
      }
    },

    // Variants to test
    variants: [
      {
        id: 'aggressive_haiku',
        name: 'Aggressive Haiku',
        configuration: {
          haikuThreshold: 3, // Use Haiku more (higher threshold)
          sonnetThreshold: 8,
          weights: {
            requiresReasoning: 1, // Lower weights = lower complexity scores
            multiStepProcess: 1,
            requiresContext: 1,
            codeGeneration: 1
          }
        }
      },
      {
        id: 'quality_focused',
        name: 'Quality Focused',
        configuration: {
          haikuThreshold: 1, // Use Haiku less (lower threshold)
          sonnetThreshold: 6,
          weights: {
            requiresReasoning: 3, // Higher weights = higher complexity scores
            multiStepProcess: 3,
            requiresContext: 2,
            codeGeneration: 3
          }
        }
      }
    ],

    // Traffic allocation (50% control, 25% each variant)
    trafficAllocation: {
      control: 0.5,
      variants: [0.25, 0.25]
    },

    // Metrics to track
    primaryMetric: 'cost', // Lower is better
    secondaryMetrics: ['quality', 'responseTime', 'successRate'],

    minSampleSize: 30
  });

  // ============================================================================
  // SIMULATE TRAFFIC AND COLLECT SAMPLES
  // ============================================================================

  console.log('\n📊 Simulating Traffic and Collecting Samples...\n');

  // Simulate 100 tasks
  for (let i = 0; i < 100; i++) {
    const contextId = `task_${i}`;

    // Assign variant
    const variant = abTesting.assignVariant(experiment1, contextId);

    // Simulate metrics based on variant
    let metrics;

    if (variant.id === 'control') {
      // Current strategy: balanced
      metrics = {
        cost: 0.010 + Math.random() * 0.005, // $0.010-0.015
        quality: 0.85 + Math.random() * 0.10, // 85-95%
        responseTime: 1000 + Math.random() * 500, // 1000-1500ms
        successRate: 0.90 + Math.random() * 0.08 // 90-98%
      };
    } else if (variant.id === 'aggressive_haiku') {
      // Aggressive Haiku: cheaper but potentially lower quality
      metrics = {
        cost: 0.005 + Math.random() * 0.003, // $0.005-0.008 (40-50% cheaper)
        quality: 0.75 + Math.random() * 0.15, // 75-90% (slightly lower)
        responseTime: 800 + Math.random() * 400, // 800-1200ms (faster)
        successRate: 0.85 + Math.random() * 0.10 // 85-95% (slightly lower)
      };
    } else {
      // Quality focused: more expensive but higher quality
      metrics = {
        cost: 0.015 + Math.random() * 0.008, // $0.015-0.023 (50% more expensive)
        quality: 0.92 + Math.random() * 0.06, // 92-98% (higher quality)
        responseTime: 1200 + Math.random() * 600, // 1200-1800ms (slower)
        successRate: 0.94 + Math.random() * 0.05 // 94-99% (higher)
      };
    }

    // Record sample
    abTesting.recordSample(experiment1, contextId, metrics);

    // Show progress
    if ((i + 1) % 20 === 0) {
      console.log(`   Processed ${i + 1}/100 tasks...`);
    }
  }

  // ============================================================================
  // VIEW EXPERIMENT STATUS
  // ============================================================================

  console.log('\n📈 Experiment Status:\n');

  const status = abTesting.getExperimentStatus(experiment1);
  console.log(JSON.stringify(status, null, 2));

  // ============================================================================
  // MANUAL ANALYSIS (if auto-analysis didn't trigger)
  // ============================================================================

  if (!status.analysis) {
    console.log('\n🔍 Running Manual Analysis...\n');
    abTesting.analyzeExperiment(experiment1);
  }

  // ============================================================================
  // EXPERIMENT 2: Cache Warming Strategy
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('EXPERIMENT 2: Cache Warming Strategy');
  console.log('='.repeat(80));

  const experiment2 = abTesting.createExperiment({
    name: 'Cache Warming Strategy',
    description: 'Compare different cache warming approaches',

    control: {
      name: 'On-Demand Loading',
      strategy: 'lazy',
      warmCommonAgents: false
    },

    variants: [
      {
        id: 'aggressive_warming',
        name: 'Aggressive Warming',
        configuration: {
          strategy: 'eager',
          warmCommonAgents: true,
          warmThreshold: 5 // Warm agents used 5+ times
        }
      }
    ],

    trafficAllocation: {
      control: 0.5,
      variants: [0.5]
    },

    primaryMetric: 'avgResponseTime',
    secondaryMetrics: ['cacheHitRate', 'totalCost'],

    minSampleSize: 25
  });

  // Simulate traffic for experiment 2
  console.log('\n📊 Simulating Traffic for Cache Warming Experiment...\n');

  for (let i = 0; i < 50; i++) {
    const contextId = `cache_task_${i}`;
    const variant = abTesting.assignVariant(experiment2, contextId);

    let metrics;

    if (variant.id === 'control') {
      // On-demand: slower first load, lower cache hit rate
      metrics = {
        avgResponseTime: 1500 + Math.random() * 800, // 1500-2300ms
        cacheHitRate: 0.60 + Math.random() * 0.20, // 60-80%
        totalCost: 0.012 + Math.random() * 0.005 // $0.012-0.017
      };
    } else {
      // Aggressive warming: faster loads, higher cache hit rate
      metrics = {
        avgResponseTime: 800 + Math.random() * 400, // 800-1200ms (40-50% faster)
        cacheHitRate: 0.85 + Math.random() * 0.10, // 85-95% (higher hit rate)
        totalCost: 0.008 + Math.random() * 0.004 // $0.008-0.012 (lower due to caching)
      };
    }

    abTesting.recordSample(experiment2, contextId, metrics);

    if ((i + 1) % 10 === 0) {
      console.log(`   Processed ${i + 1}/50 tasks...`);
    }
  }

  // ============================================================================
  // VIEW ALL EXPERIMENTS
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('ALL EXPERIMENTS SUMMARY');
  console.log('='.repeat(80));

  const allExperiments = abTesting.getAllExperiments();
  console.log('\nAll Experiments:');
  console.log(JSON.stringify(allExperiments, null, 2));

  // ============================================================================
  // FRAMEWORK STATISTICS
  // ============================================================================

  console.log('\n📊 Framework Statistics:\n');

  const stats = abTesting.getStatistics();
  console.log(JSON.stringify(stats, null, 2));

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));

  console.log('\n💡 Based on A/B testing results:\n');

  for (const exp of abTesting.getAllExperiments()) {
    const status = abTesting.getExperimentStatus(exp.id);

    if (status.analysis && status.analysis.recommendation) {
      console.log(`${exp.name}:`);
      console.log(`   ${status.analysis.recommendation}\n`);
    }
  }

  // ============================================================================
  // INTEGRATION WITH MONITORING
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION WITH PERFORMANCE MONITORING');
  console.log('='.repeat(80));

  console.log('\n📡 A/B Testing integrates with Performance Dashboard:');
  console.log('   - Real-time experiment metrics');
  console.log('   - Automated alerts for significant results');
  console.log('   - Historical experiment tracking');
  console.log('   - Rollout success monitoring');
  console.log('   - Continuous optimization feedback loop\n');

  // Example: Listen to events
  abTesting.on('experiment-completed', (data) => {
    console.log(`\n✅ Experiment completed: ${data.experimentId}`);
    console.log(`   Winner: ${data.winner.name}`);
    console.log(`   → Automatically rolled out to production`);
  });

  abTesting.on('variant-rollout', (data) => {
    console.log(`\n🚀 Variant rolled out: ${data.winner.name}`);
    console.log(`   Configuration:`);
    console.log(JSON.stringify(data.winner.configuration, null, 2));
  });

  // ============================================================================
  // BEST PRACTICES
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('A/B TESTING BEST PRACTICES');
  console.log('='.repeat(80));

  console.log(`
📚 Best Practices:

1. **Define Clear Hypotheses**
   - What are you testing?
   - What improvement do you expect?
   - What's the success metric?

2. **Adequate Sample Size**
   - Ensure statistical power (30+ samples minimum)
   - More samples = more confidence
   - Don't stop experiments too early

3. **Primary Metric Focus**
   - Choose ONE primary metric for decisions
   - Use secondary metrics for validation
   - Avoid p-hacking (testing multiple metrics and choosing best)

4. **Traffic Allocation**
   - Start with 50/50 for simple A/B tests
   - Use 50/25/25 for multi-variant tests
   - Adjust based on risk tolerance

5. **Statistical Significance**
   - Require p-value < 0.05 (95% confidence)
   - Require meaningful effect size (>10% improvement)
   - Both conditions must be met

6. **Monitor Secondary Metrics**
   - Ensure no negative side effects
   - Quality shouldn't drop for cost savings
   - Success rate is critical

7. **Auto-Rollout Carefully**
   - Enable for low-risk experiments
   - Disable for critical infrastructure changes
   - Monitor post-rollout performance

8. **Document Results**
   - Track all experiments
   - Learn from failures
   - Build institutional knowledge

9. **Iterate Continuously**
   - Always have experiments running
   - Test incrementally
   - Compound improvements over time

10. **Integration**
    - Feed results to continuous optimization
    - Update dashboards and alerts
    - Share learnings across team
`);

  console.log('\n' + '='.repeat(80));
  console.log('A/B TESTING EXAMPLE COMPLETE');
  console.log('='.repeat(80));
  console.log('\n✅ Framework ready for production use!\n');
}

// Run example
if (require.main === module) {
  runABTestExample().catch(console.error);
}

module.exports = { runABTestExample };
