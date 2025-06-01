import supabaseService from "./supabaseService";
import aiService from "./aiService";
import LLMLogger from "../utils/LLMLogger";

/**
 * 自适应学习路径服务
 * 根据用户学习进度和表现调整学习路径
 */
class AdaptivePathService {
  /**
   * 根据用户水平调整学习路径
   * @param userId 用户ID
   * @param pathId 学习路径ID
   * @returns 调整后的学习路径
   */
  async adjustPathForUserLevel(userId: string, pathId: string): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 获取原始学习路径
      const { data: originalPath, error: pathError } = await supabase
        .from("learning_paths")
        .select("*")
        .eq("id", pathId)
        .single();

      if (pathError || !originalPath) {
        throw new Error(
          `Failed to fetch learning path: ${
            pathError?.message || "Path not found"
          }`
        );
      }

      // 获取学习路径的阶段和章节
      const { data: stages, error: stagesError } = await supabase
        .from("path_stages")
        .select("*, path_chapters(*)")
        .eq("path_id", pathId)
        .order("order", { ascending: true });

      if (stagesError) {
        throw new Error(`Failed to fetch path stages: ${stagesError.message}`);
      }

      // 获取用户学习进度和评估数据
      const { data: userProgress, error: progressError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("path_id", pathId)
        .single();

      if (progressError && progressError.code !== "PGRST116") {
        // PGRST116 是 "没有找到记录" 的错误代码
        throw new Error(
          `Failed to fetch user progress: ${progressError.message}`
        );
      }

      // 获取用户的练习结果
      const { data: exerciseResults, error: exerciseError } = await supabase
        .from("exercise_results")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (exerciseError) {
        throw new Error(
          `Failed to fetch exercise results: ${exerciseError.message}`
        );
      }

      // 分析用户的强项和弱项
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (exerciseResults && exerciseResults.length > 0) {
        // 按知识点分组统计正确率
        const pointStats: Record<string, { correct: number; total: number }> =
          {};

        exerciseResults.forEach((result: any) => {
          if (!result.knowledge_points) return;

          const points = Array.isArray(result.knowledge_points)
            ? result.knowledge_points
            : JSON.parse(result.knowledge_points || "[]");

          points.forEach((point: string) => {
            if (!pointStats[point]) {
              pointStats[point] = { correct: 0, total: 0 };
            }

            pointStats[point].total += 1;
            if (result.is_correct) {
              pointStats[point].correct += 1;
            }
          });
        });

        // 确定强项和弱项
        Object.entries(pointStats).forEach(([point, stats]) => {
          const correctRate = stats.correct / stats.total;

          if (stats.total >= 3) {
            // 至少有3次练习才能判断
            if (correctRate >= 0.8) {
              strengths.push(point);
            } else if (correctRate <= 0.5) {
              weaknesses.push(point);
            }
          }
        });
      }

      // 构建用户画像
      const completedChapters = userProgress?.completed_chapters || [];
      const learningSpeed = this.determineLearningSpeed(
        userProgress,
        exerciseResults || []
      );
      const preferredStyle =
        userProgress?.preferred_learning_style || "balanced";

      // 使用AI调整学习路径
      const prompt = `
        我需要为一位特定用户调整学习路径。原始学习路径如下：
        
        路径标题：${originalPath.title}
        路径描述：${originalPath.description}
        
        路径阶段：
        ${stages
          .map(
            (stage: any) => `
          - ${stage.title}：${stage.description}
            包含章节：${stage.path_chapters
              .map((ch: any) => ch.title)
              .join(", ")}
        `
          )
          .join("\n")}
        
        用户画像：
        - 已完成的章节：${completedChapters.join(", ") || "无"}
        - 擅长领域：${strengths.join(", ") || "尚未确定"}
        - 薄弱领域：${weaknesses.join(", ") || "尚未确定"}
        - 学习速度：${learningSpeed}
        - 偏好学习风格：${preferredStyle}
        
        请根据用户画像调整学习路径，可以：
        1. 跳过用户已掌握的内容
        2. 为薄弱领域添加更多基础内容
        3. 根据学习速度调整内容深度和广度
        4. 根据学习风格偏好调整内容呈现方式
        
        返回JSON格式的调整后学习路径，结构如下：
        {
          "title": "调整后的路径标题",
          "description": "调整后的路径描述",
          "stages": [
            {
              "title": "阶段标题",
              "description": "阶段描述",
              "order": 1,
              "chapters": [
                {
                  "title": "章节标题",
                  "description": "章节描述",
                  "order": 1,
                  "key_points": ["要点1", "要点2", "要点3"]
                }
              ]
            }
          ]
        }
      `;

      const responseText = await aiService.generateContent(prompt, {
        temperature: 0.2,
        max_tokens: 2000,
      });

      let adjustedPath;
      try {
        // 提取JSON部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          adjustedPath = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON found in AI response");
        }
      } catch (error: any) {
        console.error("Failed to parse AI response:", error);
        throw new Error(`Failed to parse adjusted path: ${error.message}`);
      }

