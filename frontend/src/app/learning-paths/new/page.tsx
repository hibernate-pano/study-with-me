'use client';

import { useState, useEffect } from 'react';
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
  Grid
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { learningPathsApi } from '@/lib/api';

// 模拟学习路径数据
const mockLearningPath = {
  title: 'React前端开发',
  description: '从零开始学习React，掌握现代前端开发技能，包括组件开发、状态管理、路由和API集成等内容。',
  stages: [
    {
      title: '基础知识',
      objectives: ['理解React基本概念', '掌握JSX语法', '学习组件开发'],
      chapters: [
        {
          title: 'React简介',
          keyPoints: ['React的历史和背景', '为什么选择React', 'React与其他框架的比较']
        },
        {
          title: 'JSX语法',
          keyPoints: ['JSX基本语法', '表达式和条件渲染', 'JSX与HTML的区别']
        },
        {
          title: '组件基础',
          keyPoints: ['函数组件和类组件', '组件属性(Props)', '组件状态(State)']
        }
      ]
    },
    {
      title: '进阶概念',
      objectives: ['掌握React生命周期', '学习状态管理', '理解Context API'],
      chapters: [
        {
          title: '组件生命周期',
          keyPoints: ['挂载阶段', '更新阶段', '卸载阶段']
        },
        {
          title: '状态管理',
          keyPoints: ['useState钩子', 'useReducer钩子', 'Redux基础']
        },
        {
          title: 'Context API',
          keyPoints: ['创建Context', '使用Provider', '消费Context']
        }
      ]
    },
    {
      title: '实战应用',
      objectives: ['学习路由管理', '掌握API集成', '构建完整应用'],
      chapters: [
        {
          title: 'React Router',
          keyPoints: ['路由配置', '动态路由', '嵌套路由']
        },
        {
          title: 'API集成',
          keyPoints: ['Fetch API', 'Axios', '异步状态管理']
        },
        {
          title: '项目实战',
          keyPoints: ['项目结构', '组件设计', '性能优化']
        }
      ]
    }
  ]
};

export default function NewLearningPath() {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [learningPath, setLearningPath] = useState<any>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // 在实际应用中，这里会调用API生成学习路径
    // 目前仍使用模拟数据
    const timer = setTimeout(() => {
      setLearningPath(mockLearningPath);
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const steps = ['生成学习路径', '自定义调整', '开始学习'];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleStartLearning = () => {
    router.push('/learning-paths/1/chapters/1');
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

            {isLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 3 }}>
                  正在生成您的个性化学习路径...
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  这可能需要一点时间，我们正在为您分析和组织最佳的学习内容
                </Typography>
              </Box>
            ) : (
              <Box>
                {activeStep === 0 && (
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
                          sx={{ bgcolor: 'background.default' }}
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
                            {stage.objectives.map((objective: string, objIndex: number) => (
                              <ListItem key={objIndex}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <CheckCircleIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={objective} />
                              </ListItem>
                            ))}
                          </List>

                          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                            章节:
                          </Typography>
                          <Grid container spacing={2}>
                            {stage.chapters.map((chapter: any, chapterIndex: number) => (
                              <Grid item xs={12} md={4} key={chapterIndex}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                      {chapter.title}
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <List dense>
                                      {chapter.keyPoints.map((point: string, pointIndex: number) => (
                                        <ListItem key={pointIndex} sx={{ px: 0 }}>
                                          <ListItemIcon sx={{ minWidth: 28 }}>
                                            <ArrowForwardIcon color="primary" fontSize="small" />
                                          </ListItemIcon>
                                          <ListItemText primary={point} />
                                        </ListItem>
                                      ))}
                                    </List>
                                  </CardContent>
                                </Card>
                              </Grid>
                            ))}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>
                )}

                {activeStep === 1 && (
                  <Box>
                    <Typography variant="h4" gutterBottom>
                      自定义您的学习路径
                    </Typography>
                    <Typography variant="body1" paragraph>
                      您可以根据自己的需求调整学习路径，添加或删除章节，调整学习顺序等。
                    </Typography>

                    <Typography variant="body1" color="text.secondary" paragraph>
                      (此功能在MVP版本中暂未实现)
                    </Typography>
                  </Box>
                )}

                {activeStep === 2 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <SchoolIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h4" gutterBottom>
                      准备好开始学习了！
                    </Typography>
                    <Typography variant="body1" paragraph>
                      您的学习路径已经准备就绪，点击下方按钮开始您的学习之旅。
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleStartLearning}
                      sx={{ mt: 2 }}
                    >
                      开始学习
                    </Button>
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                  >
                    上一步
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={activeStep === steps.length - 1}
                  >
                    {activeStep === steps.length - 2 ? '完成' : '下一步'}
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
