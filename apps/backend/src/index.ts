import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sql from './db';

const app = express();
const port = 3001;

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
          AND ("title" ILIKE ${searchTerm} OR "description" ILIKE ${searchTerm})
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
          AND ("title" ILIKE ${searchTerm} OR "description" ILIKE ${searchTerm})
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
        WHERE "title" ILIKE ${searchTerm} OR "description" ILIKE ${searchTerm}
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

// Gemini AI chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { question, classes } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Build context from filtered classes
    let context = '';
    if (classes && classes.length > 0) {
      context = `You are a helpful BU course advisor. Answer questions about the following BU classes:\n\n`;
      
      classes.forEach((cls: any) => {
        const code = `${cls.school}-${cls.department}-${cls.number}`;
        context += `${code}: ${cls.title}\n`;
        context += `Description: ${cls.description}\n\n`;
      });
      
      context += `\nStudent question: ${question}\n\n`;
      context += `Please provide a helpful, concise answer about these courses. If recommending courses, explain why they might be a good fit.`;
    } else {
      context = `You are a helpful BU course advisor. Answer the following question:\n\n${question}`;
    }

    // Call Gemini API
    const result = await geminiModel.generateContent(context);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
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
  score = 50;
  
  // Major match (moderate weight to avoid over-concentration)
  if (user.major && course.department) {
    const majorKeywords = user.major.toLowerCase().split(' ');
    const deptLower = course.department.toLowerCase();
    
    if (majorKeywords.some((keyword: string) => deptLower.includes(keyword))) {
      score += 25; // Reduced from 50 to allow more variety
    }
  }
  
  // Minor match
  if (user.minor && course.department) {
    const minorKeywords = user.minor.toLowerCase().split(' ');
    const deptLower = course.department.toLowerCase();
    
    if (minorKeywords.some((keyword: string) => deptLower.includes(keyword))) {
      score += 20; // Reduced from 30
    }
  }
  
  // Interest match (check title and description)
  if (user.interests) {
    const interestKeywords = user.interests.toLowerCase().split(/[\s,]+/);
    const titleLower = (course.title || '').toLowerCase();
    const descLower = (course.description || '').toLowerCase();
    
    interestKeywords.forEach((keyword: string) => {
      if (keyword.length > 2) { // Ignore very short keywords
        if (titleLower.includes(keyword)) score += 15; // Increased from 10
        if (descLower.includes(keyword)) score += 8; // Increased from 5
      }
    });
  }
  
  // Course level matching (introductory courses for new students)
  if (user.incoming_credits !== null && user.incoming_credits !== undefined) {
    const courseNumber = course.number;
    if (user.incoming_credits < 30 && courseNumber < 200) {
      score += 20; // Boost intro courses for newer students
    } else if (user.incoming_credits >= 60 && courseNumber >= 300) {
      score += 15; // Boost advanced courses for upperclassmen
    } else if (courseNumber >= 100 && courseNumber < 300) {
      score += 10; // Moderate boost for mid-level courses
    }
  }
  
  // Penalize very advanced courses for students without many credits
  if (user.incoming_credits !== null && user.incoming_credits < 30 && course.number >= 400) {
    score -= 20;
  }
  
  // Add significant randomness for variety (±20 points)
  score += Math.random() * 40 - 20;
  
  return score;
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
    
    // Get classes user has already interacted with
    const interactedClasses = await sql`
      SELECT DISTINCT c.id
      FROM "UserCourseInteraction" uci
      JOIN "Users" u ON u.id = uci.user_id
      JOIN "Class" c ON c.id = uci.class_id
      WHERE u.google_id = ${googleId}
    `;
    
    const excludeIds = new Set(interactedClasses.map((c: any) => c.id));
    
    // Fetch ALL courses and randomize them for diversity
    const requestedLimit = parseInt(limit as string);
    
    const allClasses = await sql`
      SELECT * FROM "Class"
      ORDER BY RANDOM()
    `;
    
    console.log(`Fetched ${allClasses.length} random courses, ${excludeIds.size} already interacted with`);
    
    // Filter out already interacted classes
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
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Save user interaction (like/pass)
app.post('/api/user/interaction', async (req, res) => {
  try {
    const { googleId, classId, interactionType } = req.body;
    
    if (!googleId || !classId || !interactionType) {
      return res.status(400).json({ 
        error: 'googleId, classId, and interactionType are required' 
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
    
    // Insert interaction (will ignore on conflict)
    await sql`
      INSERT INTO "UserCourseInteraction" (user_id, class_id, interaction_type)
      VALUES (${userId}, ${classId}, ${interactionType})
      ON CONFLICT (user_id, class_id, interaction_type) DO NOTHING
    `;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving interaction:', error);
    res.status(500).json({ error: 'Failed to save interaction' });
  }
});

// Get user's interaction history
app.get('/api/user/interactions', async (req, res) => {
  try {
    const { googleId, interactionType } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }
    
    let interactions;
    
    if (interactionType) {
      interactions = await sql`
        SELECT c.*, uci.interaction_type, uci.created_at
        FROM "UserCourseInteraction" uci
        JOIN "Users" u ON u.id = uci.user_id
        JOIN "Class" c ON c.id = uci.class_id
        WHERE u.google_id = ${googleId} 
          AND uci.interaction_type = ${interactionType}
        ORDER BY uci.created_at DESC
      `;
    } else {
      interactions = await sql`
        SELECT c.*, uci.interaction_type, uci.created_at
        FROM "UserCourseInteraction" uci
        JOIN "Users" u ON u.id = uci.user_id
        JOIN "Class" c ON c.id = uci.class_id
        WHERE u.google_id = ${googleId}
        ORDER BY uci.created_at DESC
      `;
    }
    
    res.json(interactions);
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
      SELECT c.*, b.created_at as bookmarked_at
      FROM "Bookmark" b
      JOIN "Users" u ON u.id = b.user_id
      JOIN "Class" c ON c.id = b.class_id
      WHERE u.google_id = ${googleId}
      ORDER BY b.created_at DESC
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
    
    // Insert bookmark (will ignore on conflict)
    await sql`
      INSERT INTO "Bookmark" (user_id, class_id)
      VALUES (${userId}, ${classId})
      ON CONFLICT (user_id, class_id) DO NOTHING
    `;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ error: 'Failed to add bookmark' });
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
      WHERE user_id = ${userId} AND class_id = ${classId}
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

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});