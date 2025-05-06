'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Paper, 
  Grid,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Card,
  CardContent,
  TextField,
  IconButton,
  Tab,
  Tabs,
  LinearProgress,
  Chip
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

// 模拟章节内容数据
const mockChapterContent = {
  title: 'React简介',
  summary: 'React是由Facebook开发的JavaScript库，用于构建用户界面，特别是单页应用程序。它允许开发者创建可复用的UI组件，并高效地管理组件状态。',
  concepts: [
    {
      title: 'React的历史和背景',
      explanation: 'React由Facebook的软件工程师Jordan Walke创建，并于2013年开源。它最初是为了解决Facebook面临的大规模应用程序开发挑战而设计的。React引入了虚拟DOM的概念，通过比较虚拟DOM与实际DOM的差异，最小化DOM操作，提高性能。',
      examples: ['Facebook网站和应用', 'Instagram', 'WhatsApp Web']
    },
    {
      title: '为什么选择React',
      explanation: 'React具有多种优势，使其成为前端开发的流行选择：\n\n1. **组件化开发**：React鼓励将UI拆分为独立、可复用的组件，使代码更易于维护。\n\n2. **虚拟DOM**：通过虚拟DOM提高渲染性能。\n\n3. **单向数据流**：使应用状态更可预测，更易于调试。\n\n4. **大型社区**：庞大的社区提供了丰富的库、工具和资源。\n\n5. **跨平台**：通过React Native，可以用相同的设计理念开发移动应用。',
      examples: ['提高开发效率', '更好的用户体验', '更容易的团队协作']
    },
    {
      title: 'React与其他框架的比较',
      explanation: 'React与其他前端框架（如Angular和Vue）相比有一些独特的特点：\n\n- **React vs Angular**：Angular是一个完整的框架，提供了更多内置功能，而React是一个库，更专注于UI渲染，需要与其他库配合使用。Angular使用双向数据绑定，React使用单向数据流。\n\n- **React vs Vue**：Vue结合了React和Angular的特点，提供了更简单的API和更温和的学习曲线。React更依赖于JavaScript，而Vue更多地使用模板语法。',
      examples: ['React的JSX vs Vue的模板', 'React的组件生命周期 vs Angular的生命周期钩子', 'React的状态管理 vs Vue的响应式系统']
    }
  ],
  codeExamples: [
    {
      title: '基本的React组件',
      code: `import React from 'react';
import ReactDOM from 'react-dom';

function HelloWorld() {
  return <h1>Hello, World!</h1>;
}

ReactDOM.render(
  <HelloWorld />,
  document.getElementById('root')
);`,
      explanation: '这是一个最简单的React组件示例。我们定义了一个名为HelloWorld的函数组件，它返回一个h1元素。然后使用ReactDOM.render()将组件渲染到DOM中id为"root"的元素内。'
    }
  ],
  exercises: [
    {
      question: '什么是React的虚拟DOM，它如何提高应用性能？',
      hint: '考虑DOM操作的成本和React如何优化这些操作。'
    },
    {
      question: '列出使用React的三个主要优势。',
      hint: '思考组件化、性能和开发体验。'
    },
    {
      question: '比较React和Angular的主要区别。',
      hint: '考虑它们的设计理念、数据流和学习曲线。'
    }
  ],
  faq: [
    {
      question: 'React是框架还是库？',
      answer: 'React严格来说是一个库，而不是框架。它专注于视图层，负责渲染UI组件，通常需要与其他库（如React Router用于路由，Redux用于状态管理）结合使用来构建完整的应用程序。'
    },
    {
      question: '学习React需要什么前置知识？',
      answer: '学习React之前，你应该具备HTML、CSS和JavaScript的基础知识。特别是对JavaScript ES6+特性（如箭头函数、解构赋值、类）的理解会很有帮助。'
    },
    {
      question: 'React适合初学者吗？',
      answer: '对于已经掌握JavaScript基础的开发者来说，React是一个相对容易上手的库。它的核心概念不多，文档完善，社区资源丰富，这些都有助于初学者学习。'
    }
  ]
};

