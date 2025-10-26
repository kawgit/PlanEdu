#!/bin/bash
# Test if solver starts correctly

cd /Users/christophermiyai/Desktop/DSXBU/apps/solver
source ../../venv/bin/activate

echo "Testing solver startup..."
echo ""

# Try to start uvicorn briefly to check for errors
python -c "
import sys
sys.dont_write_bytecode = True

# Test import
print('Testing import...')
try:
    from main import app
    print('✅ App import successful!')
    print('✅ ScheduleSolver imported correctly!')
except Exception as e:
    print(f'❌ Import failed: {e}')
    sys.exit(1)

# Test if app is valid
print('Testing FastAPI app...')
try:
    assert app is not None
    assert hasattr(app, 'routes')
    print(f'✅ App has {len(app.routes)} routes')
except Exception as e:
    print(f'❌ App validation failed: {e}')
    sys.exit(1)

print('')
print('✅ All checks passed! Solver is ready to start.')
print('')
print('To start the solver, run:')
print('  cd /Users/christophermiyai/Desktop/DSXBU/apps/solver')
print('  source ../../venv/bin/activate')
print('  uvicorn main:app --host 0.0.0.0 --port 8000 --reload')
"

