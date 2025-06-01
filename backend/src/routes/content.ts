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
  } catch (error) {
    console.error('Error generating chapter content:', error);
    res.status(500).json({
      message: 'Failed to generate chapter content',
      error: error instanceof Error ? error.message : 'Unknown error'
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
  } catch (error) {
    console.error('Error getting chapter content:', error);
    res.status(500).json({
      message: 'Failed to get chapter content',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/content/generate-stream/:pathId/:chapterId
 * @desc Generate chapter content with streaming response
 * @access Private
 */
router.get('/generate-stream/:pathId/:chapterId', async (req, res) => {
  try {
    const { pathId, chapterId } = req.params;

    // 设置响应头，启用流式传输
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用Nginx缓冲
      'Access-Control-Allow-Origin': '*', // 允许跨域访问
      'Access-Control-Allow-Credentials': 'true'
    });

    // 发送初始消息
    res.write(`data: ${JSON.stringify({ type: 'status', message: '开始生成章节内容...' })}\n\n`);

    // 注意：我们移除了res.flush()调用，因为它在Express的TypeScript类型中不存在
    // 大多数现代Node.js环境会自动刷新响应

    // 获取章节信息
    let chapter;
    try {
      chapter = await supabaseService.getChapterContent(chapterId);

      if (!chapter) {
        // 如果找不到章节，尝试获取学习路径信息
        const path = await supabaseService.getLearningPath(pathId);

        if (!path) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: '找不到学习路径' })}\n\n`);
          res.end();
          return;
        }

        // 查找对应的章节信息
        let targetChapter = null;
        for (const stage of path.stages) {
          for (const ch of stage.chapters) {
            if (ch.title.toLowerCase().includes(chapterId.toLowerCase()) ||
                ch.keyPoints.some((kp: string) => kp.toLowerCase().includes(chapterId.toLowerCase()))) {
              targetChapter = ch;
              break;
            }
          }
          if (targetChapter) break;
        }

        if (!targetChapter) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: '找不到对应的章节信息' })}\n\n`);
          res.end();
          return;
        }

        // 发送状态更新
        res.write(`data: ${JSON.stringify({
          type: 'status',
          message: `找到章节: ${targetChapter.title}，开始生成内容...`
        })}\n\n`);

        // 生成章节内容
        const contentData = await aiService.generateChapterContent(
          targetChapter.title,
          targetChapter.keyPoints,
          (chunk) => {
            // 发送内容块
            res.write(`data: ${JSON.stringify({
              type: 'content_chunk',
              chunk
            })}\n\n`);
          }
        );

        // 保存到数据库
        const savedContent = await supabaseService.createChapterContent(
          pathId,
          {
            title: targetChapter.title,
            content: contentData
          },
          // 如果chapterId是数字，则使用它作为order_index
          !isNaN(Number(chapterId)) ? Number(chapterId) : undefined
        );

        // 发送完成消息
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          message: '章节内容生成完成',
          chapterId: savedContent.id,
          content: savedContent
        })}\n\n`);
      } else {
        // 如果章节已存在，直接返回内容
        res.write(`data: ${JSON.stringify({
          type: 'status',
          message: `章节已存在: ${chapter.title}，返回现有内容`
        })}\n\n`);

        // 发送完成消息
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          message: '返回现有章节内容',
          chapterId: chapter.id,
          content: chapter
        })}\n\n`);
      }
    } catch (error) {
      console.error('获取或生成章节内容时出错:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: `生成章节内容时出错: ${error instanceof Error ? error.message : '未知错误'} `
      })}\n\n`);
    }

    // 结束响应
    res.end();
  } catch (error) {
    console.error('流式生成章节内容时出错:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: `服务器错误: ${error instanceof Error ? error.message : '未知错误'} `
    })}\n\n`);
    res.end();
  }
});

export = router;
