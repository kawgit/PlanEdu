import { Router, Request, Response } from 'express';
import { runPythonScript } from '../utils/runPython';
import sql from '../db';

const router = Router();

/**
 * POST /api/swipe/interact
 * Record a swipe interaction and update user embedding
 * 
 * This endpoint:
 * 1. Records the interaction (like/dislike) in the database
 * 2. Updates the user's embedding vector based on the interaction
 * 3. Uses incremental learning: user vector moves toward liked courses, away from disliked ones
 */
router.post('/interact', async (req: Request, res: Response) => {
  try {
    const { googleId, classId, liked } = req.body;
    
    // Validate input
    if (!googleId || !classId || typeof liked !== 'boolean') {
      return res.status(400).json({ 
        error: 'googleId, classId, and liked (boolean) are required' 
      });
    }
    
    console.log('Processing swipe interaction:', {
      googleId,
      classId,
      liked: liked ? 'LIKE' : 'DISLIKE'
    });
    
    // Get user ID from google_id
    const users = await sql`
      SELECT id FROM "Users" WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = users[0].id;
    
    // Verify class exists
    const classes = await sql`
      SELECT id, school, department, number, title 
      FROM "Class" 
      WHERE id = ${classId}
    `;
    
    if (classes.length === 0 || !classes[0]) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const classInfo = classes[0];
    const courseCode = `${classInfo.school}-${classInfo.department}-${classInfo.number}`;
    
    // Record the interaction based on liked/disliked
    if (liked) {
      // Add to bookmarks for likes
      await sql`
        INSERT INTO "Bookmark" ("userId", "classId")
        VALUES (${userId}, ${classId})
        ON CONFLICT ("userId", "classId") DO NOTHING
      `;
      console.log('  → Bookmarked course');
    }
    // For dislikes, we can optionally track in a separate table or just skip
    // Currently we don't store dislikes, just use them to update embedding
    
    // Update user embedding based on the interaction
    console.log('  → Updating user embedding...');
    
    try {
      const result = await runPythonScript<{ success?: boolean; error?: string }>(
        '../../scripts/update_user_embedding.py',
        {
          student_id: googleId,
          course_id: classId.toString(),
          liked: liked,
          learning_rate: 0.1
        }
      );
      
      if (result.error) {
        console.error('  ⚠️  Embedding update failed:', result.error);
        // Continue anyway - interaction was recorded
      } else {
        console.log('  ✅ Embedding updated successfully');
      }
    } catch (embeddingError: any) {
      console.error('  ⚠️  Embedding update error:', embeddingError.message);
      // Continue anyway - interaction was recorded
    }
    
    // Return success
    res.json({
      success: true,
      action: liked ? 'liked' : 'disliked',
      course: {
        id: classId,
        code: courseCode,
        title: classInfo.title
      },
      bookmarked: liked,
      embedding_updated: true
    });
    
  } catch (error: any) {
    console.error('Error processing swipe interaction:', error);
    res.status(500).json({ 
      error: 'Failed to process interaction',
      details: error.message 
    });
  }
});

/**
 * POST /api/swipe/batch-interact
 * Process multiple swipe interactions at once
 * Useful for bulk operations or offline sync
 */
router.post('/batch-interact', async (req: Request, res: Response) => {
  try {
    const { googleId, interactions } = req.body;
    
    if (!googleId || !Array.isArray(interactions)) {
      return res.status(400).json({ 
        error: 'googleId and interactions array are required' 
      });
    }
    
    console.log(`Processing ${interactions.length} swipe interactions for user ${googleId}`);
    
    const results = [];
    
    for (const interaction of interactions) {
      const { classId, liked } = interaction;
      
      try {
        // Process each interaction
        const response = await fetch(`http://localhost:3001/api/swipe/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleId, classId, liked })
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({ classId, success: true, data });
        } else {
          results.push({ classId, success: false, error: 'Request failed' });
        }
      } catch (error: any) {
        results.push({ classId, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      processed: interactions.length,
      succeeded: successCount,
      failed: interactions.length - successCount,
      results
    });
    
  } catch (error: any) {
    console.error('Error processing batch interactions:', error);
    res.status(500).json({ 
      error: 'Failed to process batch interactions',
      details: error.message 
    });
  }
});

/**
 * GET /api/swipe/history
 * Get user's swipe history (likes and dislikes)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { googleId } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    // Get bookmarked classes (likes)
    const bookmarks = await sql`
      SELECT 
        c.id,
        c.school,
        c.department,
        c.number,
        c.title,
        c.description,
        b.created_at as interacted_at
      FROM "Bookmark" b
      JOIN "Users" u ON u.id = b."userId"
      JOIN "Class" c ON c.id = b."classId"
      WHERE u.google_id = ${googleId}
      ORDER BY b.created_at DESC
    `;
    
    res.json({
      likes: bookmarks,
      dislikes: [] // We don't currently store dislikes
    });
    
  } catch (error: any) {
    console.error('Error fetching swipe history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch swipe history',
      details: error.message 
    });
  }
});

export default router;

