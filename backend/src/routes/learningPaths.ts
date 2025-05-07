import express from 'express';
import aiService from '../services/aiService';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route GET /api/learning-paths/popular
 * @desc Get popular learning paths
 * @access Public
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;

    const paths = await supabaseService.getPopularLearningPaths(limit);

    res.status(200).json({
      paths
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning path',
      error: error.message
    });
  }
});

/**
 * @route POST /api/learning-paths/generate
 * @desc Generate a learning path
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { goal, userLevel } = req.body;
    const userId = req.body.userId; // In a real app, get this from auth middleware

    if (!goal) {
      return res.status(400).json({ message: 'Learning goal is required' });
    }

    console.log('Generating learning path for goal:', goal);
    console.log('User level:', userLevel || 'beginner');
    console.log('User ID:', userId);

    // Generate learning path using AI
    const pathData = await aiService.generateLearningPath(goal, userLevel || 'beginner');

    console.log('AI generated path data successfully');

    // Save to database using service client to bypass RLS
    const savedPath = await supabaseService.createLearningPath(userId, pathData);

    res.status(201).json({
      message: 'Learning path generated successfully',
      path: savedPath
    });
  } catch (error: any) {
    console.error('Error in generate learning path route:', error);

    res.status(500).json({
      message: 'Failed to generate learning path',
      error: error.message
    });
  }
});

/**
 * @route GET /api/learning-paths/user/:userId
 * @desc Get all learning paths for a user
 * @access Private
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const paths = await supabaseService.getUserLearningPaths(userId);

    res.status(200).json({
      paths
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning paths',
      error: error.message
    });
  }
});

/**
 * @route GET /api/learning-paths/:id
 * @desc Get a learning path by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const pathId = req.params.id;

    const path = await supabaseService.getLearningPath(pathId);

    if (!path) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    res.status(200).json({
      path
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning path',
      error: error.message
    });
  }
});

export = router;
