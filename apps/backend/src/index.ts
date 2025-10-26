import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import sql from './db';
import { calculateCSMajorCompletion } from './majorCompletion';

const app = express();
const port = 3001;

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true,
}));
app.use(express.json());

// Existing API endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});


app.get('/api/user', async (req, res) => {
  try {
    const { googleId } = req.query;

    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    const users = await sql`
      SELECT * FROM "Users" WHERE google_id = ${googleId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Update user preferences (major, minor, target_graduation, incoming_credits, interests, study_abroad_interest, preferred_course_load)
app.put('/api/user/preferences', async (req, res) => {
  try {
    const { 
      googleId, 
      major, 
      minor, 
      target_graduation,
      incoming_credits,
      interests,
      study_abroad_interest,
      preferred_course_load
    } = req.body;

    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    // Update user preferences
    await sql`
      UPDATE "Users" 
      SET 
        major = ${major || null},
        minor = ${minor || null},
        target_graduation = ${target_graduation || null},
        incoming_credits = ${incoming_credits || null},
        interests = ${interests || null},
        study_abroad_interest = ${study_abroad_interest || null},
        preferred_course_load = ${preferred_course_load || null}
      WHERE google_id = ${googleId}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get classes with optional filters
app.get('/api/classes', async (req, res) => {
  try {
    const { school, department, keyword, limit = '1000' } = req.query;
    
    let classes;
    
    if (school && department && keyword) {
      const searchTerm = `%${keyword}%`;
      classes = await sql`
        SELECT * FROM "Class" 
        WHERE "school" = ${school} 
          AND "department" = ${department}
          AND (
            "title" ILIKE ${searchTerm} 
            OR "description" ILIKE ${searchTerm}
            OR CAST("number" AS TEXT) ILIKE ${searchTerm}
          )
        LIMIT ${parseInt(limit as string)}
      `;
    } else if (school && department) {
      classes = await sql`
        SELECT * FROM "Class" 
        WHERE "school" = ${school} AND "department" = ${department}
        LIMIT ${parseInt(limit as string)}
      `;
    } else if (school && keyword) {
      const searchTerm = `%${keyword}%`;
      classes = await sql`
        SELECT * FROM "Class" 
        WHERE "school" = ${school}
          AND (
            "title" ILIKE ${searchTerm} 
            OR "description" ILIKE ${searchTerm}
            OR "department" ILIKE ${searchTerm}
            OR CAST("number" AS TEXT) ILIKE ${searchTerm}
          )
        LIMIT ${parseInt(limit as string)}
      `;
    } else if (school) {
      classes = await sql`
        SELECT * FROM "Class" 
        WHERE "school" = ${school}
        LIMIT ${parseInt(limit as string)}
      `;
    } else if (keyword) {
      const searchTerm = `%${keyword}%`;
      classes = await sql`
        SELECT * FROM "Class" 
        WHERE "title" ILIKE ${searchTerm} 
          OR "description" ILIKE ${searchTerm}
          OR "school" ILIKE ${searchTerm}
          OR "department" ILIKE ${searchTerm}
          OR CAST("number" AS TEXT) ILIKE ${searchTerm}
          OR CONCAT("school", "department", ' ', "number") ILIKE ${searchTerm}
        LIMIT ${parseInt(limit as string)}
      `;
    } else {
      classes = await sql`
        SELECT * FROM "Class" 
        LIMIT ${parseInt(limit as string)}
      `;
    }
    
    res.json(classes);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get unique schools
app.get('/api/schools', async (req, res) => {
  try {
    const schools = await sql`
      SELECT DISTINCT "school" FROM "Class" 
      WHERE "school" IS NOT NULL
      ORDER BY "school"
    `;
    res.json(schools.map(s => s.school));
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// Get departments (optionally filtered by school)
app.get('/api/departments', async (req, res) => {
  try {
    const { school } = req.query;
    
    let departments;
    if (school) {
      departments = await sql`
        SELECT DISTINCT "department" FROM "Class" 
        WHERE "school" = ${school} AND "department" IS NOT NULL
        ORDER BY "department"
      `;
    } else {
      departments = await sql`
        SELECT DISTINCT "department" FROM "Class" 
        WHERE "department" IS NOT NULL
        ORDER BY "department"
      `;
    }
    
    res.json(departments.map(d => d.department));
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Gemini AI chat endpoint (streaming)
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { question, classes, userProfile, completedCourses, bookmarks } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Build context from user profile and completed courses
    let context = `You are a helpful BU (Boston University) course advisor. You have access to the student's profile information, completed courses, and bookmarked classes to provide personalized advice.\n\n`;
    
    // Add user profile information if available
    if (userProfile) {
      context += `STUDENT PROFILE:\n`;
      if (userProfile.major) {
        context += `- Major: ${userProfile.major}\n`;
      }
      if (userProfile.minor) {
        context += `- Minor: ${userProfile.minor}\n`;
      }
      if (userProfile.target_graduation) {
        context += `- Expected Graduation: ${new Date(userProfile.target_graduation).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n`;
      }
      if (userProfile.incoming_credits !== null && userProfile.incoming_credits !== undefined) {
        context += `- Incoming Credits: ${userProfile.incoming_credits}\n`;
      }
      if (userProfile.interests) {
        context += `- Interests: ${userProfile.interests}\n`;
      }
      if (userProfile.study_abroad_interest) {
        context += `- Study Abroad Interest: ${userProfile.study_abroad_interest}\n`;
      }
      if (userProfile.preferred_course_load) {
        context += `- Preferred Course Load: ${userProfile.preferred_course_load}\n`;
      }
      context += `\n`;
    }
    
    // Add completed courses if available
    if (completedCourses && completedCourses.length > 0) {
      context += `COMPLETED COURSES (${completedCourses.length} courses):\n`;
      completedCourses.forEach((course: any) => {
        const code = `${course.school}${course.department} ${course.number}`;
        const grade = course.grade ? ` (Grade: ${course.grade})` : '';
        context += `- ${code}: ${course.title}${grade}\n`;
      });
      context += `\n`;
    }
    
    // Add bookmarked classes if available
    if (bookmarks && bookmarks.length > 0) {
      context += `BOOKMARKED CLASSES (${bookmarks.length} classes the student is interested in):\n`;
      bookmarks.forEach((course: any) => {
        const code = `${course.school}-${course.department}-${course.number}`;
        context += `- ${code}: ${course.title}\n`;
        if (course.description) {
          context += `  Description: ${course.description}\n`;
        }
      });
      context += `\n`;
    }
    
    // Build context from filtered classes
    if (classes && classes.length > 0) {
      context += `AVAILABLE CLASSES IN CURRENT FILTER (${classes.length} classes):\n`;
      
      classes.forEach((cls: any) => {
        const code = `${cls.school}-${cls.department}-${cls.number}`;
        context += `${code}: ${cls.title}\n`;
        context += `Description: ${cls.description}\n\n`;
      });
    }
    
    context += `\nSTUDENT QUESTION: ${question}\n\n`;
    context += `INSTRUCTIONS:\n`;
    context += `- Provide a helpful, personalized answer based on the student's profile, completed courses, and bookmarked classes\n`;
    context += `- If the student has bookmarked classes, you can reference them in your answers when relevant\n`;
    context += `- If recommending courses, explain why they're a good fit for this specific student\n`;
    context += `- Consider prerequisites and whether the student has taken required courses\n`;
    context += `- If the student has already completed a course they're asking about, mention that\n`;
    context += `- Use the student's major, minor, interests, and bookmarked classes to tailor your recommendations\n`;
    context += `- Be encouraging and supportive in your responses\n`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call Gemini API with streaming
    const result = await geminiModel.generateContentStream(context);

    // Stream the response
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Gemini API error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response',
      details: error.message 
    });
  }
});

// Helper function to calculate relevance score
function calculateRelevanceScore(course: any, user: any): number {
  let score = 0;
  
  // Base score for all courses (ensures variety)
  score = 40;
  
  // Major match - highest weight for core curriculum
  if (user.major && course.department) {
    const majorKeywords = user.major.toLowerCase().split(' ');
    const deptLower = course.department.toLowerCase();
    const schoolLower = (course.school || '').toLowerCase();
    
    // Check if department matches any major keyword
    if (majorKeywords.some((keyword: string) => 
      deptLower.includes(keyword) || schoolLower.includes(keyword)
    )) {
      score += 35; // Strong boost for major-related courses
      
      // Additional boost for courses at appropriate level
      if (user.incoming_credits !== null && user.incoming_credits !== undefined) {
        if (user.incoming_credits < 30 && course.number < 300) {
          score += 10; // Intro/intermediate courses for new students
        } else if (user.incoming_credits >= 30 && course.number >= 200) {
          score += 10; // More advanced courses for experienced students
        }
      }
    }
  }
  
  // Minor match - moderate weight
  if (user.minor && course.department) {
    const minorKeywords = user.minor.toLowerCase().split(' ');
    const deptLower = course.department.toLowerCase();
    const schoolLower = (course.school || '').toLowerCase();
    
    if (minorKeywords.some((keyword: string) => 
      deptLower.includes(keyword) || schoolLower.includes(keyword)
    )) {
      score += 25; // Good boost for minor-related courses
    }
  }
  
  // Interest match - check title and description for keywords
  if (user.interests) {
    const interestKeywords = user.interests.toLowerCase().split(/[\s,]+/);
    const titleLower = (course.title || '').toLowerCase();
    const descLower = (course.description || '').toLowerCase();
    
    // Map interest categories to relevant keywords
    const interestMapping: { [key: string]: string[] } = {
      'creative': ['art', 'music', 'design', 'creative', 'studio', 'performance', 'theater', 'film'],
      'social': ['society', 'culture', 'sociology', 'anthropology', 'history', 'politics', 'psychology'],
      'natural': ['biology', 'chemistry', 'physics', 'earth', 'environment', 'science'],
      'technology': ['computer', 'programming', 'data', 'digital', 'software', 'engineering', 'tech'],
      'global': ['international', 'global', 'world', 'culture', 'language', 'geography'],
      'health': ['health', 'medical', 'wellness', 'nutrition', 'biology', 'physiology'],
    };
    
    interestKeywords.forEach((keyword: string) => {
      if (keyword.length > 3) {
        // Direct keyword match
        if (titleLower.includes(keyword)) score += 18;
        if (descLower.includes(keyword)) score += 10;
        
        // Check mapped keywords for this interest
        for (const [category, relatedTerms] of Object.entries(interestMapping)) {
          if (keyword.includes(category)) {
            relatedTerms.forEach(term => {
              if (titleLower.includes(term)) score += 12;
              if (descLower.includes(term)) score += 6;
            });
          }
        }
      }
    });
  }
  
  // Course level matching based on incoming credits
  if (user.incoming_credits !== null && user.incoming_credits !== undefined) {
    const courseNumber = course.number;
    
    if (user.incoming_credits < 30) {
      // New students: prefer 100-200 level courses
      if (courseNumber >= 100 && courseNumber < 200) score += 20;
      else if (courseNumber >= 200 && courseNumber < 300) score += 10;
      else if (courseNumber >= 500) score -= 25; // Strongly discourage grad courses
    } else if (user.incoming_credits >= 30 && user.incoming_credits < 60) {
      // Sophomores: prefer 200-300 level
      if (courseNumber >= 200 && courseNumber < 400) score += 15;
      else if (courseNumber >= 100 && courseNumber < 200) score += 5;
    } else if (user.incoming_credits >= 60) {
      // Juniors/Seniors: prefer 300-400 level
      if (courseNumber >= 300) score += 20;
      else if (courseNumber >= 200 && courseNumber < 300) score += 10;
      else if (courseNumber < 200) score -= 10; // Discourage intro courses
    }
  }
  
  // Hub requirements - boost courses that fulfill hub requirements
  if (course.hub_areas && Array.isArray(course.hub_areas) && course.hub_areas.length > 0) {
    score += 8; // Bonus for hub courses (helps with gen ed requirements)
  }
  
  // Variety factor: Add controlled randomness (±15 points)
  // This ensures users see diverse recommendations while still prioritizing relevance
  score += Math.random() * 30 - 15;
  
  // Ensure score is non-negative
  return Math.max(0, score);
}

// Get personalized course recommendations
app.get('/api/recommendations', async (req, res) => {
  try {
    const { googleId, limit = '20' } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    // Get user and their preferences
    const users = await sql`
      SELECT * FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Log user preferences for debugging
    console.log('User preferences:', {
      major: user.major,
      minor: user.minor,
      interests: user.interests,
      incoming_credits: user.incoming_credits
    });
    
    // Get classes user has already bookmarked (exclude them from recommendations)
    const bookmarkedClasses = await sql`
      SELECT DISTINCT c.id
      FROM "Bookmark" b
      JOIN "Users" u ON u.id = b."userId"
      JOIN "Class" c ON c.id = b."classId"
      WHERE u.google_id = ${googleId}
    `;
    
    const excludeIds = new Set(bookmarkedClasses.map((c: any) => c.id));
    
    // Fetch ALL courses with hub areas and randomize them for diversity
    const requestedLimit = parseInt(limit as string);
    
    const allClasses = await sql`
      WITH ClassesWithHubs AS (
        SELECT 
          c.id,
          c.school,
          c.department,
          c.number,
          c.title,
          c.description,
          ARRAY_AGG(DISTINCT hr.name) FILTER (WHERE hr.name IS NOT NULL) as hub_areas,
          4 as typical_credits
        FROM "Class" c
        LEFT JOIN "ClassToHubRequirement" cthr ON c.id = cthr."classId"
        LEFT JOIN "HubRequirement" hr ON cthr."hubRequirementId" = hr.id
        GROUP BY c.id, c.school, c.department, c.number, c.title, c.description
      )
      SELECT * FROM ClassesWithHubs
      ORDER BY RANDOM()
    `;
    
    console.log(`Fetched ${allClasses.length} random courses, ${excludeIds.size} already bookmarked`);
    
    // Filter out already bookmarked classes
    const availableClasses = allClasses.filter((cls: any) => !excludeIds.has(cls.id));
    
    // Score and rank courses based on user preferences
    const scoredClasses = availableClasses.map((cls: any) => ({
      ...cls,
      score: calculateRelevanceScore(cls, user)
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, requestedLimit);
    
    console.log(`Returning ${scoredClasses.length} recommendations`);
    if (scoredClasses.length > 0) {
      console.log('Top 3 courses:', scoredClasses.slice(0, 3).map((c: any) => ({
        code: `${c.school}-${c.department}-${c.number}`,
        title: c.title,
        score: c.score
      })));
    }
    
    res.json(scoredClasses);
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch recommendations',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Save user interaction (bookmark or discard)
app.post('/api/user/interaction', async (req, res) => {
  try {
    const { googleId, classId, interactionType } = req.body;
    
    if (!googleId || !classId || !interactionType) {
      return res.status(400).json({ 
        error: 'googleId, classId, and interactionType are required' 
      });
    }
    
    // Only handle bookmarks - discards are just ignored (user moves to next card)
    if (interactionType === 'bookmark') {
      // Get user ID from google_id
      const users = await sql`
        SELECT id FROM "Users" WHERE google_id = ${googleId}
      `;
      
      if (users.length === 0 || !users[0]) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userId = users[0].id;
      
      // Insert bookmark (will ignore on conflict)
      await sql`
        INSERT INTO "Bookmark" ("userId", "classId")
        VALUES (${userId}, ${classId})
        ON CONFLICT ("userId", "classId") DO NOTHING
      `;
    }
    // For 'discard', we just do nothing - no need to track it
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving interaction:', error);
    res.status(500).json({ error: 'Failed to save interaction' });
  }
});

// Get user's interaction history (redirects to bookmarks endpoint)
// This endpoint is kept for backward compatibility
app.get('/api/user/interactions', async (req, res) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }
    
    // Only return bookmarks now (no more interaction tracking)
    const bookmarks = await sql`
      SELECT c.*, b.created_at as bookmarked_at
      FROM "Bookmark" b
      JOIN "Users" u ON u.id = b."userId"
      JOIN "Class" c ON c.id = b."classId"
      WHERE u.google_id = ${googleId}
      ORDER BY b.created_at DESC
    `;
    
    res.json(bookmarks);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

// Get user's bookmarked classes
app.get('/api/user/bookmarks', async (req, res) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }
    
    const bookmarks = await sql`
      SELECT c.*
      FROM "Bookmark" b
      JOIN "Users" u ON u.id = b."userId"
      JOIN "Class" c ON c.id = b."classId"
      WHERE u.google_id = ${googleId}
      ORDER BY b.id DESC
    `;
    
    res.json(bookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// Add a bookmark
app.post('/api/user/bookmark', async (req, res) => {
  try {
    const { googleId, classId } = req.body;
    
    if (!googleId || !classId) {
      return res.status(400).json({ error: 'googleId and classId are required' });
    }
    
    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = users[0].id;
    
    // Check if the class exists
    const classExists = await sql`
      SELECT id FROM "Class" WHERE id = ${classId}
    `;
    
    if (classExists.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Insert bookmark (check if already exists first)
    const existingBookmark = await sql`
      SELECT id FROM "Bookmark" 
      WHERE "userId" = ${userId} AND "classId" = ${classId}
    `;
    
    if (existingBookmark.length > 0) {
      return res.json({ success: true, message: 'Bookmark already exists' });
    }
    
    await sql`
      INSERT INTO "Bookmark" ("userId", "classId")
      VALUES (${userId}, ${classId})
    `;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ 
      error: 'Failed to add bookmark',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Remove a bookmark
app.delete('/api/user/bookmark', async (req, res) => {
  try {
    const { googleId, classId } = req.body;
    
    if (!googleId || !classId) {
      return res.status(400).json({ error: 'googleId and classId are required' });
    }
    
    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = users[0].id;
    
    // Delete bookmark
    await sql`
      DELETE FROM "Bookmark" 
      WHERE "userId" = ${userId} AND "classId" = ${classId}
    `;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// Google OAuth authentication endpoint
app.post('/auth/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract user information
    const userId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];

    console.log('User authenticated:', { userId, email, name });

    // Check if user exists in database, create if not
    const existingUsers = await sql`
      SELECT * FROM "Users" WHERE google_id = ${userId}
    `;

    if (existingUsers.length === 0) {
      // Create new user with just google_id
      // major, minor, target_graduation will be set later via preferences
      await sql`
        INSERT INTO "Users" (google_id)
        VALUES (${userId})
      `;
      console.log('New user created:', userId);
    } else {
      console.log('User already exists:', userId);
    }

    res.json({
      success: true,
      user: {
        id: userId,
        email,
        name,
        picture,
      },
    });
  } catch (error) {
    console.error('Error verifying Google token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Upload and parse transcript
app.post('/api/transcript/upload', upload.single('transcript'), async (req, res) => {
  try {
    const { googleId } = req.body;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = users[0].id;

    // Convert file buffer to base64 for Gemini
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    console.log(`Processing transcript upload: ${req.file.originalname} (${mimeType})`);

    // Use Gemini Vision to extract course information
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `You are an expert at parsing Boston University academic transcripts. Analyze this transcript and extract ALL completed courses with grades.

IMPORTANT RULES:
1. ONLY include courses that have a grade (A, A-, B+, B, B-, C+, C, etc.)
2. DO NOT include courses without grades (current/in-progress courses)
3. DO NOT include courses listed under "Fall 2025" or future terms with no grades
4. Include ALL courses from "Test Credit" section (these are AP credits)
5. Include ALL courses from completed semesters (those with grades)

For each course, identify:
1. School: The school code (e.g., "CAS", "ENG", "COM")
2. Department: The department code (e.g., "CS", "MA", "PY")
3. Number: The course number as a string (e.g., "111", "123", "504")
4. Grade: Letter grade (A, A-, B+, B, etc.) or P for Pass. Use null if no grade.

BU TRANSCRIPT STRUCTURE:
- Test Credits appear first (these are AP/Transfer credits)
- Then completed semesters with grades
- Current semester courses have NO grades - DO NOT INCLUDE THESE

Examples:
- "CASCS 111" → school: "CAS", department: "CS", number: "111"
- "ENGEK 125" → school: "ENG", department: "EK", number: "125"
- "COMCM 211" → school: "COM", department: "CM", number: "211"

Return ONLY valid JSON array:
[
  {
    "school": "CAS",
    "department": "CS",
    "number": "111",
    "grade": "A"
  },
  {
    "school": "CAS",
    "department": "CS",
    "number": "112",
    "grade": "B"
  }
]

ONLY return the JSON array, no markdown, no explanation, no additional text.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Clean up the response to extract JSON
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Gemini response:', text);

    let courses;
    try {
      courses = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse transcript. Please try again or add courses manually.',
        rawResponse: text
      });
    }

    if (!Array.isArray(courses)) {
      return res.status(500).json({ 
        error: 'Unexpected response format from AI',
        rawResponse: text
      });
    }

    // Insert courses into database
    const insertedCourses = [];
    const errors = [];

    for (const course of courses) {
      try {
        // First, look up the class in the Class table
        const classes = await sql`
          SELECT id FROM "Class" 
          WHERE school = ${course.school} 
            AND department = ${course.department} 
            AND number = ${course.number}
          LIMIT 1
        `;

        if (classes.length === 0 || !classes[0]) {
          console.log(`Course not found in database: ${course.school}${course.department} ${course.number}`);
          errors.push({ 
            course: `${course.school}${course.department} ${course.number}`, 
            error: 'Course not found in database' 
          });
          continue;
        }

        const classId = classes[0].id;

        // Insert into UserCompletedClass
        const result = await sql`
          INSERT INTO "UserCompletedClass" 
          ("userId", "classId", "grade")
          VALUES (
            ${userId},
            ${classId},
            ${course.grade || null}
          )
          ON CONFLICT ("userId", "classId") DO UPDATE
          SET grade = EXCLUDED.grade
          RETURNING *
        `;
        insertedCourses.push(result[0]);
      } catch (error: any) {
        console.error('Error inserting course:', course, error);
        errors.push({ 
          course: `${course.school || ''}${course.department || ''} ${course.number || ''}`, 
          error: error.message 
        });
      }
    }

    res.json({
      success: true,
      coursesExtracted: courses.length,
      coursesInserted: insertedCourses.length,
      courses: insertedCourses,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ 
      error: 'Failed to process transcript',
      details: error.message 
    });
  }
});

// Get user's completed courses
app.get('/api/user/completed-courses', async (req, res) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    // Get courses from UserCompletedClass table joined with Class table
    const completedCourses = await sql`
      SELECT 
        ucc.id,
        ucc."userId",
        ucc."classId",
        ucc.grade,
        c.school,
        c.department,
        c.number,
        c.title,
        c.description
      FROM "UserCompletedClass" ucc
      JOIN "Users" u ON u.id = ucc."userId"
      JOIN "Class" c ON c.id = ucc."classId"
      WHERE u.google_id = ${googleId}
      ORDER BY ucc.id DESC
    `;
    
    res.json(completedCourses);
  } catch (error) {
    console.error('Error fetching completed courses:', error);
    res.status(500).json({ error: 'Failed to fetch completed courses' });
  }
});

// Add a completed course manually
app.post('/api/user/completed-course', async (req, res) => {
  try {
    const { googleId, classId, grade } = req.body;
    
    if (!googleId || !classId) {
      return res.status(400).json({ 
        error: 'googleId and classId are required' 
      });
    }
    
    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = users[0].id;
    
    // Check if class exists
    const classes = await sql`
      SELECT id FROM "Class" WHERE id = ${classId}
    `;
    
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Insert into UserCompletedClass
    const result = await sql`
      INSERT INTO "UserCompletedClass" 
      ("userId", "classId", "grade")
      VALUES (
        ${userId},
        ${classId},
        ${grade || null}
      )
      ON CONFLICT ("userId", "classId") DO UPDATE
      SET grade = EXCLUDED.grade
      RETURNING *
    `;
    
    res.json({ success: true, course: result[0] });
  } catch (error) {
    console.error('Error adding completed course:', error);
    res.status(500).json({ error: 'Failed to add completed course' });
  }
});

// Delete a completed course
app.delete('/api/user/completed-course', async (req, res) => {
  try {
    const { googleId, completedCourseId } = req.body;
    
    if (!googleId || !completedCourseId) {
      return res.status(400).json({ error: 'googleId and completedCourseId are required' });
    }
    
    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = users[0].id;
    
    // Delete from UserCompletedClass
    await sql`
      DELETE FROM "UserCompletedClass" 
      WHERE id = ${completedCourseId} AND "userId" = ${userId}
    `;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting completed course:', error);
    res.status(500).json({ error: 'Failed to delete completed course' });
  }
});

// Calculate CS major completion percentage
app.get('/api/user/cs-major-completion', async (req, res) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    // Get user's completed courses
    const completedCoursesRaw = await sql`
      SELECT 
        c.school,
        c.department,
        c.number,
        c.title,
        c.description,
        ucc.grade
      FROM "UserCompletedClass" ucc
      JOIN "Users" u ON u.id = ucc."userId"
      JOIN "Class" c ON c.id = ucc."classId"
      WHERE u.google_id = ${googleId}
    `;
    
    // Map to CompletedCourse type
    const completedCourses = completedCoursesRaw.map(course => ({
      school: course.school as string,
      department: course.department as string,
      number: course.number as number,
      grade: course.grade as string | null,
      title: course.title as string,
      description: course.description as string
    }));
    
    // Calculate completion percentage
    const result = calculateCSMajorCompletion(completedCourses);
    
    res.json(result);
  } catch (error) {
    console.error('Error calculating CS major completion:', error);
    res.status(500).json({ 
      error: 'Failed to calculate CS major completion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});