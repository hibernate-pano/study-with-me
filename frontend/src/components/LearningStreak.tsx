"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import {
  LocalFireDepartment as FireIcon,
  EmojiEvents as TrophyIcon,
  Celebration as CelebrationIcon,
  CalendarMonth as CalendarIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { streaksApi } from "@/lib/api";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

interface StreakReward {
  id: string;
  title: string;
  description: string;
  days_required: number;
  reward_type: string;
  reward_value: any;
}

interface LearningStreakProps {
  userId?: string;
}

/**
 * 连续学习组件
 * 显示用户的连续学习天数和可获得的奖励
 */
export default function LearningStreak({ userId }: LearningStreakProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [streakData, setStreakData] = useState<any>(null);
  const [availableRewards, setAvailableRewards] = useState<StreakReward[]>([]);
  const [selectedReward, setSelectedReward] = useState<StreakReward | null>(
    null
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { width, height } = useWindowSize();

  // 获取连续学习数据
  useEffect(() => {
    const fetchStreakData = async () => {
      if (!user && !userId) return;

      const targetUserId = userId || user?.id;
      if (!targetUserId) return;

      setIsLoading(true);
      setError("");

      try {
        // 获取用户连续学习数据
        const streakResponse = await streaksApi.getUserStreak(targetUserId);
        setStreakData(streakResponse.streak);

        // 获取可获得的奖励
        const rewardsResponse = await streaksApi.getStreakRewards(targetUserId);
        setAvailableRewards(rewardsResponse.rewards || []);
      } catch (error: any) {
        console.error("获取连续学习数据失败:", error);
        setError("获取连续学习数据失败，请稍后再试");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreakData();
  }, [user, userId]);

  // 更新连续学习天数
  const handleUpdateStreak = async () => {
    if (!user) return;

    try {
      const response = await streaksApi.updateStreak(user.id);
      setStreakData(response.streak);

      // 如果连续天数有变化，重新获取可获得的奖励
      if (response.streak.current_streak !== streakData.current_streak) {
        const rewardsResponse = await streaksApi.getStreakRewards(user.id);
        setAvailableRewards(rewardsResponse.rewards || []);
      }
    } catch (error) {
      console.error("更新连续学习天数失败:", error);
    }
  };

  // 领取奖励
  const handleClaimReward = async () => {
    if (!user || !selectedReward) return;

    try {
      await streaksApi.grantStreakReward(user.id, selectedReward.id);

      // 显示成功消息和庆祝效果
      setSuccessMessage(`恭喜！你获得了"${selectedReward.title}"奖励！`);
      setShowConfetti(true);

      // 从可获得奖励列表中移除
      setAvailableRewards((prev) =>
        prev.filter((r) => r.id !== selectedReward.id)
      );

      // 关闭对话框
      setSelectedReward(null);

      // 5秒后关闭庆祝效果
      setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
    } catch (error) {
      console.error("领取奖励失败:", error);
    }
  };

  // 关闭奖励对话框
  const handleCloseRewardDialog = () => {
    setSelectedReward(null);
  };

  // 关闭成功消息
  const handleCloseSuccessMessage = () => {
    setSuccessMessage("");
  };

  // 获取下一个奖励目标
  const getNextRewardTarget = () => {
    if (!streakData || availableRewards.length === 0) return null;

    // 按所需天数排序
    const sortedRewards = [...availableRewards].sort(
      (a, b) => a.days_required - b.days_required
    );
    return sortedRewards[0];
  };

  // 获取奖励类型图标
  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case "experience_boost":
        return <StarIcon />;
      case "avatar_frame":
      case "avatar":
        return <CelebrationIcon />;
      case "title":
        return <TrophyIcon />;
      case "theme":
        return <StarIcon />;
      default:
        return <TrophyIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!streakData) {
    return (
      <Box sx={{ py: 2, textAlign: "center" }}>
        <Typography variant="body1">
          开始你的学习之旅，记录连续学习天数！
        </Typography>
        <Button variant="contained" onClick={handleUpdateStreak} sx={{ mt: 2 }}>
          开始记录
        </Button>
      </Box>
    );
  }

  const nextReward = getNextRewardTarget();

  return (
    <Box sx={{ py: 2 }}>
      {showConfetti && (
        <Confetti width={width} height={height} recycle={false} />
      )}

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <FireIcon color="primary" sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h5">连续学习</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
              }}
            >
              <Typography variant="h6" gutterBottom>
                当前连续学习天数
              </Typography>
              <Box sx={{ position: "relative", display: "inline-flex", my: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={
                    nextReward
                      ? (streakData.current_streak / nextReward.days_required) *
                        100
                      : 100
                  }
                  size={120}
                  thickness={5}
                  color="primary"
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h3" color="primary" fontWeight="bold">
                    {streakData.current_streak}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    天
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                历史最长连续: {streakData.longest_streak} 天
              </Typography>
              <Button
                variant="contained"
                onClick={handleUpdateStreak}
                startIcon={<CalendarIcon />}
                sx={{ mt: 2 }}
              >
                今日打卡
              </Button>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  连续学习奖励
                </Typography>

                {nextReward ? (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      再坚持{" "}
                      {nextReward.days_required - streakData.current_streak}{" "}
                      天可获得:
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (streakData.current_streak /
                            nextReward.days_required) *
                          100
                        }
                        sx={{ height: 10, borderRadius: 5, mb: 1 }}
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="right"
                      >
                        {streakData.current_streak}/{nextReward.days_required}{" "}
                        天
                      </Typography>
                    </Box>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                      onClick={() => setSelectedReward(nextReward)}
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Box sx={{ mr: 2 }}>
                          {getRewardTypeIcon(nextReward.reward_type)}
                        </Box>
                        <Box>
                          <Typography variant="subtitle1">
                            {nextReward.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {nextReward.description}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    你已获得所有可用奖励！继续保持连续学习，未来会有更多奖励。
                  </Typography>
                )}

                {availableRewards.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      可领取的奖励:
                    </Typography>
                    {availableRewards.map((reward) => (
                      <Chip
                        key={reward.id}
                        label={reward.title}
                        color="primary"
                        variant="outlined"
                        onClick={() => setSelectedReward(reward)}
                        icon={getRewardTypeIcon(reward.reward_type)}
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* 奖励详情对话框 */}
      <Dialog open={!!selectedReward} onClose={handleCloseRewardDialog}>
        {selectedReward && (
          <>
            <DialogTitle>{selectedReward.title}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Box
                  sx={{
                    mr: 2,
                    p: 1,
                    bgcolor: "primary.main",
                    borderRadius: "50%",
                    color: "white",
                  }}
                >
                  {getRewardTypeIcon(selectedReward.reward_type)}
                </Box>
                <Typography variant="body1">
                  {selectedReward.description}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                需要连续学习 {selectedReward.days_required} 天
              </Typography>
              {streakData.current_streak >= selectedReward.days_required && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: "success.light",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" color="success.contrastText">
                    恭喜！你已经达到领取条件，可以立即获得此奖励。
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseRewardDialog}>关闭</Button>
              {streakData.current_streak >= selectedReward.days_required && (
                <Button
                  variant="contained"
                  onClick={handleClaimReward}
                  startIcon={<CelebrationIcon />}
                >
                  领取奖励
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 成功消息 */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccessMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSuccessMessage}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