      // 保存调整后的路径
      const { data: newPath, error: insertError } = await supabase
        .from("learning_paths")
        .insert({
          title: adjustedPath.title,
          description: adjustedPath.description,
          original_path_id: pathId,
          user_id: userId,
          is_customized: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !newPath) {
        throw new Error(
          `Failed to save adjusted path: ${
            insertError?.message || "Unknown error"
          }`
        );
      }

      // 保存阶段和章节
      for (let i = 0; i < adjustedPath.stages.length; i++) {
        const stage = adjustedPath.stages[i];

        const { data: newStage, error: stageError } = await supabase
          .from("path_stages")
          .insert({
            path_id: newPath.id,
            title: stage.title,
            description: stage.description,
            order: i + 1,
          })
          .select()
          .single();

        if (stageError || !newStage) {
          throw new Error(
            `Failed to save stage: ${stageError?.message || "Unknown error"}`
          );
        }

        // 保存章节
        for (let j = 0; j < stage.chapters.length; j++) {
          const chapter = stage.chapters[j];

          await supabase.from("path_chapters").insert({
            stage_id: newStage.id,
            path_id: newPath.id,
            title: chapter.title,
            description: chapter.description || "",
            order: j + 1,
            key_points: chapter.key_points || [],
          });
        }
      }

      return newPath;
    } catch (error: any) {
      console.error("Path adjustment error:", error);
      throw new Error(`Failed to adjust learning path: ${error.message}`);
    }
  }

  /**
   * 根据学习进度和练习结果确定用户学习速度
   * @param userProgress 用户学习进度
   * @param exerciseResults 练习结果
   * @returns 学习速度评级
   */
  private determineLearningSpeed(
    userProgress: any,
    exerciseResults: any[]
  ): string {
    if (!userProgress || !exerciseResults || exerciseResults.length === 0) {
      return "medium"; // 默认中等速度
    }

    // 计算平均完成时间
    let totalTimeSpent = 0;
    let completedCount = 0;

    if (userProgress.chapter_progress) {
      const chapterProgress = Array.isArray(userProgress.chapter_progress)
        ? userProgress.chapter_progress
        : JSON.parse(userProgress.chapter_progress || "[]");

      chapterProgress.forEach((progress: any) => {
        if (progress.status === "completed" && progress.time_spent) {
          totalTimeSpent += progress.time_spent;
          completedCount++;
        }
      });
    }

    // 计算练习正确率
    let correctCount = 0;
    exerciseResults.forEach((result) => {
      if (result.is_correct) {
        correctCount++;
      }
    });
    const correctRate =
      exerciseResults.length > 0 ? correctCount / exerciseResults.length : 0;

    // 综合评估学习速度
    if (completedCount > 0) {
      const avgTimePerChapter = totalTimeSpent / completedCount;

      if (correctRate >= 0.8) {
        if (avgTimePerChapter < 15 * 60) {
          // 15分钟
          return "fast";
        } else if (avgTimePerChapter < 30 * 60) {
          // 30分钟
          return "medium-fast";
        }
      } else if (correctRate >= 0.6) {
        if (avgTimePerChapter < 20 * 60) {
          // 20分钟
          return "medium";
        } else {
          return "medium-slow";
        }
      } else {
        return "slow";
      }
    }

    return "medium"; // 默认中等速度
  }
}

export default new AdaptivePathService();
