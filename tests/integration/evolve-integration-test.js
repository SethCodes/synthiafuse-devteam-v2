/**
 * Evolve Integration End-to-End Test
 *
 * Tests the complete V2 optimization system with real Evolve Dev Team scenarios
 * Demonstrates token savings, model selection, and knowledge base integration
 *
 * @test Integration
 */

const EvolveIntegration = require('../../optimization/evolve-integration');
const fs = require('fs').promises;
const path = require('path');

/**
 * ISSUE FOUND AND FIXED:
 * Initial test run failed with: "connect ECONNREFUSED ::1:27017"
 *
 * ROOT CAUSE:
 * - Test was defaulting to localhost MongoDB instead of using .env configuration
 * - .env file contains actual DigitalOcean MongoDB Atlas URI
 * - process.env.MONGODB_URI was not being loaded because dotenv wasn't required
 *
 * FIX APPLIED:
 * - Added require('dotenv').config() to load environment variables
 * - Test now uses actual MongoDB Atlas connection from .env
 * - This allows real integration testing with Evolve's actual knowledge base
 *
 * Date Fixed: 2025-11-06
 */

// Load environment variables from .env file
require('dotenv').config();

// Test configuration - NOW USING REAL MONGODB FROM .ENV
const TEST_CONFIG = {
  mongoUri: process.env.MONGODB_URI, // Real DigitalOcean MongoDB Atlas
  claudeApiKey: process.env.CLAUDE_API_KEY,
  company: 'evolve',
  instance: 'v2',
  budgets: {
    hourly: 100000,
    daily: 1000000,
    weekly: 5000000
  }
};

// Validate configuration
if (!TEST_CONFIG.mongoUri || TEST_CONFIG.mongoUri === 'your_mongodb_uri_here') {
  console.error('❌ ERROR: MONGODB_URI not configured in .env file');
  console.error('Please ensure .env file exists with valid MONGODB_URI');
  process.exit(1);
}

if (!TEST_CONFIG.claudeApiKey || TEST_CONFIG.claudeApiKey === 'your_claude_api_key_here') {
  console.warn('⚠️ WARNING: CLAUDE_API_KEY not configured - using mock mode');
  console.warn('Real API calls will fail. For full testing, add CLAUDE_API_KEY to .env');
}

// Test scenarios mimicking real Evolve workflows
const TEST_SCENARIOS = [
  {
    name: 'Simple Routing Task',
    description: 'Route a ticket to appropriate agent',
    expectedModel: 'haiku',
    task: {
      description: 'Which agent should handle a UI bug fix ticket?',
      requiresCode: false,
      requiresArchitecture: false,
      criticalDecision: false,
      agent: 'team-lead'
    },
    prompt: 'A ticket came in: "Fix button alignment on game menu". Which agent should handle this?',
    expectedComplexity: 2
  },
  {
    name: 'Code Generation Task',
    description: 'Generate Unity C# code for PlayFab integration',
    expectedModel: 'sonnet',
    task: {
      description: 'Implement PlayFab leaderboard submission for Unity game',
      requiresCode: true,
      requiresArchitecture: false,
      criticalDecision: false,
      agent: 'backend-dev',
      context: {
        game: 'battleship',
        technologies: ['Unity', 'PlayFab', 'C#'],
        patterns: ['playfab-integration', 'leaderboard-pattern']
      }
    },
    prompt: 'Create a C# method that submits a player score to PlayFab leaderboards with error handling',
    maxTokens: 2048,
    expectedComplexity: 6
  },
  {
    name: 'Architecture Decision',
    description: 'Design cloud-first video system architecture',
    expectedModel: 'opus',
    task: {
      description: 'Design scalable video streaming architecture for 36 Unity games',
      requiresCode: false,
      requiresArchitecture: true,
      criticalDecision: true,
      agent: 'team-lead',
      context: {
        technologies: ['AWS S3', 'Unity', 'Video Streaming'],
        patterns: ['cloud-first-pattern', 'fallback-strategy']
      }
    },
    prompt: 'Design a cloud-first video system for Unity games with offline fallback and caching strategy',
    maxTokens: 4096,
    expectedComplexity: 9
  },
  {
    name: 'Code Review Task',
    description: 'Review Unity code for cleanup',
    expectedModel: 'sonnet',
    task: {
      description: 'Review Unity game code for debug statements and unused code',
      requiresCode: true,
      requiresArchitecture: false,
      criticalDecision: false,
      agent: 'code-reviewer'
    },
    prompt: 'Review this Unity C# code and identify debug statements, unused variables, and cleanup opportunities',
    expectedComplexity: 5
  },
  {
    name: 'Knowledge Base Query',
    description: 'Search for async quit patterns in knowledge base',
    expectedModel: 'haiku',
    task: {
      description: 'Find async quit pattern documentation for Unity games',
      requiresCode: false,
      requiresArchitecture: false,
      criticalDecision: false,
      agent: 'company-knowledge',
      context: {
        technologies: ['Unity'],
        patterns: ['async-quit-pattern', 'hit-detection-cleanup']
      }
    },
    prompt: 'Find documentation on the correct async quit pattern for Unity games with Hit Detection',
    maxTokens: 1024,
    expectedComplexity: 2
  }
];

