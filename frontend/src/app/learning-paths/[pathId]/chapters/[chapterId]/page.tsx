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

export default function ChapterPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [chapterContent, setChapterContent] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [answerResults, setAnswerResults] = useState<{
    [key: number]: boolean;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [chapters, setChapters] = useState<any[]>([]);
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
      // 在实际应用中，这里应该显示错误消息而不是使用模拟数据
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
      setChapters(chaptersResponse.chapters || []);

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
      // 如果API调用失败，使用模拟数据
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
      <LearningTimeTracker
        userId={user?.id}
        pathId={pathId}
        chapterId={chapterId}
      />

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
                                  selected={userAnswers[exercise.id] === option}
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
                <AITutor
                  userId={user?.id}
                  pathId={pathId}
                  chapterId={chapterId}
                />
              </TabPanel>

              {/* 图表标签页 */}
              <TabPanel value={tabValue} index={3}>
                <ChapterDiagrams pathId={pathId} chapterId={chapterId} />
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
        pathId={pathId}
        chapterId={chapterId}
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
