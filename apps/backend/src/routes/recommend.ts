import { Router, Request, Response } from 'express';
import { runPythonScript } from '../utils/runPython';

const router = Router();

/**
 * POST /api/user-embedding
 * Generate a user embedding based on their major, interests, and courses taken
 */
router.post('/user-embedding', async (req: Request, res: Response) => {
  try {
    const { major, interests, courses_taken } = req.body;
    
    // Validate input
    if (!major && !interests && !courses_taken) {
      return res.status(400).json({ 
        error: 'At least one of major, interests, or courses_taken is required' 
      });
    }
    
    // Prepare user data for the Python script
    const userData = {
      major: major || '',
      interests: Array.isArray(interests) ? interests : [],
      courses_taken: Array.isArray(courses_taken) ? courses_taken : []
    };
    
    console.log('Generating user embedding for:', userData);
    
    // Call the Python script to generate the embedding
    const result = await runPythonScript<{ embedding: number[] }>(
      '../../scripts/recommend.py',
      userData
    );
    
    console.log('Successfully generated embedding with dimension:', result.embedding.length);
    
    // Return the embedding
    res.json(result);
  } catch (error: any) {
    console.error('Error generating user embedding:', error);
    res.status(500).json({ 
      error: 'Failed to generate user embedding',
      details: error.message 
    });
  }
});

export default router;

