#!/bin/bash
# Startup script for AI Schedule Builder
# Launches all three required services

set -e

echo "🚀 Starting AI Schedule Builder System"
echo "======================================"
echo ""

# Check if running from project root
if [ ! -d "apps/solver" ] || [ ! -d "apps/backend" ] || [ ! -d "apps/frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check Python virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found. Please run:"
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check if services are already running
if check_port 8000; then
    echo "⚠️  Warning: Port 8000 already in use (Solver Service)"
    echo "   Kill existing process? [y/N]"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   Continuing with existing service..."
    fi
fi

if check_port 3001; then
    echo "⚠️  Warning: Port 3001 already in use (Backend)"
    echo "   Kill existing process? [y/N]"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

if check_port 5173; then
    echo "⚠️  Warning: Port 5173 already in use (Frontend)"
    echo "   Kill existing process? [y/N]"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

echo ""
echo "📦 Installing dependencies (if needed)..."
echo ""

# Install Python dependencies
source venv/bin/activate
cd apps/solver
pip install -q -r requirements.txt 2>&1 | grep -v "already satisfied" || true
cd ../..

# Install Node dependencies (if needed)
cd apps/backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install --silent
fi
cd ../..

cd apps/frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install --silent
fi
cd ../..

echo ""
echo "✅ Dependencies ready"
echo ""
echo "🎬 Starting services..."
echo ""

# Create log directory
mkdir -p logs

# Start Solver Service
echo "1️⃣  Starting Solver Service (port 8000)..."
cd apps/solver
source ../../venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ../../logs/solver.log 2>&1 &
SOLVER_PID=$!
cd ../..
sleep 2

# Check if solver started
if ! check_port 8000; then
    echo "❌ Error: Solver Service failed to start"
    echo "   Check logs/solver.log for details"
    exit 1
fi
echo "   ✅ Solver Service running (PID: $SOLVER_PID)"

# Start Backend
echo "2️⃣  Starting Backend (port 3001)..."
cd apps/backend
nohup npm run dev > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ../..
sleep 3

# Check if backend started
if ! check_port 3001; then
    echo "❌ Error: Backend failed to start"
    echo "   Check logs/backend.log for details"
    kill $SOLVER_PID 2>/dev/null || true
    exit 1
fi
echo "   ✅ Backend running (PID: $BACKEND_PID)"

# Start Frontend
echo "3️⃣  Starting Frontend (port 5173)..."
cd apps/frontend
nohup npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..
sleep 3

# Check if frontend started
if ! check_port 5173; then
    echo "❌ Error: Frontend failed to start"
    echo "   Check logs/frontend.log for details"
    kill $SOLVER_PID $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo "   ✅ Frontend running (PID: $FRONTEND_PID)"

echo ""
echo "======================================"
echo "✅ All services started successfully!"
echo "======================================"
echo ""
echo "📍 Service URLs:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3001"
echo "   Solver:    http://localhost:8000"
echo ""
echo "📊 Process IDs:"
echo "   Solver:    $SOLVER_PID"
echo "   Backend:   $BACKEND_PID"
echo "   Frontend:  $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Solver:    logs/solver.log"
echo "   Backend:   logs/backend.log"
echo "   Frontend:  logs/frontend.log"
echo ""
echo "💡 Quick Commands:"
echo "   Test Solver:   curl http://localhost:8000/health"
echo "   Test Backend:  curl http://localhost:3001/api/schedule/test"
echo "   View Logs:     tail -f logs/*.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $SOLVER_PID $BACKEND_PID $FRONTEND_PID"
echo "   Or run: ./stop-schedule-builder.sh"
echo ""
echo "🌐 Open your browser to http://localhost:5173 to use the app!"
echo ""

# Save PIDs to file for stop script
echo "$SOLVER_PID $BACKEND_PID $FRONTEND_PID" > .schedule-builder.pids

# Optionally tail logs
echo "Press Ctrl+C to stop tailing logs (services will keep running)"
echo ""
trap "echo ''; echo 'Services are still running in the background'; exit 0" INT
tail -f logs/*.log

