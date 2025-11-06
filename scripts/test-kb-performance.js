require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testKnowledgeBase() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('admin');

    // List collections
    console.log('=== Collections ===');
    const collections = await db.listCollections().toArray();
    collections.forEach(c => console.log('-', c.name));

    // Check evolve collection
    if (collections.find(c => c.name === 'evolve')) {
      console.log('\n=== Evolve Collection ===');
      const evolve = db.collection('evolve');

      // Count documents
      const count = await evolve.countDocuments();
      console.log('Total documents:', count);

      // Count V1 vs V2
      const v1Count = await evolve.countDocuments({ instance: 'v1' });
      const v2Count = await evolve.countDocuments({ instance: 'v2' });
      console.log('V1 documents:', v1Count);
      console.log('V2 documents:', v2Count);

      // List indexes
      console.log('\n=== Indexes ===');
      const indexes = await evolve.indexes();
      indexes.forEach(idx => {
        console.log('-', idx.name, ':', JSON.stringify(idx.key));
      });

      // Test query performance
      console.log('\n=== Query Performance Tests ===');

      // Test 1: Query by instance (indexed)
      let start = Date.now();
      const v2Docs = await evolve.find({ instance: 'v2' }).toArray();
      let time = Date.now() - start;
      console.log(`Query by instance (V2): ${time}ms, ${v2Docs.length} docs`);

      // Test 2: Query by type (indexed)
      start = Date.now();
      const typeDocs = await evolve.find({ type: 'system_metadata' }).toArray();
      time = Date.now() - start;
      console.log(`Query by type: ${time}ms, ${typeDocs.length} docs`);

      // Test 3: Query by company (indexed)
      start = Date.now();
      const companyDocs = await evolve.find({ company: 'evolve' }).toArray();
      time = Date.now() - start;
      console.log(`Query by company: ${time}ms, ${companyDocs.length} docs`);

      // Test 4: Recent documents (timestamp descending, indexed)
      start = Date.now();
      const recentDocs = await evolve.find().sort({ timestamp: -1 }).limit(10).toArray();
      time = Date.now() - start;
      console.log(`Query recent 10 docs: ${time}ms`);

      // Test 5: Complex query (multiple indexes)
      start = Date.now();
      const complexDocs = await evolve.find({
        instance: 'v2',
        company: 'evolve'
      }).sort({ timestamp: -1 }).toArray();
      time = Date.now() - start;
      console.log(`Complex query (instance+company+sort): ${time}ms, ${complexDocs.length} docs`);

      // Sample documents
      console.log('\n=== Sample Documents ===');
      const v1Sample = await evolve.findOne({ instance: 'v1' });
      const v2Sample = await evolve.findOne({ instance: 'v2' });

      if (v1Sample) {
        console.log('V1 Sample:', JSON.stringify(v1Sample, null, 2).substring(0, 300) + '...');
      }
      if (v2Sample) {
        console.log('\nV2 Sample:', JSON.stringify(v2Sample, null, 2).substring(0, 300) + '...');
      }
    } else {
      console.log('\n⚠️  Evolve collection not found!');
    }

    // Check for knowledge_base collection
    if (collections.find(c => c.name === 'knowledge_base')) {
      console.log('\n=== Knowledge Base Collection ===');
      const kb = db.collection('knowledge_base');
      const kbCount = await kb.countDocuments();
      console.log('Total KB documents:', kbCount);

      // Test KB query performance
      start = Date.now();
      const kbDocs = await kb.find({}).limit(5).toArray();
      time = Date.now() - start;
      console.log(`Query 5 KB docs: ${time}ms`);

      if (kbDocs.length > 0) {
        console.log('KB Sample keys:', Object.keys(kbDocs[0]).join(', '));
      }

      // Check for indexes
      const kbIndexes = await kb.indexes();
      console.log('KB Indexes:', kbIndexes.length);
      kbIndexes.forEach(idx => console.log('-', idx.name));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

testKnowledgeBase().catch(console.error);
