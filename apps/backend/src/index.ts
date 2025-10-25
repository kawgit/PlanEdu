import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import sql from './db';

const app = express();
const port = 3001;

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

// Update user preferences (major, minor, target_graduation)
app.put('/api/user/preferences', async (req, res) => {
  try {
    const { googleId, major, minor, target_graduation } = req.body;

    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    // Update user preferences
    await sql`
      UPDATE "Users" 
      SET 
        major = ${major || null},
        minor = ${minor || null},
        target_graduation = ${target_graduation || null}
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