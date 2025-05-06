import express from 'express';
import aiService from '../services/aiService';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route POST /api/exercises/generate
 * @desc Generate exercises for a chapter
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { chapterId, difficulty, count } = req.body;

    if (!chapterId) {
      return res.status(400).json({ message: 'Chapter ID is required' });
    }

    // Get chapter content
    const chapterContent = await supabaseService.getChapterContent(chapterId);
    
    if (!chapterContent) {
      return res.status(404).json({ message: 'Chapter content not found' });
    }

    // Generate exercises using AI
    const exercisesData = await aiService.generateExercises(
      chapterContent, 
      difficulty || 'medium',
      count || 5
    );
    
    // Save to database
    const savedExercises = await supabaseService.createExercises(chapterId, exercisesData.exercises);
    
    res.status(201).json({
      message: 'Exercises generated successfully',
      exercises: savedExercises
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to generate exercises',
      error: error.message
    });
  }
});

/**
 * @route GET /api/exercises/chapter/:chapterId
 * @desc Get exercises for a chapter
 * @access Private
 */
router.get('/chapter/:chapterId', async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    
    const exercises = await supabaseService.getChapterExercises(chapterId);
    
    res.status(200).json({
      exercises
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get exercises',
      error: error.message
    });
  }
});

export = router;
