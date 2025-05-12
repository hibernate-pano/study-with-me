import express from 'express';
import aiService from '../services/aiService';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route GET /api/learning-paths/popular
 * @desc Get popular learning paths
 * @access Public
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;

    const paths = await supabaseService.getPopularLearningPaths(limit);

    res.status(200).json({
      paths
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning path',
      error: error.message
    });
  }
});

/**
 * @route POST /api/learning-paths/generate
 * @desc Generate a learning path
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { goal, userLevel } = req.body;
    const userId = req.body.userId; // In a real app, get this from auth middleware

    if (!goal) {
      return res.status(400).json({ message: 'Learning goal is required' });
    }

    console.log('Generating learning path for goal:', goal);
    console.log('User level:', userLevel || 'beginner');
    console.log('User ID:', userId);

    // Generate learning path using AI
    const pathData = await aiService.generateLearningPath(goal, userLevel || 'beginner');

    console.log('AI generated path data successfully');

    // Save to database using service client to bypass RLS
    const savedPath = await supabaseService.createLearningPath(userId, pathData);

    // 为每个阶段的每个章节创建初始内容
    console.log('开始为学习路径创建章节内容...');
    try {
      let chapterIndex = 1;
      for (const stage of pathData.stages) {
        for (const chapter of stage.chapters) {
          console.log(`创建章节: ${chapter.title}, order_index: ${chapterIndex}`);

          // 创建初始章节内容
          const initialContent = {
            summary: `这是"${chapter.title}"章节的概述。本章将涵盖以下要点: ${chapter.keyPoints.join(', ')}。`,
            concepts: chapter.keyPoints.map((point: string) => ({
              title: point,
              explanation: `关于"${point}"的详细解释将在这里展开。`,
              examples: [],
              diagramType: 'concept'
            })),
            codeExamples: [],
            exercises: [],
            faq: []
          };

          // 保存章节内容到数据库
          await supabaseService.createChapterContent(
            savedPath.id,
            {
              title: chapter.title,
              content: initialContent
            },
            chapterIndex
          );

          chapterIndex++;
        }
      }
      console.log(`成功创建了${chapterIndex - 1}个章节`);
    } catch (chapterError: any) {
      console.error('创建章节内容时出错:', chapterError);
      // 即使章节创建失败，我们仍然返回成功创建的学习路径
    }

    res.status(201).json({
      message: 'Learning path generated successfully',
      path: savedPath
    });
  } catch (error: any) {
    console.error('Error in generate learning path route:', error);

    res.status(500).json({
      message: 'Failed to generate learning path',
      error: error.message
    });
  }
});

/**
 * @route GET /api/learning-paths/user/:userId
 * @desc Get all learning paths for a user
 * @access Private
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const paths = await supabaseService.getUserLearningPaths(userId);

    res.status(200).json({
      paths
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning paths',
      error: error.message
    });
  }
});

/**
 * @route GET /api/learning-paths/:id
 * @desc Get a learning path by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const pathId = req.params.id;

    const path = await supabaseService.getLearningPath(pathId);

    if (!path) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    res.status(200).json({
      path
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get learning path',
      error: error.message
    });
  }
});

/**
 * @route GET /api/learning-paths/:pathId/chapters
 * @desc Get all chapters for a learning path
 * @access Private
 */
router.get('/:pathId/chapters', async (req, res) => {
  try {
    const pathId = req.params.pathId;

    const chapters = await supabaseService.getChapters(pathId);

    res.status(200).json({
      chapters
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get chapters',
      error: error.message
    });
  }
});

/**
 * @route POST /api/learning-paths/:pathId/generate-chapters
 * @desc Generate chapters for an existing learning path
 * @access Private
 */
router.post('/:pathId/generate-chapters', async (req, res) => {
  try {
    const pathId = req.params.pathId;

    // 获取学习路径
    const path = await supabaseService.getLearningPath(pathId);

    if (!path) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    // 检查是否已有章节
    const existingChapters = await supabaseService.getChapters(pathId);

    if (existingChapters && existingChapters.length > 0) {
      return res.status(400).json({
        message: 'This learning path already has chapters',
        chapters: existingChapters
      });
    }

    // 为每个阶段的每个章节创建初始内容
    console.log(`开始为学习路径 ${path.title} (${pathId}) 创建章节内容...`);

    try {
      let chapterIndex = 1;
      let chaptersCreated = [];

      for (const stage of path.stages) {
        for (const chapter of stage.chapters) {
          console.log(`创建章节: ${chapter.title}, order_index: ${chapterIndex}`);

          // 创建初始章节内容
          const initialContent = {
            summary: `这是"${chapter.title}"章节的概述。本章将涵盖以下要点: ${chapter.keyPoints.join(', ')}。`,
            concepts: chapter.keyPoints.map((point: string) => ({
              title: point,
              explanation: `关于"${point}"的详细解释将在这里展开。`,
              examples: [],
              diagramType: 'concept'
            })),
            codeExamples: [],
            exercises: [],
            faq: []
          };

          // 保存章节内容到数据库
          const savedChapter = await supabaseService.createChapterContent(
            pathId,
            {
              title: chapter.title,
              content: initialContent
            },
            chapterIndex
          );

          chaptersCreated.push(savedChapter);
          chapterIndex++;
        }
      }

      console.log(`成功为学习路径 ${path.title} 创建了${chaptersCreated.length}个章节`);

      res.status(201).json({
        message: `Successfully created ${chaptersCreated.length} chapters for learning path`,
        chapters: chaptersCreated
      });

    } catch (chapterError: any) {
      console.error('创建章节内容时出错:', chapterError);
      res.status(500).json({
        message: 'Failed to create chapter content',
        error: chapterError.message
      });
    }
  } catch (error: any) {
    console.error('Error in generate chapters route:', error);
    res.status(500).json({
      message: 'Failed to generate chapters',
      error: error.message
    });
  }
});

export = router;
