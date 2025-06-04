"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  School as SchoolIcon,
} from "@mui/icons-material";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { learningPathsApi } from "@/lib/api";

// 模拟学习路径数据
const mockLearningPath = {
  title: "React前端开发",
  description:
    "从零开始学习React，掌握现代前端开发技能，包括组件开发、状态管理、路由和API集成等内容。",
  stages: [
    {
      title: "基础知识",
      objectives: ["理解React基本概念", "掌握JSX语法", "学习组件开发"],
      chapters: [
        {
          title: "React简介",
          keyPoints: [
            "React的历史和背景",
            "为什么选择React",
            "React与其他框架的比较",
          ],
        },
        {
          title: "JSX语法",
          keyPoints: ["JSX基本语法", "表达式和条件渲染", "JSX与HTML的区别"],
        },
        {
          title: "组件基础",
          keyPoints: ["函数组件和类组件", "组件属性(Props)", "组件状态(State)"],
        },
      ],
    },
    {
      title: "进阶概念",
      objectives: ["掌握React生命周期", "学习状态管理", "理解Context API"],
      chapters: [
        {
          title: "组件生命周期",
          keyPoints: ["挂载阶段", "更新阶段", "卸载阶段"],
        },
        {
          title: "状态管理",
          keyPoints: ["useState钩子", "useReducer钩子", "Redux基础"],
        },
        {
          title: "Context API",
          keyPoints: ["创建Context", "使用Provider", "消费Context"],
        },
      ],
    },
    {
      title: "实战应用",
      objectives: ["学习路由管理", "掌握API集成", "构建完整应用"],
      chapters: [
        {
          title: "React Router",
          keyPoints: ["路由配置", "动态路由", "嵌套路由"],
        },
        {
          title: "API集成",
          keyPoints: ["Fetch API", "Axios", "异步状态管理"],
        },
        {
          title: "项目实战",
          keyPoints: ["项目结构", "组件设计", "性能优化"],
        },
      ],
    },
  ],
};

