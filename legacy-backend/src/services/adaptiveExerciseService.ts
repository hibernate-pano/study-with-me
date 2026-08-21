import supabaseService from "./supabaseService";
import aiService from "./aiService";

/**
 * 难度级别映射
 */
enum DifficultyLevel {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
  CHALLENGE = "challenge",
}

/**
 * 表现评级类型
 */
type PerformanceRating =
  | "excellent"
  | "good"
  | "average"
  | "poor"
  | "struggling";

/**
 * 难度级别权重
 */
const DIFFICULTY_WEIGHTS = {
  [DifficultyLevel.EASY]: 1,
  [DifficultyLevel.MEDIUM]: 2,
  [DifficultyLevel.HARD]: 3,
  [DifficultyLevel.CHALLENGE]: 4,
};

/**
 * 表现评级权重
 */
const PERFORMANCE_WEIGHTS: Record<PerformanceRating, number> = {
  excellent: 1.5, // 提高难度
  good: 1.2, // 稍微提高难度
  average: 1.0, // 保持当前难度
  poor: 0.8, // 稍微降低难度
  struggling: 0.6, // 显著降低难度
};

/**
 * 用户表现分析接口
 */
interface UserPerformance {
  overall_rating: PerformanceRating;
  correct_rate: number;
  attempt_count: number;
  avg_time_per_question: number;
  strengths: string[];
  weakPoints: string[];
}

/**
 * 自适应练习系统服务
 * 根据用户表现自动调整练习难度
 */
