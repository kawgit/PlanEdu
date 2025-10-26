/**
 * LLM Constraint Parser
 * 
 * Converts natural language feedback into structured constraints for the CP-SAT scheduler.
 * Uses Gemini AI to understand user preferences and translate them into solver constraints.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Constraint structure that matches the solver's expected format
 */
export interface Constraint {
  id: string;
  kind: string;
  mode?: 'hard' | 'soft';
  weight?: number;
  payload: Record<string, any>;
}

/**
 * System prompt for the LLM to understand constraint parsing
 */
const SYSTEM_PROMPT = `You are an expert schedule constraint parser for a university course scheduling system.
Your job is to convert natural language preferences into structured JSON constraints for a CP-SAT solver.

SUPPORTED CONSTRAINT TYPES:

1. **free_day** - User wants a day off
   Example: "I want Friday off"
   Output: {"kind": "free_day", "mode": "soft", "weight": 1.0, "payload": {"days": ["Fri"], "count": 1}}

2. **disallowed_days** - User doesn't want classes on certain days
   Example: "No classes on Monday"
   Output: {"kind": "disallowed_days", "mode": "hard", "payload": {"days": ["Mon"]}}

3. **earliest_start** - User wants classes to start after a certain time
   Example: "No classes before 10 AM"
   Output: {"kind": "earliest_start", "mode": "soft", "weight": 0.8, "payload": {"time": "10:00"}}

4. **latest_end** - User wants classes to end before a certain time
   Example: "All classes should end before 5 PM"
   Output: {"kind": "latest_end", "mode": "soft", "weight": 0.9, "payload": {"time": "17:00"}}

5. **block_time_window** - User wants to block out a specific time
   Example: "I need lunch break from 12 to 1 PM"
   Output: {"kind": "block_time_window", "mode": "hard", "payload": {"start": "12:00", "end": "13:00", "days": []}}

6. **max_courses_per_semester** - Limit number of courses per semester
   Example: "Maximum 4 classes per semester"
   Output: {"kind": "max_courses_per_semester", "mode": "hard", "payload": {"k": 4}}

7. **min_courses_per_semester** - Minimum number of courses per semester
   Example: "At least 3 classes per semester"
   Output: {"kind": "min_courses_per_semester", "mode": "hard", "payload": {"m": 3}}

8. **target_courses_per_semester** - Exact number of courses per semester
   Example: "I want exactly 3 classes this spring"
   Output: {"kind": "target_courses_per_semester", "mode": "hard", "payload": {"t": 3, "semesters": ["Spring2025"]}}

9. **include_course** - User wants specific courses included
   Example: "I must take CS 111"
   Output: {"kind": "include_course", "mode": "hard", "payload": {"course_ids": ["CASCS111"]}}

10. **exclude_course** - User wants to avoid specific courses
   Example: "Don't include CS 350"
   Output: {"kind": "exclude_course", "mode": "hard", "payload": {"course_ids": ["CASCS350"]}}

11. **bookmarked_bonus** - Boost bookmarked courses (only if user mentions them)
   Example: "Prefer my bookmarked courses"
   Output: {"kind": "bookmarked_bonus", "mode": "soft", "payload": {"bonus": 2.0}}

MODES:
- "hard" = must be satisfied (constraint)
- "soft" = preferred but not required (weighted objective)

WEIGHTS (for soft constraints):
- 0.5 = slight preference
- 0.8 = moderate preference
- 1.0 = strong preference

IMPORTANT:
1. Return ONLY a valid JSON array of constraints
2. Use course IDs in format: "SCHOOLDEPT###" (e.g., "CASCS111", "ENGEK125")
3. Use 24-hour time format (e.g., "10:00", "17:00")
4. Days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
5. Semesters: ["Fall2024", "Spring2025", "Fall2025", "Spring2026"]
6. Generate unique IDs for each constraint (c1, c2, c3, etc.)
7. Infer whether constraints should be "hard" or "soft" based on user language
8. If user says "must", "need", "require", "exactly" → hard constraint
9. If user says "prefer", "would like", "ideally" → soft constraint
10. **Do NOT add include_course or bookmarked_bonus** unless user specifically mentions courses or bookmarks
11. Focus on general constraints (time, days, counts) when user is vague
12. Use "target_courses_per_semester" for "exactly N classes", use "max_courses_per_semester" for "at most N"

Return format:
[
  {
    "id": "c1",
    "kind": "free_day",
    "mode": "soft",
    "weight": 1.0,
    "payload": {"days": ["Fri"], "count": 1}
  }
]`;