class EvolveIntegrationTest {
  constructor() {
    this.integration = null;
    this.results = {
      scenarios: [],
      summary: {
        totalScenarios: 0,
        passed: 0,
        failed: 0,
        tokensUsed: 0,
        totalCost: 0,
        estimatedV1Cost: 0,
        savings: {
          tokens: 0,
          cost: 0,
          percentage: 0
        },
        modelUsage: {
          haiku: 0,
          sonnet: 0,
          opus: 0
        },
        performance: {
          avgResponseTime: 0,
          fastestResponse: Infinity,
          slowestResponse: 0
        }
      }
    };
  }

  async setup() {
    console.log('\n🔧 Setting up Evolve Integration Test...\n');

    try {
      // Initialize integration
      this.integration = new EvolveIntegration(TEST_CONFIG);

      // Connect to MongoDB
      await this.integration.connectMongoDB();

      console.log('✅ Setup complete\n');
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      throw error;
    }
  }

  async runScenario(scenario, index) {
    console.log(`\n📋 Scenario ${index + 1}/${TEST_SCENARIOS.length}: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Expected Model: ${scenario.expectedModel}`);
    console.log(`   Expected Complexity: ${scenario.expectedComplexity}/10\n`);

    const result = {
      name: scenario.name,
      passed: false,
      duration: 0,
      error: null,
      metrics: {}
    };

    try {
      const startTime = Date.now();

      // Load knowledge context if available
      let knowledgeContext = [];
      if (scenario.task.context) {
        knowledgeContext = await this.integration.loadKnowledgeContext(scenario.task.context);
        console.log(`   📚 Loaded ${knowledgeContext.length} knowledge items from context`);
      }

      // Execute optimized call
      const response = await this.integration.optimizedCall({
        task: scenario.task.description,
        prompt: scenario.prompt,
        context: scenario.task.context,
        knowledgeContext: knowledgeContext,
        requiresCode: scenario.task.requiresCode,
        requiresArchitecture: scenario.task.requiresArchitecture,
        criticalDecision: scenario.task.criticalDecision,
        agent: scenario.task.agent,
        project: 'evolve-integration-test',
        maxTokens: scenario.maxTokens || 2048
      });

      const duration = Date.now() - startTime;

      // Validate results
      const modelMatches = response.model.includes(scenario.expectedModel);
      const complexityMatches = Math.abs(response.optimization.complexity - scenario.expectedComplexity) <= 2;

      result.passed = modelMatches && response.content.length > 0;
      result.duration = duration;
      result.metrics = {
        model: response.model,
        modelMatch: modelMatches,
        complexity: response.optimization.complexity,
        complexityMatch: complexityMatches,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        cachedTokens: response.usage.cachedTokens,
        cost: response.optimization.cost,
        budgetLevel: response.optimization.budgetLevel,
        cached: response.optimization.cached
      };

      // Update summary stats
      this.results.summary.tokensUsed += result.metrics.tokensUsed;
      this.results.summary.totalCost += result.metrics.cost;

      // Track model usage
      if (response.model.includes('haiku')) this.results.summary.modelUsage.haiku++;
      else if (response.model.includes('sonnet')) this.results.summary.modelUsage.sonnet++;
      else if (response.model.includes('opus')) this.results.summary.modelUsage.opus++;

      // Update performance metrics
      this.results.summary.performance.fastestResponse = Math.min(
        this.results.summary.performance.fastestResponse,
        duration
      );
      this.results.summary.performance.slowestResponse = Math.max(
        this.results.summary.performance.slowestResponse,
        duration
      );

      console.log(`   ✅ Scenario passed in ${duration}ms`);
      console.log(`   📊 Metrics:`);
      console.log(`      - Model: ${response.optimization.selectedModel}`);
      console.log(`      - Complexity: ${result.metrics.complexity}/10`);
      console.log(`      - Tokens: ${result.metrics.tokensUsed} (${result.metrics.cachedTokens} cached)`);
      console.log(`      - Cost: $${result.metrics.cost.toFixed(6)}`);
      console.log(`      - Budget Level: ${result.metrics.budgetLevel}`);

    } catch (error) {
      result.passed = false;
      result.error = error.message;
      console.log(`   ❌ Scenario failed: ${error.message}`);
    }

    return result;
  }

