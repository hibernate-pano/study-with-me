"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  LinearProgress,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  ArrowBack as ArrowBackIcon,
  School as SchoolIcon,
  MenuBook as MenuBookIcon,
  Timer as TimerIcon,
  BarChart as BarChartIcon,
} from "@mui/icons-material";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { learningPathsApi, progressApi } from "@/lib/api";
import Link from "next/link";

export default function LearningPathDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  const [learningPath, setLearningPath] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [userProgress, setUserProgress] = useState<any>(null);

  useEffect(() => {
    const fetchLearningPath = async () => {
      setIsLoading(true);

      try {
        // 获取学习路径详情
        const pathResponse = await learningPathsApi.getById(
          params.pathId as string
        );
        setLearningPath(pathResponse.path);

        // 获取章节列表
        const chaptersResponse = await learningPathsApi.getChapters(
          params.pathId as string
        );
        setChapters(chaptersResponse.chapters || []);

        // 获取用户学习进度
        if (user) {
          const progressResponse = await progressApi.getUserProgress(
            user.id,
            params.pathId as string
          );
          setUserProgress(progressResponse.progress);
        }
      } catch (error) {
        console.error("获取学习路径详情失败:", error);
        // 如果API调用失败，使用模拟数据
        setLearningPath({
          id: params.pathId,
          title: "React前端开发",
          description: "从零开始学习React，掌握现代前端开发技能",
          goal: "学习React前端开发",
          level: "初级到中级",
          estimated_hours: 20,
          created_at: "2023-05-15T10:30:00Z",
        });

        setChapters([
          { id: 1, title: "React简介", completed: true },
          { id: 2, title: "JSX语法", completed: false },
          { id: 3, title: "组件基础", completed: false },
          { id: 4, title: "组件生命周期", completed: false },
          { id: 5, title: "状态管理", completed: false },
          { id: 6, title: "Context API", completed: false },
          { id: 7, title: "React Router", completed: false },
          { id: 8, title: "API集成", completed: false },
          { id: 9, title: "项目实战", completed: false },
        ]);

        setUserProgress({
          percentage: 11,
          completed_chapters: 1,
          total_chapters: 9,
          last_chapter_id: 1,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLearningPath();
  }, [params.pathId, user]);

  const handleStartLearning = () => {
    setIsStartingLearning(true);

    // 如果有用户进度，使用上次学习的章节ID
    if (userProgress && userProgress.last_chapter_id) {
      setTimeout(() => {
        router.push(
          `/learning-paths/${params.pathId}/chapters/${userProgress.last_chapter_id}`
        );
      }, 300);
      return;
    }

    // 如果没有用户进度，但有章节列表，使用第一个章节的ID
    if (chapters && chapters.length > 0) {
      setTimeout(() => {
        router.push(
          `/learning-paths/${params.pathId}/chapters/${chapters[0].id}`
        );
      }, 300);
      return;
    }

    // 如果没有章节列表，显示错误消息并重定向到学习路径列表
    console.warn("没有找到章节列表，无法开始学习");
    setTimeout(() => {
      alert("无法找到章节内容，请尝试重新选择学习路径");
      router.push("/learning-paths");
    }, 300);
  };

  const handleBackToList = () => {
    router.push("/learning-paths");
  };

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />

        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
          {isLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50vh",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 4 }}>
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBackToList}
                >
                  返回学习路径列表
                </Button>
              </Box>

              <Grid container spacing={4}>
                <Grid
                  sx={{
                    gridColumn: "span 12",
                    "@media (min-width: 900px)": { gridColumn: "span 8" },
                  }}
                >
                  <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                      {learningPath.title}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                      <Chip
                        icon={<SchoolIcon />}
                        label={`难度: ${learningPath.level}`}
                        variant="outlined"
                      />
                      <Chip
                        icon={<MenuBookIcon />}
                        label={`章节: ${chapters.length}`}
                        variant="outlined"
                      />
                      <Chip
                        icon={<TimerIcon />}
                        label={`预计学时: ${
                          learningPath.estimated_hours || 20
                        }小时`}
                        variant="outlined"
                      />
                    </Box>

                    <Typography variant="body1" paragraph>
                      {learningPath.description}
                    </Typography>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h5" gutterBottom>
                      学习目标
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {learningPath.goal}
                    </Typography>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h5" gutterBottom>
                      章节列表
                    </Typography>

                    <List>
                      {chapters.map((chapter, index) => (
                        <Card key={chapter.id} sx={{ mb: 2, borderRadius: 2 }}>
                          <CardContent sx={{ p: 0 }}>
                            <ListItemButton
                              component={Link}
                              href={`/learning-paths/${params.pathId}/chapters/${chapter.id}`}
                            >
                              <ListItemIcon>
                                {chapter.completed ? (
                                  <CheckCircleIcon color="primary" />
                                ) : (
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      width: 24,
                                      textAlign: "center",
                                    }}
                                  >
                                    {index + 1}
                                  </Typography>
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={chapter.title}
                                primaryTypographyProps={{
                                  fontWeight: 500,
                                }}
                              />
                              <PlayArrowIcon color="action" />
                            </ListItemButton>
                          </CardContent>
                        </Card>
                      ))}
                    </List>
                  </Paper>
                </Grid>

                <Grid
                  sx={{
                    gridColumn: "span 12",
                    "@media (min-width: 900px)": { gridColumn: "span 4" },
                  }}
                >
                  <Paper
                    sx={{ p: 4, borderRadius: 2, position: "sticky", top: 20 }}
                  >
                    <Typography variant="h5" gutterBottom>
                      学习进度
                    </Typography>

                    {userProgress ? (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            完成进度
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {userProgress.percentage}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={userProgress.percentage}
                          sx={{ mb: 3, height: 8, borderRadius: 4 }}
                        />

                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mb: 3,
                          }}
                        >
                          <Box sx={{ textAlign: "center" }}>
                            <Typography variant="h6">
                              {userProgress.completed_chapters}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              已完成章节
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem />
                          <Box sx={{ textAlign: "center" }}>
                            <Typography variant="h6">
                              {userProgress.total_chapters -
                                userProgress.completed_chapters}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              剩余章节
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem />
                          <Box sx={{ textAlign: "center" }}>
                            <Typography variant="h6">
                              {userProgress.total_chapters}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              总章节数
                            </Typography>
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                      >
                        您尚未开始学习此路径
                      </Typography>
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={
                        isStartingLearning ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : userProgress ? (
                          <PlayArrowIcon />
                        ) : (
                          <SchoolIcon />
                        )
                      }
                      onClick={handleStartLearning}
                      disabled={isStartingLearning}
                      sx={{ mb: 2 }}
                    >
                      {isStartingLearning
                        ? "正在加载..."
                        : userProgress
                        ? "继续学习"
                        : "开始学习"}
                    </Button>

                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<BarChartIcon />}
                      disabled={!userProgress}
                      component={Link}
                      href={`/learning-paths/${params.pathId}/statistics`}
                    >
                      查看详细统计
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