export default function NewLearningPath() {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [learningPath, setLearningPath] = useState<any>(null);
  const [goal, setGoal] = useState("");
  const [userLevel, setUserLevel] = useState("beginner");
  const [error, setError] = useState("");

  const router = useRouter();
  const { user } = useAuth();

  const steps = ["输入学习目标", "生成学习路径", "开始学习"];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleGeneratePath = async () => {
    if (!goal.trim()) {
      setError("请输入学习目标");
      return;
    }

    setError("");
    setIsLoading(true);
    setActiveStep(1);

    try {
      // 调用后端API生成学习路径
      const response = await learningPathsApi.generate({
        goal,
        userLevel,
        userId: user?.id,
      });

      console.log("学习路径生成成功:", response);

      // 保存生成的学习路径
      setLearningPath(response.path);

      // 将学习路径ID保存到会话存储中
      if (response.path && response.path.id) {
        sessionStorage.setItem("newPathId", response.path.id);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("生成学习路径失败:", error);
      setError("生成学习路径失败，请重试");
      setIsLoading(false);
      setActiveStep(0);
    }
  };

  const handleStartLearning = async () => {
    if (learningPath && learningPath.id) {
      try {
        // 获取学习路径的章节列表
        const chaptersResponse = await learningPathsApi.getChapters(
          learningPath.id
        );
        if (chaptersResponse.chapters && chaptersResponse.chapters.length > 0) {
          // 获取第一个章节的ID
          const firstChapter = chaptersResponse.chapters[0];
          router.push(
            `/learning-paths/${learningPath.id}/chapters/${firstChapter.id}`
          );
        } else {
          console.error("未找到章节数据");
          // 尝试生成章节
          const generateResponse = await fetch(
            `/api/learning-paths/${learningPath.id}/generate-chapters`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (generateResponse.ok) {
            const data = await generateResponse.json();
            if (data.chapters && data.chapters.length > 0) {
              router.push(
                `/learning-paths/${learningPath.id}/chapters/${data.chapters[0].id}`
              );
            } else {
              setError("无法生成章节内容，请重试");
            }
          } else {
            setError("生成章节失败，请重试");
          }
        }
      } catch (error) {
        console.error("获取章节列表失败:", error);
        setError("获取章节列表失败，请重试");
      }
    }
  };

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />

        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
          <Paper sx={{ p: 4, borderRadius: 2 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {activeStep === 0 && (
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 3, py: 4 }}
              >
                <Typography variant="h5" gutterBottom>
                  请输入您想学习的内容
                </Typography>

                <TextField
                  fullWidth
                  label="学习目标"
                  variant="outlined"
                  placeholder="例如：React前端开发、Python数据分析、机器学习基础..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  error={!!error}
                  helperText={error}
                />

                <FormControl fullWidth>
                  <InputLabel id="user-level-label">您的当前水平</InputLabel>
                  <Select
                    labelId="user-level-label"
                    value={userLevel}
                    label="您的当前水平"
                    onChange={(e) => setUserLevel(e.target.value)}
                  >
                    <MenuItem value="beginner">初学者</MenuItem>
                    <MenuItem value="intermediate">中级</MenuItem>
                    <MenuItem value="advanced">高级</MenuItem>
                  </Select>
                </FormControl>

                <Box
                  sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGeneratePath}
                    disabled={!goal.trim()}
                  >
                    生成学习路径
                  </Button>
                </Box>
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                {isLoading ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      py: 8,
                    }}
                  >
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ mt: 3 }}>
                      正在生成您的个性化学习路径...
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      这可能需要一点时间，我们正在为您分析和组织最佳的学习内容
                    </Typography>
                  </Box>
                ) : learningPath ? (
                  <Box>
                    <Typography variant="h4" gutterBottom>
                      {learningPath.title}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {learningPath.description}
                    </Typography>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h5" gutterBottom>
                      学习阶段
                    </Typography>

                    {learningPath.stages.map((stage: any, index: number) => (
                      <Accordion key={index} defaultExpanded={index === 0}>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{ bgcolor: "background.default" }}
                        >
                          <Typography variant="h6">
                            {index + 1}. {stage.title}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="subtitle1" gutterBottom>
                            学习目标:
                          </Typography>
                          <List dense>
                            {stage.objectives.map(
                              (objective: string, objIndex: number) => (
                                <ListItem key={objIndex}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <CheckCircleIcon
                                      color="primary"
                                      fontSize="small"
                                    />
                                  </ListItemIcon>
                                  <ListItemText primary={objective} />
                                </ListItem>
                              )
                            )}
                          </List>

                          <Typography
                            variant="subtitle1"
                            gutterBottom
                            sx={{ mt: 2 }}
                          >
                            章节:
                          </Typography>
                          <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
                          >
                            {stage.chapters.map(
                              (chapter: any, chapterIndex: number) => (
                                <Box
                                  key={chapterIndex}
                                  sx={{
                                    width: {
                                      xs: "100%",
                                      md: "calc(33.33% - 16px)",
                                    },
                                  }}
                                >
                                  <Card variant="outlined">
                                    <CardContent>
                                      <Typography variant="h6" gutterBottom>
                                        {chapter.title}
                                      </Typography>
                                      <Divider sx={{ mb: 2 }} />
                                      <List dense>
                                        {chapter.keyPoints.map(
                                          (
                                            point: string,
                                            pointIndex: number
                                          ) => (
                                            <ListItem key={pointIndex}>
                                              <ListItemIcon
                                                sx={{ minWidth: 28 }}
                                              >
                                                <ArrowForwardIcon fontSize="small" />
                                              </ListItemIcon>
                                              <ListItemText primary={point} />
                                            </ListItem>
                                          )
                                        )}
                                      </List>
                                    </CardContent>
                                  </Card>
                                </Box>
                              )
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ))}

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: 4,
                      }}
                    >
                      <Button onClick={handleBack}>返回修改</Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleStartLearning}
                        endIcon={<SchoolIcon />}
                      >
                        开始学习
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="h6" color="error">
                      {error || "生成学习路径失败，请重试"}
                    </Typography>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleBack}
                      sx={{ mt: 2 }}
                    >
                      返回修改
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
