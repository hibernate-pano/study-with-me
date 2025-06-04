"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Divider,
  Card,
  CardContent,
  TextField,
  IconButton,
  Tab,
  Tabs,
  LinearProgress,
  CircularProgress,
  Chip,
  Alert,
  Snackbar,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Feedback as FeedbackIcon,
  InsertChart as ChartIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import {
  contentApi,
  tutorApi,
  progressApi,
  exercisesApi,
  learningPathsApi,
  achievementsApi,
  diagramsApi,
  feedbackApi,
} from "@/lib/api";
import FeedbackDialog from "@/components/FeedbackDialog";
import AITutor from "@/components/AITutor";
import LearningTimeTracker from "@/components/LearningTimeTracker";
import ChapterDiagrams from "@/components/ChapterDiagrams";
import {
  ChapterContentSkeleton,
  AITutorSkeleton,
} from "@/components/SkeletonLoaders";
import ContentDisplay from "@/components/ContentDisplay";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// 定义组件接口
interface Chapter {
  id: string;
  title: string;
  completed?: boolean;
}

interface Exercise {
  id: number;
  question: string;
  type: string;
  options: string[];
  answer: string;
  explanation: string;
}

export default function ChapterPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [chapterContent, setChapterContent] = useState<any>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [answerResults, setAnswerResults] = useState<{
    [key: number]: boolean;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [newAchievements, setNewAchievements] = useState<any[]>([]);
  const [achievementAlert, setAchievementAlert] = useState(false);

  const params = useParams();
  const pathId = params.pathId as string;
  const chapterId = params.chapterId as string;
  const { user } = useAuth();

  // 添加一个状态来跟踪是否是移动设备
  const [isMobile, setIsMobile] = useState(false);

  // 检测设备类型
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // 初始检查
    checkMobile();

    // 添加窗口大小变化监听
    window.addEventListener("resize", checkMobile);

    // 清理监听器
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (pathId && chapterId) {
      fetchChapterContent();
      fetchChapters();
    }
  }, [pathId, chapterId]);

  const fetchChapterContent = async () => {
    setIsLoading(true);
    try {
      // 获取章节内容
      const response = await contentApi.getById(chapterId);
      setChapterContent(response.content);

      // 获取练习题
      setLoadingExercises(true);
      try {
        const exercisesResponse = await exercisesApi.getChapterExercises(
          chapterId
        );
        if (exercisesResponse && exercisesResponse.exercises) {
          setExercises(exercisesResponse.exercises);
        } else {
          // 如果没有现成的练习题，可以尝试生成
          const generatedExercises = await exercisesApi.generate({
            chapterId,
            count: 3,
            difficulty: "medium",
          });
          setExercises(generatedExercises.exercises || []);
        }
      } catch (exerciseError) {
        console.error("获取练习题失败:", exerciseError);
        setExercises([]);
      } finally {
        setLoadingExercises(false);
      }

      // 更新学习进度
      if (user) {
        try {
          await progressApi.update({
            userId: user.id,
            pathId,
            chapterId,
            action: "view",
          });

          // 检查是否有新的成就
          await checkAchievements();
        } catch (progressError) {
          console.error("更新学习进度失败:", progressError);
        }
      }
    } catch (error) {
      console.error("获取章节内容失败:", error);
      setChapterContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAnswerSelect = (exerciseId: number, answer: string) => {
    setUserAnswers({
      ...userAnswers,
      [exerciseId]: answer,
    });
  };

  const handleCheckAnswer = async (exerciseId: number) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (exercise && userAnswers[exerciseId]) {
      const isCorrect = userAnswers[exerciseId] === exercise.answer;
      setAnswerResults({
        ...answerResults,
        [exerciseId]: isCorrect,
      });

      // 更新学习进度
      if (user) {
        try {
          await progressApi.update({
            userId: user.id,
            pathId,
            chapterId,
            exerciseId: exerciseId.toString(),
            status: isCorrect ? "completed" : "failed",
          });
        } catch (error) {
          console.error("更新练习题进度失败:", error);
        }
      }
    }
  };

  // 章节列表
  const [userProgress, setUserProgress] = useState<any>(null);

  // 获取章节列表和用户进度
  const fetchChapters = async () => {
    try {
      // 获取学习路径的所有章节
      const chaptersResponse = await learningPathsApi.getChapters(pathId);
      const chaptersData = chaptersResponse.chapters || [];
      setChapters(chaptersData);

      // 设置当前章节索引
      const currentIndex = chaptersData.findIndex(
        (chapter: Chapter) => chapter.id === chapterId
      );
      if (currentIndex !== -1) {
        setCurrentChapterIndex(currentIndex);
      }

      // 获取用户学习进度
      if (user) {
        const progressResponse = await progressApi.getUserProgress(
          user.id,
          pathId
        );
        setUserProgress(progressResponse.progress);
      }
    } catch (error) {
      console.error("获取章节列表失败:", error);
      // 如果API调用失败，显示错误消息
      setSnackbar({
        open: true,
        message: "获取章节列表失败，请稍后再试",
        severity: "error",
      });
      setChapters([]);
    }
  };

  // 检查成就
  const checkAchievements = async () => {
    if (!user) return;

    try {
      const response = await achievementsApi.checkAchievements(user.id);

      if (response.newAchievements && response.newAchievements.length > 0) {
        const achievementsData = response.newAchievements.map((a: any) => ({
          ...a.achievement,
          earned_at: a.earned_at,
        }));

        // 设置新成就并显示提醒
        setNewAchievements(achievementsData);
        setAchievementAlert(true);
      }
    } catch (error) {
      console.error("检查成就失败:", error);
    }
  };

  // 处理反馈提交
  const handleFeedbackSubmit = async (data: any) => {
    // 实现反馈提交逻辑
    try {
      if (!user) {
        throw new Error("用户未登录");
      }

      // 使用feedbackApi提交反馈
      await feedbackApi.submit({
        userId: user.id,
        contentId: data.contentId,
        contentType: data.contentType,
        feedbackType: data.feedbackType,
        feedbackText: data.feedbackText,
        pathId: pathId,
        chapterId: chapterId,
      });

      // 显示成功消息
      setSnackbar({
        open: true,
        message: "感谢您的反馈！我们会认真考虑您的建议",
        severity: "success",
      });

      return Promise.resolve();
    } catch (error) {
      console.error("提交反馈失败:", error);
      // 显示错误消息
      setSnackbar({
        open: true,
        message: "提交反馈失败，请稍后再试",
        severity: "error",
      });
      return Promise.reject(error);
    }
  };

  // 渲染章节内容
  const renderChapterContent = () => {
    if (isLoading) {
      return <ChapterContentSkeleton />;
    }

    if (!chapterContent) {
      return (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" color="error">
            无法加载章节内容
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={fetchChapterContent}
            sx={{ mt: 2 }}
          >
            重试
          </Button>
        </Box>
      );
    }

    return <ContentDisplay content={chapterContent} />;
  };

  return (
    <ProtectedRoute>
      <Navbar />
      {user && (
        <LearningTimeTracker
          pathId={pathId}
          chapterId={chapterId}
          showTimer={true}
        />
      )}

      {/* 移动端抽屉菜单按钮 */}
      {isMobile && (
        <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 1050 }}>
          <IconButton
            onClick={handleDrawerToggle}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              "&:hover": { bgcolor: "primary.dark" },
              width: 56,
              height: 56,
              boxShadow: 3,
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Box
          sx={{ display: "flex", flexDirection: { xs: "column", md: "row" } }}
        >
          {/* 在桌面端显示固定侧边栏，在移动端使用抽屉菜单 */}
          {!isMobile ? (
            <Box
              component="nav"
              sx={{
                width: 280,
                flexShrink: 0,
                mr: 3,
                display: { xs: "none", md: "block" },
              }}
            >
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  章节列表
                </Typography>
                <List>
                  {chapters.map((chapter, index) => (
                    <ListItem key={chapter.id} disablePadding>
                      <ListItemButton
                        selected={chapter.id === chapterId}
                        onClick={() => {
                          window.location.href = `/learning-paths/${pathId}/chapters/${chapter.id}`;
                        }}
                      >
                        <ListItemIcon>
                          {chapter.completed ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <AssignmentIcon />
                          )}
                        </ListItemIcon>
                        <ListItemText primary={chapter.title} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
          ) : (
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={handleDrawerToggle}
              sx={{
                "& .MuiDrawer-paper": {
                  width: "85%",
                  maxWidth: 280,
                  pt: 2,
                },
              }}
            >
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  章节列表
                </Typography>
                <List>
                  {chapters.map((chapter, index) => (
                    <ListItem key={chapter.id} disablePadding>
                      <ListItemButton
                        selected={chapter.id === chapterId}
                        onClick={() => {
                          window.location.href = `/learning-paths/${pathId}/chapters/${chapter.id}`;
                          setDrawerOpen(false);
                        }}
                      >
                        <ListItemIcon>
                          {chapter.completed ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <AssignmentIcon />
                          )}
                        </ListItemIcon>
                        <ListItemText primary={chapter.title} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Drawer>
          )}

          {/* 主内容区域 */}
          <Box sx={{ flexGrow: 1 }}>
            <Paper sx={{ mb: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  variant={isMobile ? "scrollable" : "standard"}
                  scrollButtons={isMobile ? "auto" : false}
                  allowScrollButtonsMobile
                >
                  <Tab label="学习内容" />
                  <Tab label="练习题" />
                  <Tab label="AI辅导" />
                  <Tab label="图表" />
                </Tabs>
              </Box>

              {/* 章节内容标签页 */}
              <TabPanel value={tabValue} index={0}>
                {renderChapterContent()}

                {/* 移动端友好的导航按钮 */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mt: 4,
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 2, sm: 0 },
                  }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => {
                      const prevIndex = currentChapterIndex - 1;
                      if (prevIndex >= 0) {
                        const prevChapter = chapters[prevIndex];
                        window.location.href = `/learning-paths/${pathId}/chapters/${prevChapter.id}`;
                      }
                    }}
                    disabled={currentChapterIndex <= 0}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    上一章
                  </Button>

                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => {
                      const nextIndex = currentChapterIndex + 1;
                      if (nextIndex < chapters.length) {
                        const nextChapter = chapters[nextIndex];
                        window.location.href = `/learning-paths/${pathId}/chapters/${nextChapter.id}`;
                      }
                    }}
                    disabled={currentChapterIndex >= chapters.length - 1}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    下一章
                  </Button>
                </Box>
              </TabPanel>

              {/* 其他标签页保持不变，但添加移动端优化 */}
              <TabPanel value={tabValue} index={1}>
                {/* 练习题部分 */}
                {loadingExercises ? (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      加载练习题...
                    </Typography>
                  </Box>
                ) : exercises.length > 0 ? (
                  exercises.map((exercise) => (
                    <Card key={exercise.id} sx={{ mb: 4, overflow: "visible" }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {exercise.question}
                        </Typography>

                        {exercise.type === "multiple_choice" && (
                          <Box sx={{ mt: 2 }}>
                            {exercise.options.map((option: string) => (
                              <Box
                                key={option}
                                sx={{
                                  mb: 1.5,
                                  "& .MuiButtonBase-root": {
                                    width: "100%",
                                    justifyContent: "flex-start",
                                    p: 1.5,
                                    borderRadius: 1,
                                  },
                                }}
                              >
                                <Button
                                  variant={
                                    userAnswers[exercise.id] === option
                                      ? "contained"
                                      : "outlined"
                                  }
                                  color={
                                    answerResults[exercise.id] !== undefined
                                      ? answerResults[exercise.id]
                                        ? "success"
                                        : userAnswers[exercise.id] === option
                                        ? "error"
                                        : "primary"
                                      : "primary"
                                  }
                                  onClick={() =>
                                    handleAnswerSelect(exercise.id, option)
                                  }
                                  disabled={
                                    answerResults[exercise.id] !== undefined
                                  }
                                >
                                  {option}
                                </Button>
                              </Box>
                            ))}

                            <Box sx={{ mt: 3, textAlign: "center" }}>
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={() => handleCheckAnswer(exercise.id)}
                                disabled={
                                  !userAnswers[exercise.id] ||
                                  answerResults[exercise.id] !== undefined
                                }
                                sx={{ minWidth: { xs: "100%", sm: 120 } }}
                              >
                                提交答案
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body1">暂无练习题</Typography>
                  </Box>
                )}
              </TabPanel>

              {/* AI辅导标签页 */}
              <TabPanel value={tabValue} index={2}>
                {user && <AITutor pathId={pathId} chapterId={chapterId} />}
              </TabPanel>

              {/* 图表标签页 */}
              <TabPanel value={tabValue} index={3}>
                <ChapterDiagrams chapterId={chapterId} />
              </TabPanel>
            </Paper>

            {/* 反馈按钮 - 固定在底部 */}
            <Box
              sx={{
                position: "fixed",
                bottom: isMobile ? 80 : 20,
                right: 20,
                zIndex: 1000,
              }}
            >
              <Button
                variant="contained"
                color="secondary"
                startIcon={<FeedbackIcon />}
                onClick={() => setFeedbackDialogOpen(true)}
                sx={{
                  borderRadius: 8,
                  px: 2,
                  py: isMobile ? 1.5 : 1,
                  boxShadow: 3,
                }}
              >
                {isMobile ? "" : "提供反馈"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* 反馈对话框 */}
      <FeedbackDialog
        open={feedbackDialogOpen}
        onClose={() => setFeedbackDialogOpen(false)}
        contentType="chapter"
        contentId={chapterId}
        onSubmit={handleFeedbackSubmit}
      />

      {/* 成就提醒 */}
      <Snackbar
        open={achievementAlert}
        autoHideDuration={6000}
        onClose={() => setAchievementAlert(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setAchievementAlert(false)}
          severity="success"
          variant="filled"
          sx={{ width: "100%", boxShadow: 3 }}
        >
          恭喜！您获得了新成就：
          {newAchievements.length > 0 ? newAchievements[0].title : ""}
          {newAchievements.length > 1 && `等 ${newAchievements.length} 个成就`}
        </Alert>
      </Snackbar>

      {/* 通知消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ProtectedRoute>
  );
}
