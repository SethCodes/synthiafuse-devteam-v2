/**
 * Prompt Cache Manager - Usage Example
 *
 * Demonstrates how to use the PromptCacheManager for optimal caching
 */

const PromptCacheManager = require('../cache-manager');

async function main() {
  console.log('🚀 Prompt Cache Manager Example\n');

  // Initialize cache manager
  const cacheManager = new PromptCacheManager({
    enabled: true,
    maxCacheSize: 100,
    minCacheableSize: 1000,
    aggressiveCaching: true
  });

  // Listen to cache events
  cacheManager.on('cache-hit', (event) => {
    console.log(`\n✅ Cache Hit!`);
    console.log(`   Key: ${event.cacheKey}`);
    console.log(`   Savings: ${event.savings} tokens`);
    console.log(`   Total Hits: ${event.totalHits}`);
  });

  cacheManager.on('cache-miss', (event) => {
    console.log(`\n❌ Cache Miss (first time)`);
    console.log(`   Key: ${event.cacheKey}`);
    console.log(`   Potential Savings: ${event.potentialSavings} tokens`);
  });

  // Example 1: Static System Prompt (highly cacheable)
  console.log('═══════════════════════════════════════════════');
  console.log('Example 1: System Prompt (Static Content)');
  console.log('═══════════════════════════════════════════════');

  const systemPrompt = [{
    role: 'system',
    content: `You are an expert software development assistant.

Your capabilities include:
- Writing clean, maintainable code
- Debugging complex issues
- Optimizing performance
- Following best practices
- Comprehensive testing

Always provide detailed explanations and consider edge cases.`
  }];

  // First call - will be cached
  const prepared1 = cacheManager.prepareCacheableContent(systemPrompt);
  console.log('\nFirst call - prepared with cache control:');
  console.log(JSON.stringify(prepared1, null, 2));

  // Second call - cache hit!
  const prepared2 = cacheManager.prepareCacheableContent(systemPrompt);

  // Example 2: Agent Context (semi-static)
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 2: Agent Context (Semi-Static Content)');
  console.log('═══════════════════════════════════════════════');

  const agentContext = [{
    role: 'user',
    content: `# Agent: Senior Full-Stack Developer

## Primary Skills
- React, Node.js, TypeScript
- System architecture design
- Performance optimization
- Security best practices

## Secondary Skills
- DevOps (Docker, Kubernetes)
- Database design (MongoDB, PostgreSQL)
- Testing (Jest, Cypress)

## Approach
- Test-driven development
- Code review best practices
- Documentation-first mindset
- Performance-conscious design`
  }];

  cacheManager.prepareCacheableContent(agentContext, {
    contentType: 'semiStatic'
  });

  cacheManager.prepareCacheableContent(agentContext, {
    contentType: 'semiStatic'
  });

  // Example 3: Mixed Content (some cacheable, some not)
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 3: Mixed Content');
  console.log('═══════════════════════════════════════════════');

  const mixedMessages = [
    {
      role: 'system',
      content: 'You are a code reviewer.' // Static, will cache
    },
    {
      role: 'user',
      content: '# Agent: Code Reviewer\n\nExpert in identifying bugs and security issues.' // Static
    },
    {
      role: 'user',
      content: `Review this code:

function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
}` // Semi-static (code file)
    },
    {
      role: 'user',
      content: 'Please review for bugs and suggest improvements.' // Dynamic, won't cache
    }
  ];

  const preparedMixed = cacheManager.prepareCacheableContent(mixedMessages);
  console.log('\nCacheable sections marked:');

  preparedMixed.forEach((msg, index) => {
    const cached = msg.cache_control ? '✓ CACHED' : '✗ not cached';
    console.log(`   Message ${index}: ${cached}`);
  });

  // Example 4: Cache Warming
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 4: Cache Warming');
  console.log('═══════════════════════════════════════════════');

  const commonContent = [
    {
      name: 'default-system-prompt',
      type: 'static',
      messages: [{
        role: 'system',
        content: 'You are a helpful AI assistant focused on software development.'
      }]
    },
    {
      name: 'react-developer-context',
      type: 'static',
      messages: [{
        role: 'user',
        content: '# Agent: React Developer\n\nSpecializes in modern React development with hooks and TypeScript.'
      }]
    },
    {
      name: 'nodejs-developer-context',
      type: 'static',
      messages: [{
        role: 'user',
        content: '# Agent: Node.js Developer\n\nExpert in backend API development and microservices.'
      }]
    }
  ];

  await cacheManager.warmCache(commonContent);

  // Example 5: Performance Comparison
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 5: Performance & Savings');
  console.log('═══════════════════════════════════════════════');

  // Simulate multiple requests
  const testMessages = [{
    role: 'system',
    content: 'Test system prompt '.repeat(100) // ~2000 tokens
  }];

  console.log('\nSimulating 10 requests with same content...');

  for (let i = 0; i < 10; i++) {
    cacheManager.prepareCacheableContent(testMessages);
  }

  const stats = cacheManager.getStatistics();

  console.log('\n📊 Cache Statistics:');
  console.log(`   Cache Enabled: ${stats.enabled}`);
  console.log(`   Cache Size: ${stats.cacheSize} / ${stats.maxCacheSize}`);
  console.log(`   Cache Hits: ${stats.hits}`);
  console.log(`   Cache Misses: ${stats.misses}`);
  console.log(`   Hit Rate: ${stats.hitRate.toFixed(1)}%`);
  console.log(`   Total Savings: ${stats.totalSavings.toLocaleString()} tokens`);
  console.log(`   Evictions: ${stats.evictions}`);
  console.log(`   Efficiency: ${Math.round(stats.efficiency)} tokens/entry`);
  console.log(`   Est. Monthly Savings: ${stats.estimatedMonthlySavings.toLocaleString()} tokens`);

  // Example 6: Cost Comparison
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 6: Cost Impact');
  console.log('═══════════════════════════════════════════════');

  const pricePerMillion = 3.0; // Sonnet pricing (input)
  const tokensSavedThisSession = stats.totalSavings;
  const costSavings = (tokensSavedThisSession / 1000000) * pricePerMillion * 0.9; // 90% savings on cached

  console.log(`\nIn this session:`);
  console.log(`   Tokens that would be charged normally: ${tokensSavedThisSession.toLocaleString()}`);
  console.log(`   With caching (10% charge): ${Math.round(tokensSavedThisSession * 0.1).toLocaleString()}`);
  console.log(`   Token savings: ${Math.round(tokensSavedThisSession * 0.9).toLocaleString()} (90%)`);
  console.log(`   Cost savings: $${costSavings.toFixed(4)}`);

  // Projected monthly
  const monthlyTokenSavings = stats.estimatedMonthlySavings;
  const monthlyCostSavings = (monthlyTokenSavings / 1000000) * pricePerMillion * 0.9;

  console.log(`\nProjected monthly (at current rate):`);
  console.log(`   Token savings: ${monthlyTokenSavings.toLocaleString()}`);
  console.log(`   Cost savings: $${monthlyCostSavings.toFixed(2)}`);

  // Example 7: Cache Management
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 7: Cache Management');
  console.log('═══════════════════════════════════════════════');

  console.log('\nCache maintenance runs automatically every minute.');
  console.log('Entries older than 5 minutes are automatically removed.');
  console.log('\nYou can manually clear cache:');

  // Clear cache
  cacheManager.clearCache();

  const afterClear = cacheManager.getStatistics();
  console.log(`   Cache size after clear: ${afterClear.cacheSize}`);

  // Example 8: Best Practices
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 8: Best Practices');
  console.log('═══════════════════════════════════════════════');

  console.log(`
💡 Best Practices for Optimal Caching:

1. **Static Content** (agent contexts, system prompts, tool definitions)
   - Always cache
   - Cache lifetime: Full 5 minutes
   - Highest priority

2. **Semi-Static Content** (project context, code files, documentation)
   - Cache when content > 1000 tokens
   - Re-use across related requests
   - Medium priority

3. **Dynamic Content** (task lists, recent changes, user input)
   - Only cache if content is large (>2000 tokens)
   - Use aggressive caching mode
   - Lower priority

4. **Don't Cache**
   - User queries (<1000 tokens)
   - Frequently changing data
   - One-time-use content

5. **Cache Warming**
   - Warm cache with common agent contexts on startup
   - Pre-load system prompts
   - Reduces cold start latency

6. **Monitoring**
   - Target 80%+ cache hit rate
   - Watch for excessive evictions
   - Monitor savings vs overhead
  `);

  // Cleanup
  console.log('\n✅ Example complete!\n');
  cacheManager.destroy();
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
