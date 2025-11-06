/**
 * Setup MongoDB "evolve" Collection for V2 Optimization Data
 *
 * Creates the "evolve" collection in MongoDB and populates it with
 * initial V2 optimization metadata and schema.
 *
 * This collection stores:
 * - Optimization metrics (token usage, costs, savings)
 * - Session data for AB testing
 * - Performance benchmarks
 * - Model selection statistics
 *
 * @script setup-evolve-collection
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || MONGODB_URI === 'your_mongodb_uri_here') {
  console.error('❌ ERROR: MONGODB_URI not configured in .env file');
  process.exit(1);
}

async function setupEvolveCollection() {
  console.log('\n🚀 Setting up MongoDB "evolve" collection for V2...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db('admin');

    // Check if evolve collection exists
    const collections = await db.listCollections({ name: 'evolve' }).toArray();

    if (collections.length > 0) {
      console.log('ℹ️  "evolve" collection already exists');
      const count = await db.collection('evolve').countDocuments();
      console.log(`   Current documents: ${count}`);
    } else {
      console.log('📝 Creating "evolve" collection...');
      await db.createCollection('evolve');
      console.log('✅ Collection created');
    }

    const evolveCollection = db.collection('evolve');

    // Create indexes for efficient queries
    console.log('\n📊 Creating indexes...');
    await evolveCollection.createIndex({ sessionId: 1 }, { unique: true });
    await evolveCollection.createIndex({ instance: 1 });
    await evolveCollection.createIndex({ timestamp: -1 });
    await evolveCollection.createIndex({ company: 1 });
    await evolveCollection.createIndex({ type: 1 });
    console.log('✅ Indexes created');

    // Insert initial V2 system metadata
    console.log('\n📝 Inserting V2 system metadata...');

    const systemMetadata = {
      sessionId: 'v2-system-metadata',
      instance: 'v2',
      timestamp: new Date(),
      company: 'evolve',
      type: 'system_metadata',
      version: '2.0.0',
      capabilities: {
        tokenBudgetManagement: true,
        intelligentModelSelection: true,
        promptCaching: true,
        usageTracking: true,
        knowledgeBaseIntegration: true,
        agentMetadataOptimization: true,
        codeReviewAgent: true
      },
      optimizationTargets: {
        tokenReduction: '85-90%',
        costReduction: '85-90%',
        performanceImprovement: '40-73%',
        cacheHitRate: '80%+',
        agentDiscoveryReduction: '90%'
      },
      components: {
        tokenBudgetManager: {
          file: 'optimization/token-budget-manager.js',
          status: 'active',
          features: ['hourly/daily/weekly limits', 'alert thresholds', 'hard limits']
        },
        modelSelector: {
          file: 'optimization/model-selector.js',
          status: 'active',
          models: {
            haiku: { cost: 0.25, complexity: '0-2' },
            sonnet: { cost: 3.0, complexity: '3-7' },
            opus: { cost: 15.0, complexity: '8-10' }
          }
        },
        usageTracker: {
          file: 'optimization/usage-tracker.js',
          status: 'active',
          features: ['real-time tracking', 'cost calculation', 'analytics']
        },
        cacheManager: {
          file: 'optimization/cache-manager.js',
          status: 'active',
          features: ['prompt caching', '90% savings', 'TTL management']
        },
        evolveIntegration: {
          file: 'optimization/evolve-integration.js',
          status: 'active',
          features: ['unified API', 'MongoDB integration', 'knowledge loading']
        }
      },
      createdAt: new Date(),
      createdBy: 'setup-script'
    };

    await evolveCollection.updateOne(
      { sessionId: 'v2-system-metadata' },
      { $set: systemMetadata },
      { upsert: true }
    );
    console.log('✅ System metadata inserted');

    // Insert initial baseline comparison data
    console.log('\n📊 Inserting baseline comparison data...');

    const baselineData = {
      sessionId: 'v1-baseline-reference',
      instance: 'v1',
      timestamp: new Date(),
      company: 'evolve',
      type: 'baseline_metrics',
      metrics: {
        operations: {
          total: 100,
          avgTokensPerOperation: 516000,
          avgCostPerOperation: 1.548
        },
        daily: {
          avgOperations: 10,
          avgTokens: 5160000,
          avgCost: 15.48
        },
        agentDiscovery: {
          avgContextSize: 100000,
          avgLoadTime: 2500
        },
        caching: {
          enabled: false,
          hitRate: 0
        },
        modelUsage: {
          haiku: 0,
          sonnet: 100,
          opus: 0
        }
      },
      notes: 'V1 baseline data for comparison',
      createdAt: new Date()
    };

    await evolveCollection.updateOne(
      { sessionId: 'v1-baseline-reference' },
      { $set: baselineData },
      { upsert: true }
    );
    console.log('✅ Baseline data inserted');

    // Insert V2 expected targets
    console.log('\n🎯 Inserting V2 target metrics...');

    const v2Targets = {
      sessionId: 'v2-target-metrics',
      instance: 'v2',
      timestamp: new Date(),
      company: 'evolve',
      type: 'target_metrics',
      targets: {
        operations: {
          avgTokensPerOperation: 49000,
          tokenReduction: '90%',
          avgCostPerOperation: 0.15,
          costReduction: '90%'
        },
        daily: {
          avgTokens: 490000,
          avgCost: 1.50
        },
        agentDiscovery: {
          avgContextSize: 10000,
          contextReduction: '90%',
          avgLoadTime: 250,
          speedImprovement: '90%'
        },
        caching: {
          enabled: true,
          targetHitRate: 0.80
        },
        modelUsage: {
          haiku: 30,
          sonnet: 60,
          opus: 10
        }
      },
      notes: 'V2 optimization targets based on implementation',
      createdAt: new Date()
    };

    await evolveCollection.updateOne(
      { sessionId: 'v2-target-metrics' },
      { $set: v2Targets },
      { upsert: true }
    );
    console.log('✅ Target metrics inserted');

    // Verify setup
    console.log('\n✅ Setup complete! Summary:');
    const totalDocs = await evolveCollection.countDocuments();
    console.log(`   Total documents in evolve collection: ${totalDocs}`);

    const indexes = await evolveCollection.indexes();
    console.log(`   Total indexes: ${indexes.length}`);
    console.log('   Indexes:', indexes.map(i => i.name).join(', '));

    // Show sample data
    console.log('\n📄 Sample documents:');
    const samples = await evolveCollection.find().limit(3).toArray();
    samples.forEach(doc => {
      console.log(`   - ${doc.sessionId} (${doc.type})`);
    });

    console.log('\n🎉 MongoDB "evolve" collection is ready for V2 optimization data!\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('📡 MongoDB connection closed\n');
  }
}

// Run setup
if (require.main === module) {
  setupEvolveCollection()
    .then(() => {
      console.log('✅ Setup script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Setup script failed:', error);
      process.exit(1);
    });
}

module.exports = setupEvolveCollection;
