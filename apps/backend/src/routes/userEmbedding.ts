import { Router, Request, Response } from 'express';
import { runPythonScript } from '../utils/runPython';
import sql from '../db';

const router = Router();

/**
 * Interface for user embedding response from Python script
 */
interface UserEmbeddingResult {
  embedding: number[];
  profile_text: string;
  dimension: number;
  model: string;
}

/**
 * POST /api/user/compute-embedding
 * Compute and store a user's embedding vector based on their academic profile
 * 
 * Request body: { googleId: string }
 * Fetches user data from database, computes embedding, and stores it
 */
router.post('/compute-embedding', async (req: Request, res: Response) => {
  try {
    const { googleId } = req.body;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    // Fetch user data from database
    const users = await sql`
      SELECT 
        u.id,
        u.google_id,
        u.major,
        u.interests
      FROM "Users" u
      WHERE u.google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Fetch user's completed courses
    const completedCourses = await sql`
      SELECT 
        c.school,
        c.department,
        c.number,
        c.title
      FROM "UserCompletedClass" ucc
      JOIN "Class" c ON c.id = ucc."classId"
      WHERE ucc."userId" = ${user.id}
      ORDER BY c.school, c.department, c.number
    `;
    
    // Build courses_taken array with course codes
    const coursesTaken = completedCourses.map((course: any) => 
      `${course.school}${course.department}${course.number}`
    );
    
    // Parse interests (stored as comma-separated string in DB)
    const interests = user.interests 
      ? user.interests.split(',').map((i: string) => i.trim()).filter(Boolean)
      : [];
    
    // Prepare data for Python script
    const userData = {
      major: user.major || '',
      interests: interests,
      courses_taken: coursesTaken
    };
    
    console.log('Computing embedding for user:', {
      googleId,
      major: userData.major,
      interestCount: userData.interests.length,
      courseCount: userData.courses_taken.length
    });
    
    // Check if user has any data to generate embedding
    if (!userData.major && userData.interests.length === 0 && userData.courses_taken.length === 0) {
      return res.status(400).json({ 
        error: 'User has no profile data (major, interests, or completed courses) to generate embedding' 
      });
    }
    
    // Call Python script to compute embedding
    const result = await runPythonScript<UserEmbeddingResult>(
      '../../scripts/user_embedding.py',
      userData
    );
    
    console.log('Embedding computed successfully:', {
      dimension: result.dimension,
      model: result.model,
      profileText: result.profile_text.substring(0, 100) + '...'
    });
    
    // Store embedding in database
    // Convert embedding array to PostgreSQL vector format
    const embeddingVector = `[${result.embedding.join(',')}]`;
    
    await sql`
      UPDATE "Users"
      SET 
        embedding = ${embeddingVector}::vector,
        embedding_updated_at = NOW()
      WHERE google_id = ${googleId}
    `;
    
    console.log('Embedding stored in database for user:', googleId);
    
    // Return success response
    res.json({
      success: true,
      dimension: result.dimension,
      model: result.model,
      profile_text: result.profile_text,
      updated_at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error computing user embedding:', error);
    res.status(500).json({ 
      error: 'Failed to compute user embedding',
      details: error.message 
    });
  }
});

/**
 * GET /api/user/embedding
 * Retrieve a user's stored embedding vector
 * 
 * Query params: { googleId: string }
 */
router.get('/embedding', async (req: Request, res: Response) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    // Fetch user embedding from database
    const users = await sql`
      SELECT 
        u.id,
        u.google_id,
        u.major,
        u.interests,
        u.embedding,
        u.embedding_updated_at
      FROM "Users" u
      WHERE u.google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    if (!user.embedding) {
      return res.status(404).json({ 
        error: 'User has no embedding computed yet',
        hint: 'Call POST /api/user/compute-embedding to generate one'
      });
    }
    
    // Return embedding data
    res.json({
      embedding: user.embedding,
      dimension: user.embedding.length,
      updated_at: user.embedding_updated_at,
      user: {
        googleId: user.google_id,
        major: user.major,
        interests: user.interests
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching user embedding:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user embedding',
      details: error.message 
    });
  }
});

/**
 * GET /api/user/similar-users
 * Find users with similar academic profiles based on embedding similarity
 * 
 * Query params: { googleId: string, limit?: number }
 */
router.get('/similar-users', async (req: Request, res: Response) => {
  try {
    const { googleId, limit = '10' } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    const limitNum = parseInt(limit as string);
    
    // Get the current user's embedding
    const currentUser = await sql`
      SELECT embedding, major
      FROM "Users"
      WHERE google_id = ${googleId}
    `;
    
    if (currentUser.length === 0 || !currentUser[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!currentUser[0].embedding) {
      return res.status(400).json({ 
        error: 'User has no embedding computed yet',
        hint: 'Call POST /api/user/compute-embedding first'
      });
    }
    
    // Find similar users using cosine similarity
    // Lower distance = more similar
    const similarUsers = await sql`
      SELECT 
        u.google_id,
        u.major,
        u.interests,
        u.embedding <=> ${currentUser[0].embedding}::vector as similarity_distance,
        1 - (u.embedding <=> ${currentUser[0].embedding}::vector) as similarity_score
      FROM "Users" u
      WHERE u.google_id != ${googleId}
        AND u.embedding IS NOT NULL
      ORDER BY u.embedding <=> ${currentUser[0].embedding}::vector
      LIMIT ${limitNum}
    `;
    
    res.json({
      user_major: currentUser[0].major,
      similar_users: similarUsers.map((u: any) => ({
        googleId: u.google_id,
        major: u.major,
        interests: u.interests,
        similarity_score: parseFloat(u.similarity_score.toFixed(4))
      }))
    });
    
  } catch (error: any) {
    console.error('Error finding similar users:', error);
    res.status(500).json({ 
      error: 'Failed to find similar users',
      details: error.message 
    });
  }
});

export default router;

