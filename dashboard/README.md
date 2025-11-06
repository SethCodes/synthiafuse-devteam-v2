# SynthiaFuse DevTeam V2 Dashboard

Real-time monitoring and workflow management dashboard for the SynthiaFuse DevTeam V2 system.

## Features

- **System Health Monitoring** - Real-time token usage, cache hit rates, and performance metrics
- **Service Controls** - Toggle optimization engine, monitoring, and background workers
- **Workflow Management** - View, start, stop, and schedule automated workflows
- **Agent Feed** - Live feed of active agents and their current tasks
- **Activity Feed** - Recent system events and completions
- **Real-time Updates** - WebSocket-based live data streaming

## Architecture

```
┌─────────────────────────────────────────┐
│   React Dashboard (Port 3847)           │
│   - Real-time metrics display           │
│   - Service toggles                     │
│   - Workflow scheduler                  │
│   - Agent status feed                   │
└──────────────┬──────────────────────────┘
               │ WebSocket/REST API
┌──────────────▼──────────────────────────┐
│   Express API Server (Port 4500)        │
│   - REST endpoints for metrics          │
│   - WebSocket server                    │
│   - Workflow registry                   │
│   - Service control                     │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Start Backend API Server

```bash
cd dashboard/backend
npm install
npm start
```

The API server will start on **http://localhost:4500**

### 2. Start React Dashboard

```bash
cd dashboard/frontend
npm install
npm run dev
```

The dashboard will be available at **http://localhost:3847**

## Development

### Backend Development

```bash
cd dashboard/backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development

```bash
cd dashboard/frontend
npm run dev  # Vite dev server with HMR
```

## API Endpoints

### REST API

- `GET /api/health` - Health check
- `GET /api/metrics` - Current system metrics
- `GET /api/budget` - Token budget status
- `GET /api/agents` - Active agents list
- `GET /api/workflows` - Workflow list with schedules
- `GET /api/activity` - Recent activity feed
- `POST /api/services/:service/toggle` - Toggle service on/off
- `POST /api/workflows/:id/start` - Start a workflow
- `POST /api/workflows/:id/stop` - Stop a workflow
- `PUT /api/workflows/:id/schedule` - Update workflow schedule

### WebSocket Events

**Client receives:**
- `metrics` - System metrics update
- `budget` - Budget status update
- `agents` - Active agents update
- `workflows` - Workflows list update
- `alert` - System alerts
- `workflow-started` - Workflow started event
- `workflow-completed` - Workflow completed event
- `workflow-failed` - Workflow failed event
- `workflow-stopped` - Workflow stopped event
- `service-toggled` - Service state changed

## Workflow Management

Workflows can be:
- **Manual** - Triggered on demand via dashboard
- **Scheduled** - Triggered by cron schedule
- **Event-based** - Triggered by system events

### Cron Schedule Format

Workflows use standard cron syntax:
```
cron:0 2 * * *  # Daily at 2:00 AM
cron:0 * * * *  # Every hour
cron:0 0 * * 0  # Weekly on Sunday at midnight
```

### Default Workflows

1. **Daily Optimization Cycle** - Runs at 2 AM daily
2. **Cache Warming** - Manual trigger to warm agent caches
3. **Idea Research Batch** - Runs at 3 AM daily

## Components

### Frontend Components

- `SystemHealth.jsx` - System health indicators and key metrics
- `MetricsCharts.jsx` - Token usage charts and performance graphs
- `ServiceControls.jsx` - Service toggle buttons
- `WorkflowManager.jsx` - Workflow list with start/stop/schedule controls
- `AgentFeed.jsx` - Live agent status feed
- `ActivityFeed.jsx` - Recent system activity log

### Backend Classes

- `DashboardServer` - Main server class
- Workflow registry system
- Mock data generators (will be replaced with real V2 integrations)

## Production Build

```bash
cd dashboard/frontend
npm run build
```

Build artifacts will be in `dashboard/frontend/dist/`

## Integration with V2 Components

The dashboard integrates with:
- `PerformanceDashboard` - System metrics
- `TokenBudgetManager` - Budget tracking
- `IntelligentModelSelector` - Model selection stats
- `ContinuousOptimizationEngine` - Auto-tuning system

## Next Steps

1. ✅ React dashboard with real-time updates
2. ✅ Workflow management UI
3. ✅ Service controls
4. 🔲 Integrate with real agent system
5. 🔲 Add authentication
6. 🔲 Implement workflow execution engine
7. 🔲 Add historical metrics/charts
8. 🔲 Mobile responsive design improvements

## Technical Stack

- **Frontend**: React 19, Vite, Recharts, Socket.io Client
- **Backend**: Node.js, Express, Socket.io, CORS
- **Ports**: 3847 (frontend), 4500 (backend)
