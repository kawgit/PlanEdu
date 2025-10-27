import { Router, Request, Response } from 'express';
import { runPythonScript } from '../utils/runPython';
import sql from '../db';

const router = Router();

/**
 * Interface for recommendation response from Python script
 */
interface CourseRecommendation {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description: string;
  code: string;
  similarity: number;
  hub_score: number;
  final_score: number;
  fulfills_hubs: number[];
}

interface RecommendationResult {
  success: boolean;
  userId: number;
  count: number;
  recommendations: CourseRecommendation[];
}

/**
 * GET /api/recommendations/personalized
 * Get personalized course recommendations using hybrid scoring:
 * - 70% embedding similarity
 * - 30% hub requirement coverage
 * 
 * Query params:
 * - googleId: User's Google ID (required)
 * - limit: Number of recommendations (optional, default: 20)
 */
router.get('/personalized', async (req: Request, res: Response) => {
  try {
    const { googleId, limit = '20' } = req.query;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    console.log('Fetching personalized recommendations for:', googleId);
    
    // Get user ID from Google ID
    const users = await sql`
      SELECT id, major, embedding 
      FROM "Users" 
      WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0 || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Check if user has embedding
    if (!user.embedding) {
      return res.status(400).json({ 
        error: 'User has no embedding computed yet',
        hint: 'Please compute user embedding first: POST /api/user/compute-embedding'
      });
    }
    
    // Call Python recommendation script
    console.log('  → Calling Python recommendation engine...');
    
    const result = await runPythonScript<RecommendationResult>(
      '../../scripts/recommend_courses.py',
      { userId: user.id }
    );
    
    if (!result.success) {
      throw new Error('Recommendation script did not return success');
    }
    
    console.log(`  ✓ Generated ${result.count} recommendations`);
    
    // Limit recommendations if requested
    const requestedLimit = parseInt(limit as string);
    const recommendations = result.recommendations.slice(0, requestedLimit);
    
    // Return recommendations with metadata
    res.json({
      success: true,
      user: {
        id: user.id,
        googleId: googleId,
        major: user.major
      },
      count: recommendations.length,
      recommendations: recommendations,
      algorithm: {
        similarity_weight: 0.7,
        hub_coverage_weight: 0.3,
        description: 'Hybrid scoring: 70% embedding similarity + 30% hub coverage'
      }
    });
    
  } catch (error: any) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
});

/**
 * GET /api/recommendations/similar-to-course
 * Find courses similar to a given course (useful for "More like this")
 * 
 * Query params:
 * - courseId: Course ID (required)
 * - limit: Number of similar courses (optional, default: 10)
 */
router.get('/similar-to-course', async (req: Request, res: Response) => {
  try {
    const { courseId, limit = '10' } = req.query;
    
    if (!courseId) {
      return res.status(400).json({ 
        error: 'courseId is required' 
      });
    }
    
    const limitNum = parseInt(limit as string);
    
    // Get the target course and its embedding
    const targetCourse = await sql`
      SELECT id, school, department, number, title, embedding
      FROM "Class"
      WHERE id = ${courseId}
    `;
    
    if (targetCourse.length === 0 || !targetCourse[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const course = targetCourse[0];
    
    if (!course.embedding) {
      return res.status(400).json({ 
        error: 'Course has no embedding',
        hint: 'Only courses with embeddings can be used for similarity search'
      });
    }
    
    // Find similar courses using cosine similarity
    const similarCourses = await sql`
      SELECT 
        c.id,
        c.school,
        c.department,
        c.number,
        c.title,
        c.description,
        c.embedding <=> ${course.embedding}::vector as distance,
        1 - (c.embedding <=> ${course.embedding}::vector) as similarity
      FROM "Class" c
      WHERE c.id != ${courseId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${course.embedding}::vector
      LIMIT ${limitNum}
    `;
    
    res.json({
      target_course: {
        id: course.id,
        code: `${course.school}-${course.department}-${course.number}`,
        title: course.title
      },
      similar_courses: similarCourses.map((c: any) => ({
        id: c.id,
        code: `${c.school}-${c.department}-${c.number}`,
        title: c.title,
        description: c.description,
        similarity_score: parseFloat(c.similarity.toFixed(4))
      }))
    });
    
  } catch (error: any) {
    console.error('Error finding similar courses:', error);
    res.status(500).json({ 
      error: 'Failed to find similar courses',
      details: error.message 
    });
  }
});

/**
 * POST /api/recommendations/refresh
 * Recompute user embedding and get fresh recommendations
 * Useful after user updates profile or completes courses
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { googleId } = req.body;
    
    if (!googleId) {
      return res.status(400).json({ 
        error: 'googleId is required' 
      });
    }
    
    console.log('Refreshing recommendations for:', googleId);
    
    // Step 1: Recompute user embedding
    console.log('  → Recomputing user embedding...');
    const embeddingResponse = await fetch('http://localhost:3001/api/user/compute-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleId })
    });
    
    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.json();
      throw new Error(`Failed to compute embedding: ${error.error}`);
    }
    
    console.log('  ✓ Embedding updated');
    
    // Step 2: Get fresh recommendations
    console.log('  → Generating fresh recommendations...');
    const recsResponse = await fetch(`http://localhost:3001/api/recommendations/personalized?googleId=${googleId}`);
    
    if (!recsResponse.ok) {
      const error = await recsResponse.json();
      throw new Error(`Failed to get recommendations: ${error.error}`);
    }
    
    const recommendations = await recsResponse.json();
    
    console.log('  ✓ Fresh recommendations generated');
    
    res.json({
      success: true,
      message: 'Embedding recomputed and recommendations refreshed',
      ...recommendations
    });
    
  } catch (error: any) {
    console.error('Error refreshing recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to refresh recommendations',
      details: error.message 
    });
  }
});

export default router;

