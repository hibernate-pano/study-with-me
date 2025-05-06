import express from 'express';
import aiService from '../services/aiService';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route POST /api/content/generate
 * @desc Generate chapter content
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { pathId, chapterTitle, keyPoints } = req.body;

    if (!pathId || !chapterTitle || !keyPoints) {
      return res.status(400).json({ message: 'Path ID, chapter title, and key points are required' });
    }

    // Generate chapter content using AI
    const contentData = await aiService.generateChapterContent(chapterTitle, keyPoints);
    
    // Save to database
    const savedContent = await supabaseService.createChapterContent(pathId, {
      title: chapterTitle,
      content: contentData
    });
    
    res.status(201).json({
      message: 'Chapter content generated successfully',
      content: savedContent
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to generate chapter content',
      error: error.message
    });
  }
});

/**
 * @route GET /api/content/:id
 * @desc Get chapter content by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const chapterId = req.params.id;
    
    const content = await supabaseService.getChapterContent(chapterId);
    
    if (!content) {
      return res.status(404).json({ message: 'Chapter content not found' });
    }
    
    res.status(200).json({
      content
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get chapter content',
      error: error.message
    });
  }
});

export = router;
