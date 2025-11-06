#!/bin/bash
# Start both dashboard backend and frontend

echo "🚀 Starting SynthiaFuse Dashboard..."
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Start backend
echo "📊 Starting backend API server (port 4500)..."
cd "$PROJECT_ROOT/dashboard/backend"
node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 2

# Start frontend
echo ""
echo "🎨 Starting frontend dashboard (port 3847)..."
cd "$PROJECT_ROOT/dashboard/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Dashboard started!"
echo ""
echo "Backend API:  http://localhost:4500"
echo "Frontend UI:  http://localhost:3847"
echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "Or use: ./scripts/stop-dashboard.sh"
echo ""

# Save PIDs for stop script
echo "$BACKEND_PID" > /tmp/synthiafuse-dashboard-backend.pid
echo "$FRONTEND_PID" > /tmp/synthiafuse-dashboard-frontend.pid

# Wait for both processes
wait
