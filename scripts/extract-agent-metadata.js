/**
 * Extract Agent Metadata Script
 *
 * Extracts lightweight metadata from all agent CLAUDE.md files and builds
 * indexes for optimized discovery.
 *
 * This is a one-time migration script (or run when agents change).
 *
 * Usage: node scripts/extract-agent-metadata.js
 */

const OptimizedAgentDiscovery = require('../agents/optimized-agent-discovery');
const path = require('path');

async function main() {
  console.log('🚀 Agent Metadata Extraction Starting...\n');

  // Determine agent directory (V1 or V2)
  const v1AgentDir = path.join(__dirname, '../../synthiafuse-devteam/devteam/memory');
  const v2AgentDir = path.join(__dirname, '../devteam/memory');

  // Try V1 first (for migration), then V2
  let agentDirectory;
  try {
    const fs = require('fs');
    await fs.promises.access(v1AgentDir);
    agentDirectory = v1AgentDir;
    console.log(`📁 Using V1 agent directory: ${agentDirectory}`);
  } catch {
    agentDirectory = v2AgentDir;
    console.log(`📁 Using V2 agent directory: ${agentDirectory}`);
  }

  // Initialize discovery system
  const discovery = new OptimizedAgentDiscovery({
    agentDirectory: agentDirectory,
    metadataPath: path.join(__dirname, '../agents/agent-metadata.json')
  });

  // Listen to initialization event
  discovery.on('initialized', (event) => {
    console.log(`\n✅ Initialization Complete!`);
    console.log(`   Agents indexed: ${event.agents}`);
    console.log(`   Estimated metadata tokens: ${event.estimatedTokens.toLocaleString()}`);
    console.log(`   Savings vs full load: ${event.savings.toLocaleString()} tokens (${Math.round((event.savings / (event.savings + event.estimatedTokens)) * 100)}%)`);
  });

  try {
    // Initialize (this will build and save metadata)
    await discovery.initialize();

    // Show statistics
    const stats = discovery.getStatistics();
    console.log(`\n📊 Metadata Index Built:`);
    console.log(`   Total agents: ${stats.agentsInIndex}`);

    // Test discovery to verify
    console.log(`\n🧪 Testing Discovery...`);
    const testRequirements = {
      technologies: ['react', 'nodejs'],
      categories: ['frontend', 'backend'],
      description: 'Build a full-stack web application'
    };

    const agents = await discovery.findOptimalAgents(testRequirements, {
      maxAgents: 5
    });

    console.log(`\n✅ Test Discovery Successful!`);
    console.log(`   Found ${agents.length} agents`);
    agents.forEach((agent, i) => {
      console.log(`   ${i + 1}. ${agent.name} (${agent.role})`);
    });

    // Show final statistics
    const finalStats = discovery.getStatistics();
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Discoveries performed: ${finalStats.discoveries}`);
    console.log(`   Avg agents considered: ${finalStats.avgAgentsConsidered}`);
    console.log(`   Avg agents selected: ${finalStats.avgAgentsSelected}`);
    console.log(`   Total tokens used: ${finalStats.tokensUsed.toLocaleString()}`);
    console.log(`   Total tokens saved: ${finalStats.tokensSaved.toLocaleString()}`);
    console.log(`   Savings percentage: ${finalStats.savingsPercentage}%`);

    console.log(`\n🎉 Metadata extraction complete!`);
    console.log(`   Metadata file: ${discovery.config.metadataPath}`);

  } catch (error) {
    console.error(`\n❌ Error during extraction:`, error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
