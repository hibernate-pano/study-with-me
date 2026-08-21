import { Request, Response } from "express";
import adaptivePathService from "../services/adaptivePathService";
import adaptiveExerciseService from "../services/adaptiveExerciseService";
import socialLearningService from "../services/socialLearningService";

/**
 * 自适应学习控制器
 * 处理自适应学习相关的API请求
 */
class AdaptiveController {
  /**
   * 根据用户水平调整学习路径
   * @param req 请求对象
   * @param res 响应对象
   */
  async adjustLearningPath(req: Request, res: Response): Promise<void> {
    try {
      const { userId, pathId } = req.body;

      if (!userId || !pathId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, pathId",
        });
        return;
      }

      const adjustedPath = await adaptivePathService.adjustPathForUserLevel(
        userId,
        pathId
      );

      res.status(200).json({
        success: true,
        data: adjustedPath,
      });
    } catch (error: any) {
      console.error("Error adjusting learning path:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to adjust learning path",
      });
    }
  }

  /**
   * 生成自适应练习集
   * @param req 请求对象
   * @param res 响应对象
   */
  async generateAdaptiveExercises(req: Request, res: Response): Promise<void> {
    try {
      const { userId, chapterId, count } = req.body;

      if (!userId || !chapterId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, chapterId",
        });
        return;
      }

      const exerciseSet =
        await adaptiveExerciseService.generateAdaptiveExerciseSet(
          userId,
          chapterId,
          count || 5
        );

      res.status(200).json({
        success: true,
        data: exerciseSet,
      });
    } catch (error: any) {
      console.error("Error generating adaptive exercises:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate adaptive exercises",
      });
    }
  }

  /**
   * 记录练习结果
   * @param req 请求对象
   * @param res 响应对象
   */
  async recordExerciseResult(req: Request, res: Response): Promise<void> {
    try {
      const { userId, exerciseId, userAnswer, isCorrect, timeSpent } = req.body;

      if (
        !userId ||
        !exerciseId ||
        userAnswer === undefined ||
        isCorrect === undefined
      ) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: userId, exerciseId, userAnswer, isCorrect",
        });
        return;
      }

      const result = await adaptiveExerciseService.recordExerciseResult(
        userId,
        exerciseId,
        userAnswer,
        isCorrect,
        timeSpent || 0
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Error recording exercise result:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to record exercise result",
      });
    }
  }

  /**
   * 创建学习小组
   * @param req 请求对象
   * @param res 响应对象
   */
  async createLearningGroup(req: Request, res: Response): Promise<void> {
    try {
      const {
        creatorId,
        name,
        description,
        pathId,
        isPrivate,
        maxMembers,
        tags,
      } = req.body;

      if (!creatorId || !name || !description) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: creatorId, name, description",
        });
        return;
      }

      const group = await socialLearningService.createLearningGroup(creatorId, {
        name,
        description,
        pathId,
        isPrivate: isPrivate !== undefined ? isPrivate : false,
        maxMembers,
        tags,
      });

      res.status(201).json({
        success: true,
        data: group,
      });
    } catch (error: any) {
      console.error("Error creating learning group:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create learning group",
      });
    }
  }

  /**
   * 加入学习小组
   * @param req 请求对象
   * @param res 响应对象
   */
  async joinLearningGroup(req: Request, res: Response): Promise<void> {
    try {
      const { userId, groupId } = req.body;

      if (!userId || !groupId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, groupId",
        });
        return;
      }

      const result = await socialLearningService.joinLearningGroup(
        userId,
        groupId
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error joining learning group:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to join learning group",
      });
    }
  }

  /**
   * 离开学习小组
   * @param req 请求对象
   * @param res 响应对象
   */
  async leaveLearningGroup(req: Request, res: Response): Promise<void> {
    try {
      const { userId, groupId } = req.body;

      if (!userId || !groupId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, groupId",
        });
        return;
      }

      const result = await socialLearningService.leaveLearningGroup(
        userId,
        groupId
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error leaving learning group:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to leave learning group",
      });
    }
  }

  /**
   * 创建小组讨论
   * @param req 请求对象
   * @param res 响应对象
   */
  async createGroupDiscussion(req: Request, res: Response): Promise<void> {
    try {
      const { userId, groupId, title, content, type, tags, attachments } =
        req.body;

      if (!userId || !groupId || !title || !content || !type) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: userId, groupId, title, content, type",
        });
        return;
      }

      const discussion = await socialLearningService.createGroupDiscussion(
        userId,
        groupId,
        {
          title,
          content,
          type,
          tags,
          attachments,
        }
      );

      res.status(201).json({
        success: true,
        data: discussion,
      });
    } catch (error: any) {
      console.error("Error creating group discussion:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create group discussion",
      });
    }
  }

  /**
   * 回复讨论
   * @param req 请求对象
   * @param res 响应对象
   */
  async replyToDiscussion(req: Request, res: Response): Promise<void> {
    try {
      const { userId, discussionId, content } = req.body;

      if (!userId || !discussionId || !content) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, discussionId, content",
        });
        return;
      }

      const reply = await socialLearningService.replyToDiscussion(
        userId,
        discussionId,
        content
      );

      res.status(201).json({
        success: true,
        data: reply,
      });
    } catch (error: any) {
      console.error("Error replying to discussion:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reply to discussion",
      });
    }
  }

  /**
   * 创建协作学习会话
   * @param req 请求对象
   * @param res 响应对象
   */
  async createCollaborativeSession(req: Request, res: Response): Promise<void> {
    try {
      const {
        creatorId,
        groupId,
        title,
        description,
        scheduledStart,
        duration,
        topic,
        learningObjectives,
      } = req.body;

      if (!creatorId || !groupId || !title || !topic) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: creatorId, groupId, title, topic",
        });
        return;
      }

      const session = await socialLearningService.createCollaborativeSession(
        creatorId,
        groupId,
        {
          title,
          description: description || "",
          scheduledStart,
          duration,
          topic,
          learningObjectives,
        }
      );

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error: any) {
      console.error("Error creating collaborative session:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create collaborative session",
      });
    }
  }

  /**
   * 加入协作学习会话
   * @param req 请求对象
   * @param res 响应对象
   */
  async joinCollaborativeSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId, sessionId } = req.body;

      if (!userId || !sessionId) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: userId, sessionId",
        });
        return;
      }

      const result = await socialLearningService.joinCollaborativeSession(
        userId,
        sessionId
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error joining collaborative session:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to join collaborative session",
      });
    }
  }

  /**
   * 生成协作学习提示
   * @param req 请求对象
   * @param res 响应对象
   */
  async generateCollaborationPrompts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: "Missing required parameter: sessionId",
        });
        return;
      }

      const prompts = await socialLearningService.generateCollaborationPrompts(
        sessionId
      );

      res.status(200).json({
        success: true,
        data: prompts,
      });
    } catch (error: any) {
      console.error("Error generating collaboration prompts:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate collaboration prompts",
      });
    }
  }

  /**
   * 获取推荐的学习伙伴
   * @param req 请求对象
   * @param res 响应对象
   */
  async getRecommendedStudyPartners(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { count } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "Missing required parameter: userId",
        });
        return;
      }

      const partners = await socialLearningService.getRecommendedStudyPartners(
        userId,
        count ? parseInt(count as string, 10) : 5
      );

      res.status(200).json({
        success: true,
        data: partners,
      });
    } catch (error: any) {
      console.error("Error getting recommended study partners:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get recommended study partners",
      });
    }
  }
}

export default new AdaptiveController();
