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

export = router;
