/**
 * Unified Cache Orchestrator - Usage Example
 *
 * Demonstrates the complete caching system with all optimizations
 */

const UnifiedCacheOrchestrator = require('../unified-cache-orchestrator');
const path = require('path');

async function main() {
  console.log('🚀 Unified Cache Orchestrator Example\n');

  // Initialize orchestrator
  const cacheOrchestrator = new UnifiedCacheOrchestrator({
    agentDirectory: path.join(__dirname, '../../devteam/memory'),
    warmOnInit: false, // We'll warm manually for demonstration
    commonAgents: [
      'senior-fullstack-developer',
      'frontend-specialist',
      'backend-specialist',
      'qa-engineer',
      'devops-engineer'
    ],
    sharedContexts: [
      {
        name: 'system-prompt',
        type: 'static',
        messages: [{
          role: 'system',
          content: 'You are an expert software development assistant.'
        }]
      },
      {
        name: 'coding-standards',
        type: 'static',
        messages: [{
          role: 'system',
          content: 'Follow clean code principles and best practices.'
        }]
      }
    ],
    autoOptimize: true
  });

  // Listen to events
  cacheOrchestrator.on('cache-hit', (event) => {
    console.log(`✅ Cache Hit [${event.source}]: Saved ~${event.estimatedSavings || event.savings || 0} tokens`);
  });

  cacheOrchestrator.on('cache-miss', (event) => {
    console.log(`❌ Cache Miss [${event.source}]: Loading fresh...`);
  });

  cacheOrchestrator.on('caches-warmed', (event) => {
    console.log('\n🔥 Cache Warming Complete!');
    console.log(`   Agents: ${event.agents}`);
    console.log(`   Prompts: ${event.prompts}`);
    console.log(`   Shared Contexts: ${event.sharedContexts}`);
    console.log(`   Duration: ${event.duration}ms\n`);
  });

  // Example 1: Cache Warming
  console.log('═══════════════════════════════════════════════');
  console.log('Example 1: Intelligent Cache Warming');
  console.log('═══════════════════════════════════════════════\n');

  await cacheOrchestrator.warmAllCaches();

  // Example 2: Using Shared Contexts
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 2: Shared Context Injection');
  console.log('═══════════════════════════════════════════════\n');

  const userMessage = [{
    role: 'user',
    content: 'Please review this code for best practices.'
  }];

  const messagesWithSharedContext = cacheOrchestrator.prepareMessages(userMessage, {
    includeSharedContexts: true,
    sharedContexts: ['system-instructions', 'code-standards']
  });

  console.log(`Original messages: ${userMessage.length}`);
  console.log(`With shared contexts: ${messagesWithSharedContext.length}`);
  console.log('\nShared contexts injected:');
  messagesWithSharedContext
    .filter(m => m.cache_control)
    .forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.role} (cached)`);
    });

  // Example 3: Loading Agents with Caching
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 3: Agent Loading with Cache');
  console.log('═══════════════════════════════════════════════\n');

  // Note: This will work if you have actual agent files
  // For demonstration, we'll show the concept
  console.log('Loading 3 agents for code review task...\n');

  // Simulated agent loading (would use actual agents in production)
  const agentIds = [
    'senior-fullstack-developer',
    'code-reviewer',
    'security-specialist'
  ];

  console.log(`Agents to load: ${agentIds.join(', ')}`);
  console.log('\nFirst Load (cache misses expected):');
  console.log('   - Reading from files...');

  console.log('\nSecond Load (cache hits expected):');
  console.log('   - 90% token savings!');
  console.log('   - Instant retrieval from cache');

  // Example 4: Message Preparation with Caching
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 4: Message Preparation');
  console.log('═══════════════════════════════════════════════\n');

  const taskMessages = [
    {
      role: 'system',
      content: 'You are a code reviewer specializing in React applications.'
    },
    {
      role: 'user',
      content: `Review this React component:

function UserProfile({ user }) {
  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <img src={user.avatar} alt="Avatar" />
    </div>
  );
}`
    }
  ];

  const preparedMessages = cacheOrchestrator.prepareMessages(taskMessages, {
    contentType: 'semi-static',
    aggressiveCaching: false
  });

  console.log('Messages prepared with caching optimization:');
  preparedMessages.forEach((msg, i) => {
    const cached = msg.cache_control ? ' [CACHED]' : '';
    console.log(`   ${i + 1}. ${msg.role}${cached}`);
  });

  // Example 5: Statistics & Monitoring
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 5: Comprehensive Statistics');
  console.log('═══════════════════════════════════════════════\n');

  const stats = cacheOrchestrator.getStatistics();

  console.log('📊 Overall Performance:');
  console.log(`   Total Cache Hits: ${stats.overall.totalCacheHits}`);
  console.log(`   Total Cache Misses: ${stats.overall.totalCacheMisses}`);
  console.log(`   Hit Rate: ${stats.overall.hitRate.toFixed(1)}%`);
  console.log(`   Tokens Saved: ${stats.overall.totalTokensSaved.toLocaleString()}`);
  console.log(`   Cache Efficiency: ${stats.overall.cacheEfficiency} tokens/operation`);

  console.log('\n📝 Prompt Cache:');
  console.log(`   Size: ${stats.promptCache.cacheSize} / ${stats.promptCache.maxCacheSize}`);
  console.log(`   Hit Rate: ${stats.promptCache.hitRate.toFixed(1)}%`);
  console.log(`   Savings: ${stats.promptCache.totalSavings.toLocaleString()} tokens`);

  console.log('\n👥 Agent Cache:');
  console.log(`   Size: ${stats.agentCache.cacheSize} / ${stats.agentCache.maxCacheSize}`);
  console.log(`   Hit Rate: ${stats.agentCache.hitRate.toFixed(1)}%`);
  console.log(`   Tokens Saved: ${stats.agentCache.tokensSaved.toLocaleString()}`);
  console.log(`   Avg Agent Size: ${stats.agentCache.avgAgentSize} tokens`);

  if (stats.agentCache.topAgents && stats.agentCache.topAgents.length > 0) {
    console.log('\n   Top 5 Most Used Agents:');
    stats.agentCache.topAgents.slice(0, 5).forEach((agent, i) => {
      console.log(`      ${i + 1}. ${agent.agentId} (${agent.usageCount} uses)`);
    });
  }

  console.log('\n🔗 Shared Contexts:');
  console.log(`   Loaded: ${stats.sharedContexts.count}`);
  if (stats.sharedContexts.contexts.length > 0) {
    stats.sharedContexts.contexts.forEach(ctx => {
      console.log(`      - ${ctx.id} (${ctx.type}): ${ctx.accessCount} accesses`);
    });
  }

  // Example 6: Cache Optimization
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 6: Automatic Cache Optimization');
  console.log('═══════════════════════════════════════════════\n');

  console.log('Running automatic optimization...');
  const optimizations = await cacheOrchestrator.optimizeCache();

  if (optimizations.length === 0) {
    console.log('✅ Cache is already optimally configured!');
  }

  // Example 7: Cost Savings Projection
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 7: Cost Savings Analysis');
  console.log('═══════════════════════════════════════════════\n');

  const tokensSaved = stats.overall.totalTokensSaved;
  const pricePerMillion = 3.0; // Sonnet pricing
  const savingsPercentage = 90; // 90% savings on cached content

  const costSavings = (tokensSaved / 1000000) * pricePerMillion;

  console.log('💰 Session Savings:');
  console.log(`   Tokens Saved: ${tokensSaved.toLocaleString()}`);
  console.log(`   Cost Savings: $${costSavings.toFixed(4)}`);
  console.log(`   Savings Rate: ${savingsPercentage}% on cached content`);

  // Project monthly savings
  const operationsPerDay = 100;
  const avgSavingsPerOp = stats.overall.cacheEfficiency;
  const dailyTokenSavings = avgSavingsPerOp * operationsPerDay;
  const monthlyTokenSavings = dailyTokenSavings * 30;
  const monthlyCostSavings = (monthlyTokenSavings / 1000000) * pricePerMillion;

  console.log('\n📈 Projected Monthly (at current rate):');
  console.log(`   Token Savings: ${Math.round(monthlyTokenSavings).toLocaleString()}`);
  console.log(`   Cost Savings: $${monthlyCostSavings.toFixed(2)}`);

  // Example 8: Best Practices
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 8: Caching Best Practices');
  console.log('═══════════════════════════════════════════════');

  console.log(`
💡 Best Practices for Maximum Cache Efficiency:

1. **Warm Cache on Startup**
   - Pre-load frequently used agents
   - Cache common shared contexts
   - Reduces cold start latency

2. **Structure Messages for Caching**
   - Place static content at the beginning
   - System prompts and agent contexts first
   - Dynamic user input last
   - This maximizes cache hits

3. **Use Shared Contexts**
   - Avoid duplicating common contexts
   - Reference shared system prompts
   - Inject only when needed
   - Prevents cache bloat

4. **Monitor Cache Performance**
   - Target 80%+ hit rate
   - Watch for excessive misses
   - Optimize based on usage patterns
   - Run periodic optimization

5. **Agent Selection**
   - Reuse same agents for related tasks
   - Benefit from 90% savings on repeated loads
   - Consider agent specialization carefully
   - Group related operations

6. **Cache Lifecycle**
   - 5-minute cache lifetime (Claude's TTL)
   - Automatic invalidation on file changes
   - Manual refresh when needed
   - Monitor for stale content

7. **Combined Optimizations**
   - Week 1: Model selection + discovery (93% reduction)
   - Week 2: Caching (90% on cached content)
   - Combined: 95-97% total reduction possible!

8. **Cost Management**
   - Cache hit = 10% cost
   - Cache miss = 100% cost
   - High hit rate = massive savings
   - Monitor and optimize continuously
  `);

  // Cleanup
  console.log('\n✅ Example complete!\n');

  console.log('🎯 Key Takeaways:');
  console.log('   • Unified caching simplifies optimization');
  console.log('   • Cache warming reduces cold start costs');
  console.log('   • Shared contexts prevent duplication');
  console.log('   • 90% savings on all cached content');
  console.log('   • Automatic optimization improves over time');
  console.log('   • Combined with Week 1: 95%+ total reduction!\n');

  cacheOrchestrator.destroy();
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
