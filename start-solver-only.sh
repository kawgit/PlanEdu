#!/bin/bash
# Start only the solver service

echo "🚀 Starting Solver Service..."
echo ""

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Navigate to solver directory
cd apps/solver

# Start uvicorn
echo "Starting uvicorn on port 8000..."
echo "Press Ctrl+C to stop"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