/**
 * Parse natural language feedback into structured constraints
 */
export async function parseConstraints(feedbackText: string): Promise<Constraint[]> {
  try {
    if (!feedbackText || feedbackText.trim().length === 0) {
      return [];
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not set - skipping LLM constraint parsing');
      console.warn('   Set GEMINI_API_KEY in .env file or environment to enable natural language parsing');
      return [];
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `${SYSTEM_PROMPT}

USER FEEDBACK: "${feedbackText}"

Parse the user's feedback and return ONLY a JSON array of constraints. No markdown, no explanation.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Clean up markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    let constraints: Constraint[];
    try {
      constraints = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      console.error('Raw response:', text);
      // Return empty array if parsing fails
      return [];
    }

    // Validate constraints
    if (!Array.isArray(constraints)) {
      console.error('LLM response is not an array:', constraints);
      return [];
    }

    // Add IDs if missing
    constraints = constraints.map((c, i) => ({
      ...c,
      id: c.id || `c${i + 1}`,
      mode: c.mode || 'soft',
      weight: c.weight || 1.0
    }));

    // Validate constraint structure
    const validConstraints = constraints.filter(c => {
      if (!c.kind || !c.payload) {
        console.warn('Invalid constraint (missing kind or payload):', c);
        return false;
      }
      return true;
    });

    console.log(`✓ Parsed ${validConstraints.length} constraints from user feedback`);
    return validConstraints;

  } catch (error: any) {
    console.error('Error parsing constraints with LLM:', error);
    throw new Error(`Failed to parse constraints: ${error.message}`);
  }
}

/**
 * Validate a constraint object
 */
export function validateConstraint(constraint: Constraint): { valid: boolean; error?: string } {
  if (!constraint.kind) {
    return { valid: false, error: 'Missing constraint kind' };
  }

  if (!constraint.payload) {
    return { valid: false, error: 'Missing constraint payload' };
  }

  // Validate specific constraint types
  switch (constraint.kind) {
    case 'free_day':
    case 'disallowed_days':
      if (!constraint.payload.days || !Array.isArray(constraint.payload.days)) {
        return { valid: false, error: 'Missing or invalid "days" array in payload' };
      }
      break;

    case 'earliest_start':
    case 'latest_end':
      if (!constraint.payload.time || typeof constraint.payload.time !== 'string') {
        return { valid: false, error: 'Missing or invalid "time" in payload' };
      }
      break;

    case 'block_time_window':
      if (!constraint.payload.start || !constraint.payload.end) {
        return { valid: false, error: 'Missing "start" or "end" time in payload' };
      }
      break;

    case 'max_courses_per_semester':
      if (typeof constraint.payload.k !== 'number') {
        return { valid: false, error: 'Missing or invalid "k" in payload' };
      }
      break;

    case 'min_courses_per_semester':
      if (typeof constraint.payload.m !== 'number') {
        return { valid: false, error: 'Missing or invalid "m" in payload' };
      }
      break;

    case 'include_course':
    case 'exclude_course':
      if (!constraint.payload.course_ids || !Array.isArray(constraint.payload.course_ids)) {
        return { valid: false, error: 'Missing or invalid "course_ids" array in payload' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Sanitize constraints before sending to solver
 */
export function sanitizeConstraints(constraints: Constraint[]): Constraint[] {
  return constraints.map(c => ({
    ...c,
    mode: c.mode === 'hard' || c.mode === 'soft' ? c.mode : 'soft',
    weight: typeof c.weight === 'number' && c.weight > 0 ? c.weight : 1.0
  }));
}

