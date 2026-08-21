import express from 'express';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route GET /api/popular-learning-paths
 * @desc Get popular learning paths
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
    
    const paths = await supabaseService.getPopularLearningPaths(limit);
    
    res.status(200).json({
      paths
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get popular learning paths',
      error: error.message
    });
  }
});

export = router;
