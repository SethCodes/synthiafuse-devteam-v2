/**
 * Token Budget Manager - Usage Example
 *
 * Demonstrates how to use the TokenBudgetManager in your application
 */

const TokenBudgetManager = require('../token-budget-manager');

async function main() {
  console.log('🚀 Token Budget Manager Example\n');

  // Initialize budget manager
  const budgetManager = new TokenBudgetManager({
    hourlyBudget: 50000,
    dailyBudget: 500000,
    weeklyBudget: 3000000,
    projectBudget: 1000000
  });

  // Listen to events
  budgetManager.on('budget-alert', (alert) => {
    console.log(`\n⚠️  ALERT: ${alert.level} - ${Math.round(alert.percentage * 100)}% of ${alert.period}ly budget used`);
  });

  budgetManager.on('optimization-level-changed', (event) => {
    console.log(`\n📊 Optimization level: ${event.from} → ${event.to}`);
  });

  budgetManager.on('budget-exceeded', (event) => {
    console.log(`\n🚨 BUDGET EXCEEDED: Requested ${event.requested} but only ${event.available} available (${event.period})`);
  });

  // Example 1: Normal request within budget
  console.log('Example 1: Normal request');
  const result1 = await budgetManager.requestTokens(5000, {
    task: 'code-generation',
    model: 'claude-sonnet',
    agent: 'backend-specialist',
    projectId: 'ecommerce-platform'
  });
  console.log('✅ Request approved:', result1.allowed);
  console.log('   Tokens:', result1.tokens);
  console.log('   Optimization:', result1.optimization);
  console.log('   Remaining (hourly):', result1.remaining.hour);

  // Example 2: Multiple requests approaching limit
  console.log('\n\nExample 2: Multiple requests approaching limit');
  for (let i = 1; i <= 10; i++) {
    await budgetManager.requestTokens(3000, {
      task: `iteration-${i}`,
      model: 'claude-sonnet'
    });
    console.log(`   Request ${i}: ${budgetManager.usage.current.hour.toLocaleString()} / ${budgetManager.budgets.hourly.toLocaleString()} tokens used`);
  }

  // Example 3: Request that will be optimized
  console.log('\n\nExample 3: Request needing optimization');
  const result3 = await budgetManager.requestTokens(10000, {
    task: 'complex-architecture',
    model: 'claude-opus',
    canCompressContext: true,
    hasCacheableContent: true
  });
  console.log('Result:', result3.allowed ? 'Approved' : 'Blocked');
  if (!result3.allowed && result3.optimizationSuggestions) {
    console.log('Suggestions:', result3.optimizationSuggestions);
  }

  // Example 4: View statistics
  console.log('\n\nExample 4: Current statistics');
  const stats = budgetManager.getStatistics();
  console.log('Total requests:', stats.stats.totalRequests);
  console.log('Blocked requests:', stats.stats.blockedRequests);
  console.log('Optimized requests:', stats.stats.optimizedRequests);
  console.log('Tokens saved:', stats.stats.tokensSaved);
  console.log('Current usage:');
  console.log('  Hour:', stats.usage.hour.toLocaleString(), '/', stats.budgets.hourly.toLocaleString());
  console.log('  Day:', stats.usage.day.toLocaleString(), '/', stats.budgets.daily.toLocaleString());
  console.log('  Week:', stats.usage.week.toLocaleString(), '/', stats.budgets.weekly.toLocaleString());

  // Clean up
  budgetManager.destroy();

  console.log('\n✅ Example complete!\n');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
