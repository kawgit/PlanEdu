# Environment Setup

## Gemini API Configuration

The Schedule Builder uses Gemini AI for natural language constraint parsing.

### Why it's not working:

❌ **GEMINI_API_KEY not set**

The backend looks for `process.env.GEMINI_API_KEY` but can't find it.

### How to fix:

**Option 1: Create .env file (Recommended)**

```bash
cd apps/backend

# Create .env from example
cp .env.example .env

# Edit and add your Gemini API key
nano .env
```

Add this line:
```
GEMINI_API_KEY=your_actual_api_key_here
```

**Option 2: Set environment variable**

```bash
# For current session
export GEMINI_API_KEY="your_actual_api_key_here"

# Then start backend
cd apps/backend && npm run dev
```

**Option 3: Add to your shell profile**

```bash
# Add to ~/.zshrc or ~/.bashrc
echo 'export GEMINI_API_KEY="your_actual_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

### Get a Gemini API Key:

1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key
4. Add it to your `.env` file or environment

### Verify it works:

```bash
# Check if key is set
echo $GEMINI_API_KEY

# Should output your key (not empty)
```

### System Behavior:

**✅ With GEMINI_API_KEY:**
- Natural language parsing works
- "I want Friday off" → `disallowed_days` constraint
- "No morning classes" → `earliest_start` constraint

**⚠️ Without GEMINI_API_KEY:**
- Schedule Builder still works
- Natural language parsing is skipped
- Backend logs: "⚠️ GEMINI_API_KEY not set - skipping LLM constraint parsing"
- Manual constraints still work

### Testing:

```bash
# Set key for testing
export GEMINI_API_KEY="your_key"

# Run LLM parsing tests
node apps/backend/tests/test-llm-parsing.js
```

---

**Quick Fix:** Add `GEMINI_API_KEY` to `apps/backend/.env` and restart backend!
