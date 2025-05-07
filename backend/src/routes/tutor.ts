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
    const { message, context, userId, pathId, chapterId } = req.body;

    if (!message || !context) {
      return res.status(400).json({ message: 'Message and context are required' });
    }

    // Get AI response
    const answer = await aiService.answerQuestion(message, context);

    // Return consistent response format
    res.status(200).json({
      message: answer, // Use 'message' key to match frontend expectation
      success: true
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    res.status(500).json({
      message: 'Failed to generate response: ' + error.message,
      success: false
    });
  }
});

export = router;
