import express from 'express';
import streakService from '../services/streakService';

const router = express.Router();

/**
 * @route GET /api/streaks/:userId
 * @desc 获取用户的学习连续性数据
 * @access Private
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const streakData = await streakService.getUserStreak(userId);
    
    res.status(200).json({
      streak: streakData
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取学习连续性数据失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/streaks/:userId/update
 * @desc 更新用户的学习连续性数据
 * @access Private
 */
router.post('/:userId/update', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const updatedStreakData = await streakService.updateUserStreak(userId);
    
    res.status(200).json({
      message: '学习连续性数据更新成功',
      streak: updatedStreakData
    });
  } catch (error: any) {
    res.status(500).json({
      message: '更新学习连续性数据失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/streaks/:userId/rewards
 * @desc 获取用户的连续学习奖励
 * @access Private
 */
router.get('/:userId/rewards', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const rewards = await streakService.getStreakRewards(userId);
    
    res.status(200).json({
      rewards
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取连续学习奖励失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/streaks/:userId/rewards/:rewardId/grant
 * @desc 授予用户连续学习奖励
 * @access Private
 */
router.post('/:userId/rewards/:rewardId/grant', async (req, res) => {
  try {
    const userId = req.params.userId;
    const rewardId = req.params.rewardId;
    
    const grantedReward = await streakService.grantStreakReward(userId, rewardId);
    
    res.status(200).json({
      message: '奖励授予成功',
      reward: grantedReward
    });
  } catch (error: any) {
    res.status(500).json({
      message: '授予奖励失败',
      error: error.message
    });
  }
});

export = router;
