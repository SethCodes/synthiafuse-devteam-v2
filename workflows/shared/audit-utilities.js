/**
 * Audit Utilities - Shared functions for audit workflows
 *
 * Provides common audit functionality for both cross-project and self-audit workflows
 */

const fs = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');

class AuditUtilities {
  constructor(options = {}) {
    this.mongoUri = options.mongoUri || process.env.MONGODB_URI;
    this.workspaceBase = options.workspaceBase || path.join(__dirname, '../../workspace');
    this.logsBase = options.logsBase || path.join(__dirname, '../../logs');
    this.confidenceThreshold = options.confidenceThreshold || 95;
  }

  /**
   * Initialize audit workspace
   */
  async initializeAuditWorkspace(projectName) {
    const workspacePath = path.join(this.workspaceBase, `${projectName}-audit`);

    // Create workspace directories
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'analysis'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'snapshots'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'ab-tests'), { recursive: true });

    // Initialize audit metadata
    const metadata = {
      projectName,
      auditId: `audit-${Date.now()}`,
      startTime: new Date().toISOString(),
      workspacePath,
      status: 'initialized'
    };

    await fs.writeFile(
      path.join(workspacePath, 'audit-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return metadata;
  }

  /**
   * Scan project structure
   */
  async scanProjectStructure(projectPath) {
    const structure = {
      path: projectPath,
      exists: false,
      files: [],
      directories: [],
      agents: [],
      workflows: [],
      scripts: [],
      documentation: [],
      tests: [],
      configs: [],
      packageInfo: null
    };

    try {
      await fs.access(projectPath);
      structure.exists = true;

      // Scan directory
      const items = await fs.readdir(projectPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          structure.directories.push(item.name);

          // Identify special directories
          if (item.name === 'agents') {
            structure.agents = await this.scanDirectory(path.join(projectPath, 'agents'));
          } else if (item.name === 'workflows') {
            structure.workflows = await this.scanDirectory(path.join(projectPath, 'workflows'));
          } else if (item.name === 'scripts') {
            structure.scripts = await this.scanDirectory(path.join(projectPath, 'scripts'));
          } else if (item.name === 'tests' || item.name === 'test') {
            structure.tests = await this.scanDirectory(path.join(projectPath, item.name));
          }
        } else {
          structure.files.push(item.name);

          // Identify special files
          if (item.name.endsWith('.md')) {
            structure.documentation.push(item.name);
          } else if (item.name === 'package.json') {
            const packagePath = path.join(projectPath, 'package.json');
            const packageData = await fs.readFile(packagePath, 'utf-8');
            structure.packageInfo = JSON.parse(packageData);
          } else if (item.name.endsWith('.json') || item.name.endsWith('.yaml')) {
            structure.configs.push(item.name);
          }
        }
      }
    } catch (error) {
      structure.error = error.message;
    }

    return structure;
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(dirPath) {
    const files = [];
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isFile()) {
          files.push(item.name);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    return files;
  }

  /**
   * Load and analyze knowledge base
   */
  async analyzeKnowledgeBase(company, instance = null) {
    const client = new MongoClient(this.mongoUri);

    try {
      await client.connect();
      const db = client.db('admin');
      const collection = db.collection('evolve');

      // Query parameters
      const query = { company };
      if (instance) {
        query.instance = instance;
      }

      // Get documents
      const documents = await collection.find(query).toArray();

      // Analyze structure
      const analysis = {
        documentCount: documents.length,
        instances: {},
        types: {},
        avgDocSize: 0,
        oldestDoc: null,
        newestDoc: null,
        queryPerformance: []
      };

      // Count by instance
      documents.forEach(doc => {
        const inst = doc.instance || 'unknown';
        analysis.instances[inst] = (analysis.instances[inst] || 0) + 1;

        const type = doc.type || 'unknown';
        analysis.types[type] = (analysis.types[type] || 0) + 1;

        // Track timestamps
        if (doc.timestamp) {
          if (!analysis.oldestDoc || doc.timestamp < analysis.oldestDoc) {
            analysis.oldestDoc = doc.timestamp;
          }
          if (!analysis.newestDoc || doc.timestamp > analysis.newestDoc) {
            analysis.newestDoc = doc.timestamp;
          }
        }
      });

      // Calculate average document size
      analysis.avgDocSize = Math.round(
        JSON.stringify(documents).length / documents.length
      );

      // Test query performance
      const testQueries = [
        { name: 'by_instance', query: { instance: 'v2' } },
        { name: 'by_type', query: { type: 'system_metadata' } },
        { name: 'by_company', query: { company } },
        { name: 'recent_10', query: {}, sort: { timestamp: -1 }, limit: 10 }
      ];

      for (const test of testQueries) {
        const start = Date.now();
        const cursor = collection.find(test.query);
        if (test.sort) cursor.sort(test.sort);
        if (test.limit) cursor.limit(test.limit);
        await cursor.toArray();
        const time = Date.now() - start;

        analysis.queryPerformance.push({
          name: test.name,
          time: `${time}ms`,
          acceptable: time < 100
        });
      }

      // Check indexes
      const indexes = await collection.indexes();
      analysis.indexes = indexes.map(idx => ({
        name: idx.name,
        keys: idx.key
      }));

      return analysis;
    } finally {
      await client.close();
    }
  }

  /**
   * Audit logging mechanisms
   */
  async auditLogging(projectPath) {
    const audit = {
      logsDirectoryExists: false,
      logFiles: [],
      categories: [],
      recentEntries: 0,
      sizeTotal: 0,
      recommendations: []
    };

    const logsPath = path.join(projectPath, 'logs');

    try {
      await fs.access(logsPath);
      audit.logsDirectoryExists = true;

      // Scan logs directory
      const items = await fs.readdir(logsPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          audit.categories.push(item.name);
        } else if (item.isFile()) {
          audit.logFiles.push(item.name);

          // Get file size
          const stats = await fs.stat(path.join(logsPath, item.name));
          audit.sizeTotal += stats.size;
        }
      }

      // Recommendations
      if (audit.categories.length === 0) {
        audit.recommendations.push('Create log categories: token-usage, workflows, audits, errors');
      }
      if (audit.sizeTotal > 100 * 1024 * 1024) { // 100MB
        audit.recommendations.push('Consider log rotation - total size exceeds 100MB');
      }
    } catch (error) {
      audit.recommendations.push('Create logs directory structure');
      audit.recommendations.push('Implement logging middleware');
      audit.recommendations.push('Add token usage tracking');
    }

    return audit;
  }

  /**
   * Analyze token usage patterns
   */
  async analyzeTokenUsage(company, days = 7) {
    const client = new MongoClient(this.mongoUri);

    try {
      await client.connect();
      const db = client.db('admin');
      const collection = db.collection('evolve');

      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const documents = await collection.find({
        company,
        timestamp: { $gte: cutoff }
      }).toArray();

      const analysis = {
        totalOperations: documents.length,
        tokenMetrics: {
          total: 0,
          average: 0,
          min: Infinity,
          max: 0
        },
        costMetrics: {
          total: 0,
          average: 0
        },
        cacheMetrics: {
          hitRate: 0,
          hits: 0,
          misses: 0
        },
        modelUsage: {},
        recommendations: []
      };

      // Analyze documents
      documents.forEach(doc => {
        if (doc.baseline_metrics || doc.target_metrics) {
          const metrics = doc.baseline_metrics || doc.target_metrics;

          if (metrics.avgTokensPerOperation) {
            const tokens = metrics.avgTokensPerOperation;
            analysis.tokenMetrics.total += tokens;
            analysis.tokenMetrics.min = Math.min(analysis.tokenMetrics.min, tokens);
            analysis.tokenMetrics.max = Math.max(analysis.tokenMetrics.max, tokens);
          }

          if (metrics.avgCostPerOperation) {
            analysis.costMetrics.total += metrics.avgCostPerOperation;
          }

          if (metrics.cacheHitRate !== undefined) {
            analysis.cacheMetrics.hitRate = metrics.cacheHitRate;
          }
        }
      });

      // Calculate averages
      if (documents.length > 0) {
        analysis.tokenMetrics.average = Math.round(
          analysis.tokenMetrics.total / documents.length
        );
        analysis.costMetrics.average = (
          analysis.costMetrics.total / documents.length
        ).toFixed(2);
      }

      // Generate recommendations
      if (analysis.tokenMetrics.average > 100000) {
        analysis.recommendations.push('High token usage detected - consider caching');
      }
      if (analysis.cacheMetrics.hitRate < 0.7) {
        analysis.recommendations.push('Cache hit rate below 70% - optimize caching strategy');
      }
      if (analysis.costMetrics.average > 5) {
        analysis.recommendations.push('High cost per operation - consider model selection optimization');
      }

      return analysis;
    } finally {
      await client.close();
    }
  }

  /**
   * Generate optimization proposals
   */
  generateOptimizationProposals(auditResults) {
    const proposals = [];

    // Analyze structure audit
    if (auditResults.structure) {
      if (auditResults.structure.agents.length === 0) {
        proposals.push({
          category: 'agents',
          priority: 'high',
          title: 'Add agent metadata system',
          description: 'Implement metadata-first agent discovery for 90% token reduction',
          estimatedImpact: {
            tokenReduction: 90,
            implementationTime: '2-4 hours'
          },
          confidence: 95
        });
      }

      if (auditResults.structure.workflows.length === 0) {
        proposals.push({
          category: 'workflows',
          priority: 'medium',
          title: 'Add workflow automation',
          description: 'Implement workflow coordinator for automated task handoffs',
          estimatedImpact: {
            timeReduction: 30,
            implementationTime: '2-3 hours'
          },
          confidence: 90
        });
      }
    }

    // Analyze token usage
    if (auditResults.tokenUsage) {
      if (auditResults.tokenUsage.tokenMetrics.average > 100000) {
        proposals.push({
          category: 'optimization',
          priority: 'critical',
          title: 'Implement intelligent caching',
          description: 'Add caching layer to reduce token usage by 50-70%',
          estimatedImpact: {
            tokenReduction: 60,
            costReduction: 60,
            implementationTime: '3-4 hours'
          },
          confidence: 95
        });
      }

      if (auditResults.tokenUsage.cacheMetrics.hitRate < 0.7) {
        proposals.push({
          category: 'optimization',
          priority: 'high',
          title: 'Optimize cache strategy',
          description: 'Adjust cache TTL and warming to increase hit rate',
          estimatedImpact: {
            cacheHitRateIncrease: 20,
            tokenReduction: 15,
            implementationTime: '1-2 hours'
          },
          confidence: 92
        });
      }
    }

    // Analyze logging
    if (auditResults.logging && !auditResults.logging.logsDirectoryExists) {
      proposals.push({
        category: 'infrastructure',
        priority: 'medium',
        title: 'Implement logging system',
        description: 'Add comprehensive logging for debugging and monitoring',
        estimatedImpact: {
          debuggingEfficiency: 50,
          implementationTime: '1-2 hours'
        },
        confidence: 98
      });
    }

    // Calculate overall confidence
    const overallConfidence = proposals.length > 0
      ? Math.round(proposals.reduce((sum, p) => sum + p.confidence, 0) / proposals.length)
      : 0;

    return {
      proposals,
      overallConfidence,
      meetsThreshold: overallConfidence >= this.confidenceThreshold
    };
  }

  /**
   * Create audit report
   */
  async createAuditReport(auditId, auditData, proposalsData) {
    const report = {
      auditId,
      timestamp: new Date().toISOString(),
      summary: {
        projectName: auditData.projectName,
        auditType: auditData.auditType,
        overallScore: 0,
        criticalIssues: 0,
        highPriorityIssues: 0,
        mediumPriorityIssues: 0
      },
      findings: {
        structure: auditData.structure,
        knowledgeBase: auditData.knowledgeBase,
        logging: auditData.logging,
        tokenUsage: auditData.tokenUsage
      },
      proposals: proposalsData.proposals,
      confidence: proposalsData.overallConfidence,
      recommendations: this.generateRecommendations(auditData, proposalsData),
      nextSteps: this.generateNextSteps(proposalsData)
    };

    // Calculate overall score (0-100)
    let score = 100;
    proposalsData.proposals.forEach(proposal => {
      if (proposal.priority === 'critical') score -= 20;
      else if (proposal.priority === 'high') score -= 10;
      else if (proposal.priority === 'medium') score -= 5;
    });
    report.summary.overallScore = Math.max(0, score);

    // Count issues
    report.summary.criticalIssues = proposalsData.proposals.filter(p => p.priority === 'critical').length;
    report.summary.highPriorityIssues = proposalsData.proposals.filter(p => p.priority === 'high').length;
    report.summary.mediumPriorityIssues = proposalsData.proposals.filter(p => p.priority === 'medium').length;

    // Save report
    const reportPath = path.join(this.logsBase, 'audits', `${auditId}-report.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(auditData, proposalsData) {
    const recommendations = [];

    if (proposalsData.overallConfidence >= this.confidenceThreshold) {
      recommendations.push({
        type: 'immediate',
        action: 'Proceed with proposed optimizations',
        rationale: `Confidence level (${proposalsData.overallConfidence}%) exceeds threshold`
      });
    } else {
      recommendations.push({
        type: 'caution',
        action: 'Review proposals carefully',
        rationale: `Confidence level (${proposalsData.overallConfidence}%) below threshold (${this.confidenceThreshold}%)`
      });
    }

    if (proposalsData.proposals.some(p => p.priority === 'critical')) {
      recommendations.push({
        type: 'urgent',
        action: 'Address critical issues first',
        rationale: 'Critical issues can significantly impact performance'
      });
    }

    return recommendations;
  }

  /**
   * Generate next steps
   */
  generateNextSteps(proposalsData) {
    const steps = [];

    // Sort proposals by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...proposalsData.proposals].sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    sorted.forEach((proposal, index) => {
      steps.push({
        step: index + 1,
        action: proposal.title,
        priority: proposal.priority,
        estimatedTime: proposal.estimatedImpact.implementationTime,
        confidence: proposal.confidence
      });
    });

    // Add testing step
    steps.push({
      step: steps.length + 1,
      action: 'Run A/B testing on optimizations',
      priority: 'high',
      estimatedTime: '2-4 hours',
      confidence: 95
    });

    // Add validation step
    steps.push({
      step: steps.length + 1,
      action: 'Validate improvements meet 95% confidence threshold',
      priority: 'critical',
      estimatedTime: '1-2 hours',
      confidence: 98
    });

    return steps;
  }

  /**
   * Log audit activity
   */
  async logActivity(auditId, activity, level = 'info') {
    const logEntry = {
      auditId,
      timestamp: new Date().toISOString(),
      level,
      activity
    };

    const logPath = path.join(this.logsBase, 'audits', `${auditId}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';

    await fs.appendFile(logPath, logLine);
  }
}

module.exports = AuditUtilities;
