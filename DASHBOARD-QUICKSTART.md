# Dashboard Quick Start Guide

## What Was Built

A full-featured React dashboard for monitoring and controlling the SynthiaFuse DevTeam V2 system.

## Features You Requested

✅ **Visual Dashboard** - Modern React UI on port 3847
✅ **Real-time Updates** - WebSocket streaming every 2 seconds
✅ **Service Controls** - Toggle optimization, monitoring, background worker
✅ **Workflow Management** - View, start, stop, and schedule workflows
✅ **Agent Status Feed** - See what agents are doing in real-time
✅ **Activity Feed** - Recent system events
✅ **Unusual Ports** - Frontend: 3847, Backend: 4500

## Quick Start

### Option 1: Use Scripts (Easiest)

```bash
# Start both servers
./scripts/start-dashboard.sh

# Stop both servers
./scripts/stop-dashboard.sh
```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd dashboard/backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd dashboard/frontend
npm run dev
```

### Option 3: First Time Setup

If you haven't installed dependencies yet:

```bash
# Install backend
cd dashboard/backend
npm install

# Install frontend
cd dashboard/frontend
npm install

# Then use Option 1 or 2
```

## Access the Dashboard

Once running, open: **http://localhost:3847**

## Workflow Management

### What You Can Do:

1. **View All Workflows** - See all registered workflows with their types and schedules
2. **Start/Stop Workflows** - Manual control with buttons
3. **Edit Schedules** - Click "Edit Schedule" to modify cron timings
4. **See Status** - Running workflows highlighted in green

### Default Workflows:

- **Daily Optimization Cycle** - Scheduled: 2:00 AM daily
- **Cache Warming** - Manual trigger
- **Idea Research Batch** - Scheduled: 3:00 AM daily

### Cron Format Examples:

```
cron:0 2 * * *   → Daily at 2:00 AM
cron:0 * * * *   → Every hour
cron:0 0 * * 0   → Weekly on Sunday at midnight
cron:*/15 * * * * → Every 15 minutes
```

## Dashboard Sections

### 1. System Health
- Token budget usage (hourly/daily)
- Cache hit rate
- Token savings percentage
- System throughput

### 2. Metrics Charts
- Token usage visualization (bar charts)
- Response time tracking
- Weekly usage trends

### 3. Service Controls
- Continuous Optimization (ON/OFF)
- Performance Monitoring (ON/OFF)
- Background Worker (ON/OFF)

### 4. Workflow Manager
- View all workflows
- Start/stop workflows
- Edit schedules
- See running status

### 5. Agent Feed
- Live agent status
- Current tasks
- Last activity time

### 6. Activity Feed
- Recent completions
- System events
- Optimization runs

## API Endpoints

The backend exposes:
- REST API on **http://localhost:4500/api/**
- WebSocket on **http://localhost:4500**

See `dashboard/README.md` for full API documentation.

## Development

### Hot Reload

Both servers support hot reload:
- **Backend:** Uses nodemon (`npm run dev`)
- **Frontend:** Vite HMR (`npm run dev`)

### Adding New Workflows

Edit `dashboard/backend/server.js` and add to `registerDefaultWorkflows()`:

```javascript
this.registerWorkflow({
  id: 'my-workflow',
  name: 'My Custom Workflow',
  description: 'Does something cool',
  type: 'scheduled',
  triggers: ['cron:0 4 * * *'], // 4 AM daily
  handler: async () => {
    // Your workflow logic here
  }
});
```

## Next Steps

1. Start the dashboard with `./scripts/start-dashboard.sh`
2. Open http://localhost:3847 in your browser
3. Explore the workflow management interface
4. Test starting/stopping workflows
5. Try editing a workflow schedule

## Troubleshooting

**Port already in use:**
```bash
./scripts/stop-dashboard.sh
lsof -ti:4500 | xargs kill -9
lsof -ti:3847 | xargs kill -9
```

**Dependencies not installed:**
```bash
cd dashboard/backend && npm install
cd dashboard/frontend && npm install
```

**Can't connect:**
- Check backend is running on port 4500
- Check frontend is running on port 3847
- Look for errors in terminal output

## Files Created

```
dashboard/
├── README.md                     # Full documentation
├── backend/
│   ├── package.json
│   └── server.js                 # API + WebSocket server
└── frontend/
    ├── package.json
    ├── vite.config.js            # Port 3847 config
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx               # Main app
        └── components/
            ├── SystemHealth.jsx
            ├── MetricsCharts.jsx
            ├── ServiceControls.jsx
            ├── WorkflowManager.jsx  ← KEY COMPONENT
            ├── AgentFeed.jsx
            └── ActivityFeed.jsx

scripts/
├── start-dashboard.sh            # Start both servers
└── stop-dashboard.sh             # Stop both servers
```

## Commits Made

1. `a6924e8` - Add React dashboard with real-time monitoring and workflow management
2. `6967769` - Add dashboard startup/shutdown scripts for easy launch

All changes committed to local git repository.
