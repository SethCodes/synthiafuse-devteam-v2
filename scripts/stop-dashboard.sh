#!/bin/bash
# Stop dashboard backend and frontend

echo "🛑 Stopping SynthiaFuse Dashboard..."

# Read PIDs from saved files
if [ -f /tmp/synthiafuse-dashboard-backend.pid ]; then
  BACKEND_PID=$(cat /tmp/synthiafuse-dashboard-backend.pid)
  echo "Stopping backend (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null
  rm /tmp/synthiafuse-dashboard-backend.pid
fi

if [ -f /tmp/synthiafuse-dashboard-frontend.pid ]; then
  FRONTEND_PID=$(cat /tmp/synthiafuse-dashboard-frontend.pid)
  echo "Stopping frontend (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID 2>/dev/null
  rm /tmp/synthiafuse-dashboard-frontend.pid
fi

# Also kill by port in case PID files don't exist
echo "Cleaning up processes on ports 4500 and 3847..."
lsof -ti:4500 | xargs kill -9 2>/dev/null
lsof -ti:3847 | xargs kill -9 2>/dev/null

echo "✅ Dashboard stopped"
