#!/bin/bash
# Stop script for AI Schedule Builder

echo "🛑 Stopping AI Schedule Builder services..."

# Read PIDs from file if exists
if [ -f ".schedule-builder.pids" ]; then
    read -r SOLVER_PID BACKEND_PID FRONTEND_PID < .schedule-builder.pids
    
    echo "Stopping services..."
    kill $SOLVER_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    
    # Wait a moment
    sleep 1
    
    # Force kill if still running
    kill -9 $SOLVER_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    
    rm .schedule-builder.pids
    echo "✅ Services stopped"
else
    # Fallback: kill by port
    echo "No PID file found, stopping by port..."
    
    if lsof -ti:8000 >/dev/null 2>&1; then
        lsof -ti:8000 | xargs kill -9
        echo "   Stopped Solver (port 8000)"
    fi
    
    if lsof -ti:3001 >/dev/null 2>&1; then
        lsof -ti:3001 | xargs kill -9
        echo "   Stopped Backend (port 3001)"
    fi
    
    if lsof -ti:5173 >/dev/null 2>&1; then
        lsof -ti:5173 | xargs kill -9
        echo "   Stopped Frontend (port 5173)"
    fi
    
    echo "✅ Services stopped"
fi

