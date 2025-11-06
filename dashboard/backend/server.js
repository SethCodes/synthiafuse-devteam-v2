/**
 * SynthiaFuse DevTeam V2 - Dashboard API Server
 * Real-time API server that exposes metrics, controls, and workflow management
 * Port: 4500
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

class DashboardServer {
  constructor(options = {}) {
    this.port = options.port || 4500;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: 'http://localhost:3847',
        methods: ['GET', 'POST']
      }
    });

    // Initialize components (mock for now)
    this.workflows = new Map();
    this.activeWorkflows = new Set();
    this.workflowSchedules = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.registerDefaultWorkflows();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // Get current metrics
    this.app.get('/api/metrics', (req, res) => {
      res.json({
        success: true,
        data: this.getMockMetrics()
      });
    });

    // Get budget status
    this.app.get('/api/budget', (req, res) => {
      res.json({
        success: true,
        data: this.getMockBudget()
      });
    });

    // Get active agents
    this.app.get('/api/agents', (req, res) => {
      res.json({
        success: true,
        data: {
          active: this.getActiveAgents(),
          total: 119,
          timestamp: Date.now()
        }
      });
    });

    // Service controls
    this.app.post('/api/services/:service/toggle', (req, res) => {
      const { service } = req.params;
      const { enabled } = req.body;

      try {
        this.toggleService(service, enabled);
        res.json({
          success: true,
          message: `Service ${service} ${enabled ? 'enabled' : 'disabled'}`
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Workflow management
    this.app.get('/api/workflows', (req, res) => {
      res.json({
        success: true,
        data: this.getWorkflowList()
      });
    });

    this.app.post('/api/workflows/:id/start', (req, res) => {
      const { id } = req.params;
      try {
        this.startWorkflow(id);
        res.json({ success: true, message: `Workflow ${id} started` });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/workflows/:id/stop', (req, res) => {
      const { id } = req.params;
      try {
        this.stopWorkflow(id);
        res.json({ success: true, message: `Workflow ${id} stopped` });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/workflows/:id/schedule', (req, res) => {
      const { id } = req.params;
      const { schedule } = req.body;

      try {
        this.updateWorkflowSchedule(id, schedule);
        res.json({ success: true, message: `Schedule updated for ${id}` });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Activity feed
    this.app.get('/api/activity', (req, res) => {
      res.json({
        success: true,
        data: this.getRecentActivity()
      });
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('Dashboard connected:', socket.id);

      // Send initial data
      socket.emit('metrics', this.getMockMetrics());
      socket.emit('workflows', this.getWorkflowList());
      socket.emit('agents', { active: this.getActiveAgents(), total: 119 });

      socket.on('disconnect', () => {
        console.log('Dashboard disconnected:', socket.id);
      });
    });

    // Emit updates every 2 seconds
    setInterval(() => {
      this.io.emit('metrics', this.getMockMetrics());
      this.io.emit('budget', this.getMockBudget());
      this.io.emit('agents', { active: this.getActiveAgents(), total: 119 });
    }, 2000);
  }

  getMockMetrics() {
    return {
      tokenUsage: {
        hourly: Math.floor(Math.random() * 10000) + 5000,
        daily: Math.floor(Math.random() * 100000) + 50000,
        weekly: Math.floor(Math.random() * 500000) + 250000
      },
      performance: {
        avgResponseTime: (Math.random() * 2 + 1).toFixed(2),
        throughput: Math.floor(Math.random() * 50) + 20,
        cacheHitRate: (Math.random() * 20 + 75).toFixed(1)
      },
      optimization: {
        tokensSaved: Math.floor(Math.random() * 50000) + 100000,
        savingsPercentage: (Math.random() * 5 + 92).toFixed(1)
      }
    };
  }

  getMockBudget() {
    return {
      hourly: {
        used: Math.floor(Math.random() * 8000) + 2000,
        limit: 15000,
        percentage: ((Math.random() * 40 + 20)).toFixed(1)
      },
      daily: {
        used: Math.floor(Math.random() * 60000) + 30000,
        limit: 200000,
        percentage: ((Math.random() * 30 + 30)).toFixed(1)
      }
    };
  }

  toggleService(service, enabled) {
    console.log(`Service ${service} ${enabled ? 'enabled' : 'disabled'}`);
    this.io.emit('service-toggled', { service, enabled });
  }

  getActiveAgents() {
    const agents = [
      { id: 'lead-developer', name: 'Lead Developer', status: 'active', currentTask: 'Code review PR #47' },
      { id: 'qa-engineer', name: 'QA Engineer', status: 'active', currentTask: 'Running test suite' },
      { id: 'project-manager', name: 'Project Manager', status: 'idle', currentTask: null }
    ];

    return agents.map(agent => ({
      ...agent,
      lastActivity: Date.now() - Math.floor(Math.random() * 300000)
    }));
  }

  getWorkflowList() {
    return Array.from(this.workflows.values()).map(workflow => ({
      ...workflow,
      isActive: this.activeWorkflows.has(workflow.id),
      schedule: this.workflowSchedules.get(workflow.id)
    }));
  }

  registerWorkflow(workflow) {
    this.workflows.set(workflow.id, {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      type: workflow.type,
      triggers: workflow.triggers || [],
      handler: workflow.handler
    });
  }

  startWorkflow(id) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new Error(`Workflow ${id} not found`);
    if (this.activeWorkflows.has(id)) throw new Error(`Workflow ${id} already running`);

    this.activeWorkflows.add(id);
    this.io.emit('workflow-started', { id, timestamp: Date.now() });

    if (workflow.handler) {
      workflow.handler().then(() => {
        this.activeWorkflows.delete(id);
        this.io.emit('workflow-completed', { id, timestamp: Date.now() });
      }).catch(error => {
        this.activeWorkflows.delete(id);
        this.io.emit('workflow-failed', { id, error: error.message });
      });
    }
  }

  stopWorkflow(id) {
    if (!this.activeWorkflows.has(id)) throw new Error(`Workflow ${id} not running`);
    this.activeWorkflows.delete(id);
    this.io.emit('workflow-stopped', { id, timestamp: Date.now() });
  }

  updateWorkflowSchedule(id, schedule) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new Error(`Workflow ${id} not found`);
    this.workflowSchedules.set(id, schedule);
    this.io.emit('workflow-schedule-updated', { id, schedule });
  }

  getRecentActivity() {
    return [
      { timestamp: Date.now() - 30000, type: 'task-completed', message: 'Code review completed: PR #47', agent: 'lead-developer' },
      { timestamp: Date.now() - 60000, type: 'optimization', message: 'Auto-tuning completed: 3 adjustments', agent: 'system' },
      { timestamp: Date.now() - 120000, type: 'cache-warming', message: 'Cache warmed: 5 agents loaded', agent: 'system' }
    ];
  }

  registerDefaultWorkflows() {
    this.registerWorkflow({
      id: 'daily-optimization',
      name: 'Daily Optimization Cycle',
      description: 'Run comprehensive optimization analysis',
      type: 'scheduled',
      triggers: ['cron:0 2 * * *'],
      handler: async () => console.log('Running daily optimization...')
    });

    this.registerWorkflow({
      id: 'cache-warming',
      name: 'Cache Warming',
      description: 'Warm frequently-used agent caches',
      type: 'manual',
      handler: async () => console.log('Warming caches...')
    });

    this.registerWorkflow({
      id: 'idea-research',
      name: 'Idea Research Batch',
      description: 'Research queued ideas and generate POCs',
      type: 'scheduled',
      triggers: ['cron:0 3 * * *'],
      handler: async () => console.log('Researching ideas...')
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`\n🚀 Dashboard API Server running on http://localhost:${this.port}`);
      console.log(`📊 WebSocket server ready for connections`);
      console.log(`🎨 Connect React app to this server\n`);
    });
  }

  stop() {
    this.server.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new DashboardServer({ port: 4500 });
  server.start();

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard server...');
    server.stop();
    process.exit(0);
  });
}

module.exports = DashboardServer;
