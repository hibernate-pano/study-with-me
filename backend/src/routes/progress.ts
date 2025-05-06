import express from 'express';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route POST /api/progress/update
 * @desc Update user progress
 * @access Private
 */
router.post('/update', async (req, res) => {
  try {
    const { userId, pathId, chapterId, progress } = req.body;

    if (!userId || !pathId || !chapterId || !progress) {
      return res.status(400).json({ message: 'User ID, path ID, chapter ID, and progress data are required' });
    }

    // Update progress
    const updatedProgress = await supabaseService.updateUserProgress(userId, pathId, chapterId, progress);

    res.status(200).json({
      message: 'Progress updated successfully',
      progress: updatedProgress
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update progress',
      error: error.message
    });
  }
});

/**
 * @route GET /api/progress/:userId/:pathId
 * @desc Get user progress for a learning path
 * @access Private
 */
router.get('/:userId/:pathId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const pathId = req.params.pathId;

    const progress = await supabaseService.getUserProgress(userId, pathId);

    res.status(200).json({
      progress
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get progress',
      error: error.message
    });
  }
});

/**
 * @route GET /api/progress/stats/:userId
 * @desc Get user learning statistics
 * @access Private
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const stats = await supabaseService.getUserLearningStats(userId);

    res.status(200).json({
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning statistics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/progress/path-stats/:userId/:pathId
 * @desc Get detailed progress statistics for a learning path
 * @access Private
 */
router.get('/path-stats/:userId/:pathId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const pathId = req.params.pathId;

    const pathStats = await supabaseService.getPathProgressStats(userId, pathId);

    res.status(200).json({
      pathStats
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get path progress statistics',
      error: error.message
    });
  }
});

/**
 * @route GET /api/progress/time-history/:userId
 * @desc Get user learning time history
 * @access Private
 */
router.get('/time-history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const period = req.query.period as 'day' | 'week' | 'month' || 'week';

    const timeHistory = await supabaseService.getLearningTimeHistory(userId, period);

    res.status(200).json({
      timeHistory
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning time history',
      error: error.message
    });
  }
});

export = router;
