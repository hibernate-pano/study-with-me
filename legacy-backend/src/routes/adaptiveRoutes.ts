import express from "express";
import adaptiveController from "../controllers/adaptiveController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

// 自适应学习路径路由
router.post(
  "/learning-path/adjust",
  authMiddleware,
  adaptiveController.adjustLearningPath
);

// 自适应练习路由
router.post(
  "/exercises/generate",
  authMiddleware,
  adaptiveController.generateAdaptiveExercises
);
router.post(
  "/exercises/result",
  authMiddleware,
  adaptiveController.recordExerciseResult
);

// 社交学习路由
router.post("/groups", authMiddleware, adaptiveController.createLearningGroup);
router.post(
  "/groups/join",
  authMiddleware,
  adaptiveController.joinLearningGroup
);
router.post(
  "/groups/leave",
  authMiddleware,
  adaptiveController.leaveLearningGroup
);
router.post(
  "/groups/discussions",
  authMiddleware,
  adaptiveController.createGroupDiscussion
);
router.post(
  "/discussions/reply",
  authMiddleware,
  adaptiveController.replyToDiscussion
);

// 协作学习路由
router.post(
  "/collaborative-sessions",
  authMiddleware,
  adaptiveController.createCollaborativeSession
);
router.post(
  "/collaborative-sessions/join",
  authMiddleware,
  adaptiveController.joinCollaborativeSession
);
router.get(
  "/collaborative-sessions/:sessionId/prompts",
  authMiddleware,
  adaptiveController.generateCollaborationPrompts
);

// 学习伙伴推荐
router.get(
  "/study-partners/:userId",
  authMiddleware,
  adaptiveController.getRecommendedStudyPartners
);

export default router;
