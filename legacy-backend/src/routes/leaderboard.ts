import express from 'express';
import leaderboardService from '../services/leaderboardService';

const router = express.Router();

/**
 * @route GET /api/leaderboard/time
 * @desc 获取学习时间排行榜
 * @access Public
 */
router.get('/time', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const period = req.query.period as 'week' | 'month' | 'all' || 'week';
    
    const leaderboard = await leaderboardService.getLearningTimeLeaderboard(limit, period);
    
    res.status(200).json({
      leaderboard
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取学习时间排行榜失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leaderboard/completion
 * @desc 获取完成章节数排行榜
 * @access Public
 */
router.get('/completion', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const leaderboard = await leaderboardService.getCompletionLeaderboard(limit);
    
    res.status(200).json({
      leaderboard
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取完成章节数排行榜失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leaderboard/streak
 * @desc 获取连续学习天数排行榜
 * @access Public
 */
router.get('/streak', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const leaderboard = await leaderboardService.getStreakLeaderboard(limit);
    
    res.status(200).json({
      leaderboard
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取连续学习天数排行榜失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leaderboard/user/:userId
 * @desc 获取用户在排行榜中的排名
 * @access Private
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const type = req.query.type as 'time' | 'completion' | 'streak' || 'time';
    const period = req.query.period as 'week' | 'month' | 'all' || 'week';
    
    const ranking = await leaderboardService.getUserRanking(userId, type, period);
    
    res.status(200).json({
      ranking
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取用户排名失败',
      error: error.message
    });
  }
});

export = router;
