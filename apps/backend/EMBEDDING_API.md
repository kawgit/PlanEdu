# User Embedding API Documentation

This document describes the TypeScript-Python integration for generating user embeddings based on their academic profile.

## Architecture

```
TypeScript Backend (Express) 
    ↓
runPython.ts (utility)
    ↓
recommend.py (Python script)
    ↓
OpenAI API (text-embedding-3-small)
```

## Components

### 1. `runPython.ts` - Python Process Manager

Located at: `apps/backend/src/utils/runPython.ts`

**Purpose**: Spawns Python processes and handles JSON communication via stdin/stdout.

**Features**:
- Generic TypeScript utility for running any Python script
- Sends JSON input via stdin
- Receives and parses JSON output from stdout
- Error handling for process failures and JSON parsing errors
- Type-safe with TypeScript generics

**Usage**:
```typescript
import { runPythonScript } from './utils/runPython';

const result = await runPythonScript<{ embedding: number[] }>(
  '../../scripts/recommend.py',
  { major: 'CS', interests: ['AI'], courses_taken: ['CS111'] }
);
```

### 2. `recommend.ts` - Express Route

Located at: `apps/backend/src/routes/recommend.ts`

**Endpoint**: `POST /api/user-embedding`

**Request Body**:
```json
{
  "major": "Computer Science",
  "interests": ["Machine Learning", "Web Development"],
  "courses_taken": ["CASCS 111", "CASCS 112", "CASMA 123"]
}
```

**Response** (Success - 200):
```json
{
  "embedding": [0.123, -0.456, 0.789, ...]
}
```

**Response** (Error - 500):
```json
{
  "error": "Failed to generate user embedding",
  "details": "Error message here"
}
```

**Validation**:
- At least one of `major`, `interests`, or `courses_taken` must be provided
- `interests` and `courses_taken` must be arrays if provided

### 3. `recommend.py` - Python Script

Located at: `apps/scripts/recommend.py`

**Purpose**: Generates embeddings using OpenAI's text-embedding-3-small model.

**Input** (via stdin as JSON):
```json
{
  "major": "Computer Science",
  "interests": ["Machine Learning"],
  "courses_taken": ["CASCS 111"]
}
```

**Output** (via stdout as JSON):
```json
{
  "embedding": [0.123, -0.456, ...]
}
```

**Error Output**:
```json
{
  "error": "Error message here"
}
```

**Environment Variables**:
- `OPENAI_API_KEY` - Required for OpenAI API access

## Setup

### 1. Install Python Dependencies

```bash
# From project root
source venv/bin/activate
pip install openai python-dotenv
```

### 2. Set Environment Variables

Add to `.env` file in project root:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Install TypeScript Dependencies

```bash
cd apps/backend
npm install
```

## Testing

### Manual Test via cURL

```bash
curl -X POST http://localhost:3001/api/user-embedding \
  -H "Content-Type: application/json" \
  -d '{
    "major": "Computer Science",
    "interests": ["Machine Learning", "AI"],
    "courses_taken": ["CASCS 111", "CASCS 112"]
  }'
```

### Test Script

```bash
# Start the backend server first
cd apps/backend
npm run dev

# In another terminal, run the test
cd apps/backend
node test-embedding.js
```

## Integration with Frontend

Example usage in a React component:

```typescript
const generateUserEmbedding = async (user: UserProfile) => {
  try {
    const response = await fetch('http://localhost:3001/api/user-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        major: user.major,
        interests: user.interests,
        courses_taken: user.completedCourses.map(c => c.code)
      })
    });
    
    if (!response.ok) throw new Error('Failed to generate embedding');
    
    const { embedding } = await response.json();
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};
```

## Extending the System

### Adding New Python Scripts

1. Create your Python script in `apps/scripts/`
2. Follow the input/output pattern:
   - Read JSON from stdin
   - Output JSON to stdout
   - Handle errors by printing JSON with "error" key

Example template:
```python
import sys
import json

def process_data(input_data):
    # Your logic here
    return {"result": "success"}

if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        result = process_data(data)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
```

3. Create a new route in `apps/backend/src/routes/` that uses `runPythonScript()`

### Adding New Routes

```typescript
import { Router } from 'express';
import { runPythonScript } from '../utils/runPython';

const router = Router();

router.post('/your-endpoint', async (req, res) => {
  try {
    const result = await runPythonScript(
      '../../scripts/your-script.py',
      req.body
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Performance Considerations

1. **API Rate Limits**: OpenAI has rate limits on API calls
2. **Caching**: Consider caching embeddings for user profiles that don't change
3. **Async Processing**: For batch operations, consider using a job queue
4. **Error Handling**: Implement retries for transient API failures

## Security

1. **API Keys**: Never expose OpenAI API keys in frontend code
2. **Input Validation**: Always validate user input before processing
3. **Rate Limiting**: Implement rate limiting on the endpoint to prevent abuse
4. **Authentication**: Add authentication middleware to protect the endpoint

## Troubleshooting

### "Python script exited with code 1"
- Check OPENAI_API_KEY is set in .env
- Verify Python dependencies are installed
- Check Python script logs for error details

### "Failed to start Python process"
- Ensure Python3 is installed and in PATH
- Verify the script path is correct relative to the compiled JavaScript
- Check file permissions on the Python script

### "Failed to parse JSON output"
- Check Python script is outputting valid JSON
- Ensure no print statements before the JSON output
- Verify no extra whitespace or characters in output