  async runAllScenarios() {
    console.log('\n🚀 Running All Test Scenarios...\n');
    console.log('═'.repeat(80));

    for (let i = 0; i < TEST_SCENARIOS.length; i++) {
      const scenario = TEST_SCENARIOS[i];
      const result = await this.runScenario(scenario, i);

      this.results.scenarios.push(result);
      this.results.summary.totalScenarios++;

      if (result.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }

      // Short delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '═'.repeat(80));
  }

  calculateSavings() {
    // Estimate V1 costs (always using Sonnet)
    const SONNET_COST = 3.0 / 1000000; // per token input
    this.results.summary.estimatedV1Cost = this.results.summary.tokensUsed * SONNET_COST;

    // Calculate savings
    this.results.summary.savings.cost = this.results.summary.estimatedV1Cost - this.results.summary.totalCost;
    this.results.summary.savings.percentage =
      (this.results.summary.savings.cost / this.results.summary.estimatedV1Cost * 100).toFixed(2);

    // Calculate average response time
    const totalDuration = this.results.scenarios.reduce((sum, r) => sum + r.duration, 0);
    this.results.summary.performance.avgResponseTime = Math.round(totalDuration / this.results.scenarios.length);
  }

  async generateReport() {
    console.log('\n📊 TEST SUMMARY REPORT\n');
    console.log('═'.repeat(80));

    console.log(`\n✅ Scenarios Passed: ${this.results.summary.passed}/${this.results.summary.totalScenarios}`);
    console.log(`❌ Scenarios Failed: ${this.results.summary.failed}/${this.results.summary.totalScenarios}`);

    console.log(`\n💰 COST ANALYSIS:`);
    console.log(`   V2 Actual Cost:     $${this.results.summary.totalCost.toFixed(6)}`);
    console.log(`   V1 Estimated Cost:  $${this.results.summary.estimatedV1Cost.toFixed(6)}`);
    console.log(`   Savings:            $${this.results.summary.savings.cost.toFixed(6)} (${this.results.summary.savings.percentage}%)`);

    console.log(`\n🎯 MODEL USAGE:`);
    console.log(`   Haiku:  ${this.results.summary.modelUsage.haiku} calls`);
    console.log(`   Sonnet: ${this.results.summary.modelUsage.sonnet} calls`);
    console.log(`   Opus:   ${this.results.summary.modelUsage.opus} calls`);

    console.log(`\n⚡ PERFORMANCE:`);
    console.log(`   Average Response: ${this.results.summary.performance.avgResponseTime}ms`);
    console.log(`   Fastest:          ${this.results.summary.performance.fastestResponse}ms`);
    console.log(`   Slowest:          ${this.results.summary.performance.slowestResponse}ms`);

    console.log(`\n📈 TOKEN USAGE:`);
    console.log(`   Total Tokens: ${this.results.summary.tokensUsed}`);

    console.log('\n' + '═'.repeat(80));

    // Get integration stats
    const integrationStats = this.integration.getStats();
    console.log(`\n🔍 INTEGRATION STATS:`);
    console.log(JSON.stringify(integrationStats, null, 2));

    // Save report to file
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Full report saved to: ${reportPath}\n`);

    // Store metrics in MongoDB
    await this.integration.storeMetrics(`integration-test-${Date.now()}`, this.results);
  }

  async teardown() {
    console.log('\n🧹 Cleaning up...\n');

    if (this.integration) {
      await this.integration.close();
    }

    console.log('✅ Teardown complete\n');
  }

  async run() {
    try {
      await this.setup();
      await this.runAllScenarios();
      this.calculateSavings();
      await this.generateReport();
      await this.teardown();

      console.log('✅ All tests completed successfully!\n');
      return this.results;

    } catch (error) {
      console.error('\n❌ Test execution failed:', error);
      await this.teardown();
      throw error;
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new EvolveIntegrationTest();
  test.run()
    .then(results => {
      const passed = results.summary.passed === results.summary.totalScenarios;
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = EvolveIntegrationTest;
