import express from "express";
import supabaseService from "../services/supabaseService";

const router = express.Router();

/**
 * @route POST /api/feedback/submit
 * @desc 提交内容反馈
 * @access Private
 */
router.post("/submit", async (req, res) => {
  try {
    const {
      userId,
      contentId,
      contentType,
      feedbackType,
      feedbackText,
      pathId,
      chapterId,
    } = req.body;

    // 验证必要字段
    if (!userId || !contentId || !contentType || !feedbackType) {
      return res.status(400).json({
        message: "用户ID、内容ID、内容类型和反馈类型为必填项",
        success: false,
      });
    }

    // 将反馈保存到数据库
    const { data, error } = await supabaseService
      .getClient()
      .from("user_feedback")
      .insert([
        {
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          feedback_type: feedbackType,
          feedback_text: feedbackText || "",
          path_id: pathId || null,
          chapter_id: chapterId || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("保存反馈失败:", error);
      return res.status(500).json({
        message: "保存反馈失败",
        error: error.message,
        success: false,
      });
    }

    // 返回成功响应
    res.status(200).json({
      message: "反馈提交成功",
      feedback: data[0],
      success: true,
    });
  } catch (error: any) {
    console.error("提交反馈时出错:", error);
    res.status(500).json({
      message: "提交反馈失败",
      error: error.message,
      success: false,
    });
  }
});

/**
 * @route GET /api/feedback/stats/:contentType/:contentId
 * @desc 获取特定内容的反馈统计
 * @access Private
 */
router.get("/stats/:contentType/:contentId", async (req, res) => {
  try {
    const { contentType, contentId } = req.params;

    // 获取反馈统计数据
    // 使用原始SQL查询进行分组统计
    const { data, error } = await supabaseService
      .getClient()
      .rpc("get_feedback_stats", {
        p_content_type: contentType,
        p_content_id: contentId,
      });

    if (error) {
      console.error("获取反馈统计失败:", error);
      return res.status(500).json({
        message: "获取反馈统计失败",
        error: error.message,
        success: false,
      });
    }

    // 计算总反馈数
    const totalFeedback = data.reduce(
      (sum: number, item: { count: number }) => sum + item.count,
      0
    );

    // 返回统计结果
    res.status(200).json({
      stats: data,
      totalFeedback,
      success: true,
    });
  } catch (error: any) {
    console.error("获取反馈统计时出错:", error);
    res.status(500).json({
      message: "获取反馈统计失败",
      error: error.message,
      success: false,
    });
  }
});

/**
 * @route GET /api/feedback/user/:userId
 * @desc 获取用户提交的反馈历史
 * @access Private
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 获取用户的反馈历史
    const { data, error } = await supabaseService
      .getClient()
      .from("user_feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取用户反馈历史失败:", error);
      return res.status(500).json({
        message: "获取用户反馈历史失败",
        error: error.message,
        success: false,
      });
    }

    // 返回用户反馈历史
    res.status(200).json({
      feedback: data,
      success: true,
    });
  } catch (error: any) {
    console.error("获取用户反馈历史时出错:", error);
    res.status(500).json({
      message: "获取用户反馈历史失败",
      error: error.message,
      success: false,
    });
  }
});

export = router;