// 模拟练习题数据
const mockExercises = [
  {
    id: 1,
    question: 'React的核心优势是什么？',
    type: 'multiple_choice',
    options: [
      '双向数据绑定',
      '组件化开发和虚拟DOM',
      '内置路由系统',
      '完整的MVC架构'
    ],
    answer: '组件化开发和虚拟DOM',
    explanation: 'React的两个核心优势是组件化开发方式和虚拟DOM技术。组件化使代码更易于维护和复用，而虚拟DOM通过最小化实际DOM操作提高了性能。'
  },
  {
    id: 2,
    question: 'React是由哪家公司开发的？',
    type: 'multiple_choice',
    options: [
      'Google',
      'Microsoft',
      'Facebook (Meta)',
      'Amazon'
    ],
    answer: 'Facebook (Meta)',
    explanation: 'React是由Facebook(现在的Meta)开发的，并于2013年开源。它最初是为了解决Facebook在构建大型应用时面临的挑战而创建的。'
  },
  {
    id: 3,
    question: 'React与Angular的主要区别是什么？',
    type: 'multiple_choice',
    options: [
      'React使用TypeScript，Angular使用JavaScript',
      'React是一个完整框架，Angular是一个库',
      'React使用单向数据流，Angular使用双向数据绑定',
      'React只能用于Web开发，Angular可用于移动开发'
    ],
    answer: 'React使用单向数据流，Angular使用双向数据绑定',
    explanation: 'React采用单向数据流，使数据流动更可预测，而Angular使用双向数据绑定，可以自动同步模型和视图。此外，React是一个库，专注于UI，而Angular是一个完整的框架。'
  }
];

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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ChapterPage() {
  const params = useParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chapterContent, setChapterContent] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [question, setQuestion] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: number]: string}>({});
  const [exerciseResults, setExerciseResults] = useState<{[key: number]: boolean}>({});

  useEffect(() => {
    // 模拟API请求
    const timer = setTimeout(() => {
      setChapterContent(mockChapterContent);
      setExercises(mockExercises);
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSendQuestion = () => {
    if (!question.trim()) return;
    // 在实际应用中，这里会发送请求到AI辅导API
    console.log('发送问题:', question);
    setQuestion('');
  };

  const handleAnswerSelect = (exerciseId: number, answer: string) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [exerciseId]: answer
    });
  };

  const handleCheckAnswer = (exerciseId: number) => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise && selectedAnswers[exerciseId]) {
      const isCorrect = selectedAnswers[exerciseId] === exercise.answer;
      setExerciseResults({
        ...exerciseResults,
        [exerciseId]: isCorrect
      });
    }
  };

  // 模拟章节列表
  const chapters = [
    { id: 1, title: 'React简介', completed: true },
    { id: 2, title: 'JSX语法', completed: false },
    { id: 3, title: '组件基础', completed: false },
    { id: 4, title: '组件生命周期', completed: false },
    { id: 5, title: '状态管理', completed: false },
    { id: 6, title: 'Context API', completed: false },
    { id: 7, title: 'React Router', completed: false },
    { id: 8, title: 'API集成', completed: false },
    { id: 9, title: '项目实战', completed: false },
  ];

  return (
    <Box>
      <Navbar />
      
      <Box sx={{ display: 'flex' }}>
        {/* 侧边导航抽屉 */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          sx={{
            width: 280,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 280,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">React前端开发</Typography>
            <Typography variant="body2" color="text.secondary">
              学习进度: 11%
            </Typography>
            <LinearProgress variant="determinate" value={11} sx={{ mt: 1 }} />
          </Box>
          <Divider />
          <List>
            {chapters.map((chapter) => (
              <ListItem key={chapter.id} disablePadding>
                <ListItemButton selected={chapter.id === Number(params.chapterId)}>
                  <ListItemText 
                    primary={chapter.title} 
                    primaryTypographyProps={{
                      color: chapter.completed ? 'primary' : 'inherit',
                      fontWeight: chapter.id === Number(params.chapterId) ? 500 : 400
                    }}
                  />
                  {chapter.completed && <CheckCircleIcon color="primary" fontSize="small" />}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        
        {/* 主内容区域 */}
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <IconButton 
                edge="start" 
                color="inherit" 
                aria-label="menu" 
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h4" component="h1">
                {isLoading ? '加载中...' : chapterContent?.title}
              </Typography>
            </Box>
            
            {isLoading ? (
              <LinearProgress />
            ) : (
              <Box>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={tabValue} onChange={handleTabChange} aria-label="chapter tabs">
                    <Tab label="学习内容" />
                    <Tab label="练习题" />
                    <Tab label="AI辅导" />
                  </Tabs>
                </Box>
                
                {/* 学习内容标签页 */}
                <TabPanel value={tabValue} index={0}>
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                    <Typography variant="h5" gutterBottom>
                      概述
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {chapterContent.summary}
                    </Typography>
                    
                    <Divider sx={{ my: 3 }} />
                    
                    <Typography variant="h5" gutterBottom>
                      核心概念
                    </Typography>
                    
                    {chapterContent.concepts.map((concept: any, index: number) => (
                      <Card key={index} sx={{ mb: 3, borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {concept.title}
                          </Typography>
                          <ReactMarkdown>
                            {concept.explanation}
                          </ReactMarkdown>
                          
                          {concept.examples.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                示例:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {concept.examples.map((example: string, exIndex: number) => (
                                  <Chip key={exIndex} label={example} size="small" />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    
                    {chapterContent.codeExamples.length > 0 && (
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="h5" gutterBottom>
                          代码示例
                        </Typography>
                        
                        {chapterContent.codeExamples.map((example: any, index: number) => (
                          <Card key={index} sx={{ mb: 3, borderRadius: 2 }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {example.title}
                              </Typography>
                              <Paper 
                                sx={{ 
                                  p: 2, 
                                  bgcolor: 'grey.900', 
                                  color: 'grey.100',
                                  borderRadius: 1,
                                  fontFamily: 'monospace',
                                  overflow: 'auto'
                                }}
                              >
                                <pre style={{ margin: 0 }}>{example.code}</pre>
                              </Paper>
                              <Typography variant="body2" sx={{ mt: 2 }}>
                                {example.explanation}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                    
                    {chapterContent.faq.length > 0 && (
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="h5" gutterBottom>
                          常见问题
                        </Typography>
                        
                        {chapterContent.faq.map((faq: any, index: number) => (
                          <Card key={index} sx={{ mb: 3, borderRadius: 2 }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {faq.question}
                              </Typography>
                              <Typography variant="body1">
                                {faq.answer}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        disabled={Number(params.chapterId) <= 1}
                      >
                        上一章
                      </Button>
                      <Button
                        variant="contained"
                        endIcon={<ArrowForwardIcon />}
                        disabled={Number(params.chapterId) >= chapters.length}
                      >
                        下一章
                      </Button>
                    </Box>
                  </Paper>
                </TabPanel>
                
                {/* 练习题标签页 */}
                <TabPanel value={tabValue} index={1}>
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h5">
                        章节练习
                      </Typography>
                    </Box>
                    
                    <Typography variant="body1" paragraph>
                      完成以下练习题，检验您对本章内容的理解。
                    </Typography>
                    
                    {exercises.map((exercise) => (
                      <Card key={exercise.id} sx={{ mb: 3, borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {exercise.id}. {exercise.question}
                          </Typography>
                          
                          {exercise.type === 'multiple_choice' && (
                            <List>
                              {exercise.options.map((option: string, index: number) => (
                                <ListItem key={index} disablePadding>
                                  <ListItemButton 
                                    onClick={() => handleAnswerSelect(exercise.id, option)}
                                    selected={selectedAnswers[exercise.id] === option}
                                    disabled={exerciseResults[exercise.id] !== undefined}
                                    sx={{ 
                                      borderRadius: 1,
                                      bgcolor: selectedAnswers[exercise.id] === option ? 'primary.50' : 'transparent'
                                    }}
                                  >
                                    <ListItemText primary={option} />
                                  </ListItemButton>
                                </ListItem>
                              ))}
                            </List>
                          )}
                          
                          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button 
                              variant="contained" 
                              onClick={() => handleCheckAnswer(exercise.id)}
                              disabled={!selectedAnswers[exercise.id] || exerciseResults[exercise.id] !== undefined}
                            >
                              提交答案
                            </Button>
                            
                            {exerciseResults[exercise.id] !== undefined && (
                              <Typography 
                                variant="body1" 
                                color={exerciseResults[exercise.id] ? 'success.main' : 'error.main'}
                              >
                                {exerciseResults[exercise.id] ? '✓ 回答正确' : '✗ 回答错误'}
                              </Typography>
                            )}
                          </Box>
                          
                          {exerciseResults[exercise.id] !== undefined && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                解析:
                              </Typography>
                              <Typography variant="body2">
                                {exercise.explanation}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Paper>
                </TabPanel>
                
                {/* AI辅导标签页 */}
                <TabPanel value={tabValue} index={2}>
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h5" gutterBottom>
                      AI辅导助手
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      有任何问题都可以向AI助手提问，它会根据当前学习内容为您提供解答。
                    </Typography>
                    
                    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', borderRadius: 2, p: 2, mb: 2, overflow: 'auto' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 10 }}>
                        暂无对话记录，请在下方输入您的问题。
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        placeholder="输入您的问题..."
                        variant="outlined"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendQuestion()}
                      />
                      <IconButton 
                        color="primary" 
                        onClick={handleSendQuestion}
                        disabled={!question.trim()}
                        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                      >
                        <SendIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                </TabPanel>
              </Box>
            )}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
