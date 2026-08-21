import express from 'express';
import achievementService from '../services/achievementService';

const router = express.Router();

/**
 * @route GET /api/achievements
 * @desc 获取所有成就
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const achievements = await achievementService.getAllAchievements();
    
    res.status(200).json({
      achievements
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取成就失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/achievements/user/:userId
 * @desc 获取用户已获得的成就
 * @access Private
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const achievements = await achievementService.getUserAchievements(userId);
    
    res.status(200).json({
      achievements
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取用户成就失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/achievements/check/:userId
 * @desc 检查并授予用户成就
 * @access Private
 */
router.post('/check/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const newAchievements = await achievementService.checkAndGrantAchievements(userId);
    
    res.status(200).json({
      message: '成就检查完成',
      newAchievements
    });
  } catch (error: any) {
    res.status(500).json({
      message: '成就检查失败',
      error: error.message
    });
  }
});

export = router;