class AdaptiveExerciseService {
  /**
   * 为用户生成自适应练习集
   * @param userId 用户ID
   * @param chapterId 章节ID
   * @param count 练习题数量
   * @returns 生成的练习集
   */
  async generateAdaptiveExerciseSet(
    userId: string,
    chapterId: string,
    count: number = 5
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 获取章节信息
      const { data: chapter, error: chapterError } = await supabase
        .from("path_chapters")
        .select("*, path_stages(*, learning_paths(*))")
        .eq("id", chapterId)
        .single();

      if (chapterError || !chapter) {
        throw new Error(
          `Failed to fetch chapter: ${
            chapterError?.message || "Chapter not found"
          }`
        );
      }

      // 分析用户在该章节相关知识点的表现
      const performance = await this.analyzeUserPerformance(userId, chapter);

      // 确定适合的难度级别
      const targetDifficulty = this.determineTargetDifficulty(performance);

      // 获取已有的适合难度的练习题
      const { data: existingExercises, error: exercisesError } = await supabase
        .from("exercises")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("difficulty", targetDifficulty)
        .limit(count);

      if (exercisesError) {
        throw new Error(`Failed to fetch exercises: ${exercisesError.message}`);
      }

      // 如果已有足够的练习题，直接返回
      if (existingExercises && existingExercises.length >= count) {
        return {
          exercises: existingExercises.slice(0, count),
          difficulty: targetDifficulty,
          performance_summary: performance,
        };
      }

      // 如果现有题目不足，需要生成新题目
      const neededCount = count - (existingExercises?.length || 0);

      // 生成新的练习题
      const newExercises = await this.generateExercises(
        chapter,
        targetDifficulty,
        neededCount,
        performance.weakPoints
      );

      // 保存新生成的练习题
      const savedExercises = await this.saveExercises(
        newExercises,
        chapterId,
        targetDifficulty
      );

      // 合并已有和新生成的练习题
      const allExercises = [...(existingExercises || []), ...savedExercises];

      return {
        exercises: allExercises,
        difficulty: targetDifficulty,
        performance_summary: performance,
      };
    } catch (error: any) {
      console.error("Error generating adaptive exercise set:", error);
      throw new Error(
        `Failed to generate adaptive exercises: ${error.message}`
      );
    }
  }

  /**
   * 分析用户在特定章节相关知识点的表现
   * @param userId 用户ID
   * @param chapter 章节信息
   * @returns 用户表现分析
   */
  private async analyzeUserPerformance(
    userId: string,
    chapter: any
  ): Promise<UserPerformance> {
    const supabase = supabaseService.getClient();

    // 获取章节的知识点
    const knowledgePoints = chapter.key_points || [];

    // 获取用户在这些知识点上的练习结果
    const { data: exerciseResults, error: resultsError } = await supabase
      .from("exercise_results")
      .select("*, exercises(*)")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (resultsError) {
      console.error("Error fetching exercise results:", resultsError);
      // 如果获取失败，返回默认表现
      return {
        overall_rating: "average",
        correct_rate: 0,
        attempt_count: 0,
        avg_time_per_question: 0,
        strengths: [],
        weakPoints: [],
      };
    }

    // 如果没有练习记录，返回默认表现
    if (!exerciseResults || exerciseResults.length === 0) {
      return {
        overall_rating: "average",
        correct_rate: 0,
        attempt_count: 0,
        avg_time_per_question: 0,
        strengths: [],
        weakPoints: [],
      };
    }

    // 按知识点分组统计
    const pointStats: Record<
      string,
      { correct: number; total: number; time_spent: number }
    > = {};
    let totalCorrect = 0;
    let totalQuestions = 0;
    let totalTimeSpent = 0;

    exerciseResults.forEach((result) => {
      if (!result.exercises || !result.exercises.knowledge_points) return;

      const points = Array.isArray(result.exercises.knowledge_points)
        ? result.exercises.knowledge_points
        : JSON.parse(result.exercises.knowledge_points || "[]");

      totalQuestions++;
      if (result.is_correct) totalCorrect++;
      totalTimeSpent += result.time_spent || 0;

      points.forEach((point: string) => {
        if (!pointStats[point]) {
          pointStats[point] = { correct: 0, total: 0, time_spent: 0 };
        }

        pointStats[point].total += 1;
        pointStats[point].time_spent += result.time_spent || 0;

        if (result.is_correct) {
          pointStats[point].correct += 1;
        }
      });
    });

    // 计算整体正确率
    const correctRate = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

    // 计算平均每题用时
    const avgTimePerQuestion =
      totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0;

    // 确定强项和弱项
    const strengths: string[] = [];
    const weakPoints: string[] = [];

    Object.entries(pointStats).forEach(([point, stats]) => {
      if (stats.total >= 3) {
        // 至少做过3题才能判断
        const pointCorrectRate = stats.correct / stats.total;

        if (pointCorrectRate >= 0.8) {
          strengths.push(point);
        } else if (pointCorrectRate <= 0.5) {
          weakPoints.push(point);
        }
      }
    });

    // 确定整体表现评级
    let overallRating: PerformanceRating = "average";

    if (correctRate >= 0.9) {
      overallRating = "excellent";
    } else if (correctRate >= 0.75) {
      overallRating = "good";
    } else if (correctRate >= 0.6) {
      overallRating = "average";
    } else if (correctRate >= 0.4) {
      overallRating = "poor";
    } else {
      overallRating = "struggling";
    }

    return {
      overall_rating: overallRating,
      correct_rate: correctRate,
      attempt_count: totalQuestions,
      avg_time_per_question: avgTimePerQuestion,
      strengths,
      weakPoints,
    };
  }

  /**
   * 根据用户表现确定目标难度
   * @param performance 用户表现分析
   * @returns 目标难度级别
   */
  private determineTargetDifficulty(
    performance: UserPerformance
  ): DifficultyLevel {
    // 默认从中等难度开始
    let baseDifficulty = DifficultyLevel.MEDIUM;

    // 根据尝试次数调整基础难度
    if (performance.attempt_count > 0) {
      // 根据表现评级调整难度
      const performanceWeight = PERFORMANCE_WEIGHTS[performance.overall_rating];

      // 计算难度分数
      let difficultyScore = 2; // 默认中等难度分数

      if (performance.correct_rate >= 0.9) {
        difficultyScore = 3; // 高难度
      } else if (performance.correct_rate >= 0.7) {
        difficultyScore = 2; // 中等难度
      } else {
        difficultyScore = 1; // 低难度
      }

      // 应用表现权重
      difficultyScore *= performanceWeight;

      // 确定最终难度级别
      if (difficultyScore >= 3.5) {
        return DifficultyLevel.CHALLENGE;
      } else if (difficultyScore >= 2.5) {
        return DifficultyLevel.HARD;
      } else if (difficultyScore >= 1.5) {
        return DifficultyLevel.MEDIUM;
      } else {
        return DifficultyLevel.EASY;
      }
    }

    return baseDifficulty;
  }

  /**
   * 生成新的练习题
   * @param chapter 章节信息
   * @param difficulty 难度级别
   * @param count 题目数量
   * @param weakPoints 薄弱知识点
   * @returns 生成的练习题
   */
  private async generateExercises(
    chapter: any,
    difficulty: string,
    count: number,
    weakPoints: string[]
  ): Promise<any[]> {
    // 准备生成练习题的提示词
    const prompt = `
      请为以下学习章节生成${count}道练习题：
      
      章节标题：${chapter.title}
      章节描述：${chapter.description || ""}
      关键知识点：${(chapter.key_points || []).join("、")}
      
      ${
        weakPoints.length > 0
          ? `用户的薄弱知识点：${weakPoints.join("、")}`
          : ""
      }
      
      难度级别：${difficulty}
      
      请生成多种类型的题目，包括：
      1. 选择题
      2. 判断题
      3. 填空题
      4. 简答题
      
      每道题目需要包含：
      - 题目内容
      - 选项（如果是选择题）
      - 正确答案
      - 解析
      - 相关知识点
      
      请以JSON格式返回，格式如下：
      [
        {
          "type": "multiple_choice", // 或 "true_false", "fill_blank", "short_answer"
          "content": "题目内容",
          "options": ["选项A", "选项B", "选项C", "选项D"], // 仅选择题需要
          "answer": "正确答案",
          "explanation": "解析",
          "knowledge_points": ["相关知识点1", "相关知识点2"]
        }
      ]
    `;

    const responseText = await aiService.generateContent(prompt, {
      temperature: 0.7, // 增加一些随机性，使题目更多样
      max_tokens: 2500,
    });

    try {
      // 提取JSON部分
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON found in AI response");
      }
    } catch (error: any) {
      console.error("Failed to parse generated exercises:", error);
      throw new Error(`Failed to generate exercises: ${error.message}`);
    }
  }

  /**
   * 保存生成的练习题到数据库
   * @param exercises 练习题列表
   * @param chapterId 章节ID
   * @param difficulty 难度级别
   * @returns 保存后的练习题
   */
  private async saveExercises(
    exercises: any[],
    chapterId: string,
    difficulty: string
  ): Promise<any[]> {
    const supabase = supabaseService.getClient();
    const savedExercises: any[] = [];

    for (const exercise of exercises) {
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          chapter_id: chapterId,
          type: exercise.type,
          difficulty,
          content: exercise.content,
          options: exercise.options,
          answer: exercise.answer,
          explanation: exercise.explanation,
          knowledge_points: exercise.knowledge_points,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving exercise:", error);
        continue;
      }

      if (data) {
        savedExercises.push(data);
      }
    }

    return savedExercises;
  }

  /**
   * 记录用户练习结果并更新用户模型
   * @param userId 用户ID
   * @param exerciseId 练习题ID
   * @param userAnswer 用户答案
   * @param isCorrect 是否正确
   * @param timeSpent 花费时间（秒）
   * @returns 保存的结果
   */
  async recordExerciseResult(
    userId: string,
    exerciseId: string,
    userAnswer: string,
    isCorrect: boolean,
    timeSpent: number
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 保存练习结果
      const { data: resultData, error: resultError } = await supabase
        .from("exercise_results")
        .insert({
          user_id: userId,
          exercise_id: exerciseId,
          user_answer: userAnswer,
          is_correct: isCorrect,
          time_spent: timeSpent,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (resultError) {
        throw new Error(
          `Failed to save exercise result: ${resultError.message}`
        );
      }

      // 获取练习题信息
      const { data: exercise, error: exerciseError } = await supabase
        .from("exercises")
        .select("*, path_chapters(*)")
        .eq("id", exerciseId)
        .single();

      if (exerciseError || !exercise) {
        console.error("Failed to fetch exercise:", exerciseError);
        return resultData;
      }

      // 更新用户进度
      await this.updateUserProgress(userId, exercise);

      return resultData;
    } catch (error: any) {
      console.error("Error recording exercise result:", error);
      throw new Error(`Failed to record exercise result: ${error.message}`);
    }
  }

  /**
   * 更新用户进度
   * @param userId 用户ID
   * @param exercise 练习题信息
   */
  private async updateUserProgress(
    userId: string,
    exercise: any
  ): Promise<void> {
    try {
      const supabase = supabaseService.getClient();

      if (!exercise.path_chapters) return;

      const chapterId = exercise.chapter_id;
      const pathId = exercise.path_chapters.path_id;

      // 获取用户在该路径的进度
      const { data: progress, error: progressError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("path_id", pathId)
        .single();

      if (progressError && progressError.code !== "PGRST116") {
        console.error("Failed to fetch user progress:", progressError);
        return;
      }

      // 获取用户在该章节的练习结果
      const { data: results, error: resultsError } = await supabase
        .from("exercise_results")
        .select("*, exercises(*)")
        .eq("user_id", userId)
        .eq("exercises.chapter_id", chapterId);

      if (resultsError) {
        console.error("Failed to fetch exercise results:", resultsError);
        return;
      }

      // 计算章节练习完成率
      const totalExercises = results?.length || 0;
      const correctExercises =
        results?.filter((r) => r.is_correct)?.length || 0;
      const completionRate =
        totalExercises > 0 ? correctExercises / totalExercises : 0;

      // 更新或创建用户进度
      if (progress) {
        // 更新现有进度
        const chapterProgress = Array.isArray(progress.chapter_progress)
          ? progress.chapter_progress
          : JSON.parse(progress.chapter_progress || "[]");

        // 查找当前章节的进度
        const chapterIndex = chapterProgress.findIndex(
          (cp: any) => cp.chapter_id === chapterId
        );

        if (chapterIndex >= 0) {
          // 更新现有章节进度
          chapterProgress[chapterIndex] = {
            ...chapterProgress[chapterIndex],
            exercises_completed: totalExercises,
            exercises_correct: correctExercises,
            completion_rate: completionRate,
            last_activity: new Date().toISOString(),
          };

          // 如果完成率达到80%，标记为已完成
          if (
            completionRate >= 0.8 &&
            chapterProgress[chapterIndex].status !== "completed"
          ) {
            chapterProgress[chapterIndex].status = "completed";
            chapterProgress[chapterIndex].completed_at =
              new Date().toISOString();
          }
        } else {
          // 添加新章节进度
          chapterProgress.push({
            chapter_id: chapterId,
            status: completionRate >= 0.8 ? "completed" : "in_progress",
            exercises_completed: totalExercises,
            exercises_correct: correctExercises,
            completion_rate: completionRate,
            last_activity: new Date().toISOString(),
            completed_at:
              completionRate >= 0.8 ? new Date().toISOString() : null,
          });
        }

        // 更新进度
        await supabase
          .from("user_progress")
          .update({
            chapter_progress: chapterProgress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", progress.id);
      } else {
        // 创建新进度
        const chapterProgress = [
          {
            chapter_id: chapterId,
            status: completionRate >= 0.8 ? "completed" : "in_progress",
            exercises_completed: totalExercises,
            exercises_correct: correctExercises,
            completion_rate: completionRate,
            last_activity: new Date().toISOString(),
            completed_at:
              completionRate >= 0.8 ? new Date().toISOString() : null,
          },
        ];

        await supabase.from("user_progress").insert({
          user_id: userId,
          path_id: pathId,
          chapter_progress: chapterProgress,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error("Failed to update user progress:", error);
    }
  }
}

export default new AdaptiveExerciseService();
