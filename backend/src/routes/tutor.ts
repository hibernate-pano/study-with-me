import express from 'express';
import aiService from '../services/aiService';

const router = express.Router();

/**
 * @route POST /api/tutor/chat
 * @desc Get AI response to a question
 * @access Private
 */
router.post('/chat', async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || !context) {
      return res.status(400).json({ message: 'Question and context are required' });
    }

    // Get AI response
    const answer = await aiService.answerQuestion(question, context);
    
    res.status(200).json({
      message: 'Response generated successfully',
      answer
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to generate response',
      error: error.message
    });
  }
});

export = router;
