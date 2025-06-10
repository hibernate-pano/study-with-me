import express from "express";
import aiService from "../services/aiService";
import supabaseService from "../services/supabaseService";

const router = express.Router();

/**
 * @route POST /api/content/generate
 * @desc Generate chapter content
 * @access Private
 */
router.post("/generate", async (req, res) => {
  try {
    const { pathId, chapterTitle, keyPoints } = req.body;

    if (!pathId || !chapterTitle || !keyPoints) {
      return res.status(400).json({
        message: "Path ID, chapter title, and key points are required",
      });
    }

    // Generate chapter content using AI
    const contentData = await aiService.generateChapterContent(
      chapterTitle,
      keyPoints
    );

    // Save to database
    const savedContent = await supabaseService.createChapterContent(pathId, {
      title: chapterTitle,
      content: contentData,
    });

    res.status(201).json({
      message: "Chapter content generated successfully",
      content: savedContent,
    });
  } catch (error) {
    console.error("Error generating chapter content:", error);
    res.status(500).json({
      message: "Failed to generate chapter content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @route GET /api/content/:id
 * @desc Get chapter content by ID
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    const chapterId = req.params.id;
    const pathId = req.query.pathId as string; // 从查询参数中获取pathId

    console.log(
      `获取章节内容请求 - 章节ID: ${chapterId}${
        pathId ? `, 路径ID: ${pathId}` : ""
      }`
    );

    const content = await supabaseService.getChapterContent(chapterId, pathId);

    if (!content) {
      console.log(
        `章节内容未找到 - 章节ID: ${chapterId}${
          pathId ? `, 路径ID: ${pathId}` : ""
        }`
      );
      return res.status(404).json({
        message: "Chapter content not found",
        details: {
          chapterId,
          pathId: pathId || undefined,
          requestedAt: new Date().toISOString(),
        },
      });
    }

    res.status(200).json({
      content,
    });
  } catch (error) {
    console.error("Error getting chapter content:", error);
    res.status(500).json({
      message: "Failed to get chapter content",
      error: error instanceof Error ? error.message : "Unknown error",
      details: {
        chapterId: req.params.id,
        pathId: req.query.pathId || undefined,
      },
    });
  }
});

/**
 * @route GET /api/content/path/:pathId/chapter/:chapterId
 * @desc Get chapter content by path ID and chapter ID/index
 * @access Private
 */
router.get("/path/:pathId/chapter/:chapterId", async (req, res) => {
  try {
    const { pathId, chapterId } = req.params;

    console.log(`获取章节内容请求 - 路径ID: ${pathId}, 章节ID: ${chapterId}`);

    const content = await supabaseService.getChapterContent(chapterId, pathId);

    if (!content) {
      console.log(`章节内容未找到 - 路径ID: ${pathId}, 章节ID: ${chapterId}`);
      return res.status(404).json({
        message: "Chapter content not found",
        details: {
          pathId,
          chapterId,
          requestedAt: new Date().toISOString(),
        },
      });
    }

    res.status(200).json({
      content,
    });
  } catch (error) {
    console.error("Error getting chapter content:", error);
    res.status(500).json({
      message: "Failed to get chapter content",
      error: error instanceof Error ? error.message : "Unknown error",
      details: {
        pathId: req.params.pathId,
        chapterId: req.params.chapterId,
      },
    });
  }
});

/**
 * @route GET /api/content/generate-stream/:pathId/:chapterId
 * @desc Generate chapter content with streaming response
 * @access Private
 */
router.get("/generate-stream/:pathId/:chapterId", async (req, res) => {
  try {
    const { pathId, chapterId } = req.params;
    console.log(`收到流式生成请求 - 路径ID: ${pathId}, 章节ID: ${chapterId}`);

    // 设置响应头，启用流式传输
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用Nginx缓冲
      "Access-Control-Allow-Origin": "*", // 允许跨域访问
      "Access-Control-Allow-Credentials": "true",
    });

    // 发送初始消息
    res.write(
      `data: ${JSON.stringify({
        type: "status",
        message: "开始生成章节内容...",
      })}\n\n`
    );

    // 获取章节信息
    let chapter;
    try {
      console.log(`尝试获取章节内容 - ID: ${chapterId}`);
      chapter = await supabaseService.getChapterContent(chapterId);

      if (!chapter) {
        console.log(`未找到章节内容，尝试获取学习路径信息`);
        // 如果找不到章节，尝试获取学习路径信息
        const path = await supabaseService.getLearningPath(pathId);

        if (!path) {
          console.error(`找不到学习路径 - ID: ${pathId}`);
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message: "找不到学习路径",
            })}\n\n`
          );
          res.end();
          return;
        }

        console.log(`找到学习路径 - 标题: ${path.title}`);

        // 查找对应的章节信息
        let targetChapter = null;
        let chapterIndex = 0;
        let chapterKeyPoints = [];

        // 检查路径是否有stages结构
        if (path.stages && Array.isArray(path.stages)) {
          console.log(`学习路径包含 ${path.stages.length} 个阶段`);

          for (const stage of path.stages) {
            if (stage.chapters && Array.isArray(stage.chapters)) {
              for (const ch of stage.chapters) {
                chapterIndex++;
                // 如果chapterId是数字，则使用它作为索引
                if (
                  !isNaN(Number(chapterId)) &&
                  chapterIndex === Number(chapterId)
                ) {
                  targetChapter = ch;
                  chapterKeyPoints = ch.keyPoints || [];
                  console.log(
                    `找到匹配的章节 (索引 ${chapterIndex}): ${ch.title}`
                  );
                  break;
                }
                // 否则尝试匹配标题
                else if (
                  (ch.title &&
                    typeof ch.title === "string" &&
                    ch.title.toLowerCase().includes(chapterId.toLowerCase())) ||
                  (ch.keyPoints &&
                    Array.isArray(ch.keyPoints) &&
                    ch.keyPoints.some(
                      (kp: string) =>
                        typeof kp === "string" &&
                        kp.toLowerCase().includes(chapterId.toLowerCase())
                    ))
                ) {
                  targetChapter = ch;
                  chapterKeyPoints = ch.keyPoints || [];
                  console.log(`找到匹配的章节 (标题): ${ch.title}`);
                  break;
                }
              }
              if (targetChapter) break;
            }
          }
        } else {
          console.log(`学习路径没有stages结构，尝试使用默认章节`);
          // 如果路径没有stages结构，创建一个默认章节
          targetChapter = {
            title: `${path.title} - 第${chapterId}章`,
            keyPoints: ["学习目标", "核心概念", "实践应用"],
          };
          chapterKeyPoints = targetChapter.keyPoints;
        }

        if (!targetChapter) {
          console.error(`在学习路径中找不到对应的章节信息`);
          // 如果在路径中找不到章节，但chapterId是数字，创建一个默认章节
          if (!isNaN(Number(chapterId))) {
            targetChapter = {
              title: `${path.title} - 第${chapterId}章`,
              keyPoints: ["学习目标", "核心概念", "实践应用"],
            };
            chapterKeyPoints = targetChapter.keyPoints;
            console.log(`创建默认章节: ${targetChapter.title}`);
          } else {
            res.write(
              `data: ${JSON.stringify({
                type: "error",
                message: "找不到对应的章节信息",
              })}\n\n`
            );
            res.end();
            return;
          }
        }

        // 发送状态更新
        res.write(
          `data: ${JSON.stringify({
            type: "status",
            message: `找到章节: ${targetChapter.title}，开始生成内容...`,
          })}\n\n`
        );

        console.log(`开始生成章节内容 - 标题: ${targetChapter.title}`);

        // 生成章节内容
        const contentData = await aiService.generateChapterContent(
          targetChapter.title,
          chapterKeyPoints,
          (chunk) => {
            // 发送内容块
            res.write(
              `data: ${JSON.stringify({
                type: "content_chunk",
                chunk,
              })}\n\n`
            );
          },
          true // 包含可视化内容
        );

        console.log(`章节内容生成完成，准备保存到数据库`);

        // 保存到数据库
        try {
          const savedContent = await supabaseService.createChapterContent(
            pathId,
            {
              title: targetChapter.title,
              content: contentData,
            },
            // 如果chapterId是数字，则使用它作为order_index
            !isNaN(Number(chapterId)) ? Number(chapterId) : chapterIndex
          );

          console.log(`章节内容已保存到数据库 - ID: ${savedContent.id}`);

          // 发送完成消息
          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              message: "章节内容生成完成",
              chapterId: savedContent.id,
              content: savedContent,
            })}\n\n`
          );
        } catch (saveError) {
          console.error(`保存章节内容失败:`, saveError);
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message: `保存章节内容失败: ${
                saveError instanceof Error ? saveError.message : "数据库错误"
              }`,
            })}\n\n`
          );
        }
      } else {
        // 如果章节已存在，直接返回内容
        console.log(`章节已存在 - 标题: ${chapter.title}，返回现有内容`);
        res.write(
          `data: ${JSON.stringify({
            type: "status",
            message: `章节已存在: ${chapter.title}，返回现有内容`,
          })}\n\n`
        );

        // 发送完成消息
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            message: "返回现有章节内容",
            chapterId: chapter.id,
            content: chapter,
          })}\n\n`
        );
      }
    } catch (error) {
      console.error("获取或生成章节内容时出错:", error);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: `生成章节内容时出错: ${
            error instanceof Error ? error.message : "未知错误"
          } `,
        })}\n\n`
      );
    }

    // 结束响应
    res.end();
  } catch (error) {
    console.error("流式生成章节内容时出错:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: `服务器错误: ${
          error instanceof Error ? error.message : "未知错误"
        } `,
      })}\n\n`
    );
    res.end();
  }
});

export = router;
