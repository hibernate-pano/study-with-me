'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  School as SchoolIcon,
  AutoStories as AutoStoriesIcon,
  Psychology as PsychologyIcon,
  Assignment as AssignmentIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { learningPathsApi } from '@/lib/api';

export default function Home() {
  const [learningGoal, setLearningGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learningGoal.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // 如果用户已登录，则调用API生成学习路径
      if (isAuthenticated && user) {
        console.log('开始生成学习路径，目标:', learningGoal);
        console.log('用户ID:', user.id);

        // 将学习目标和用户ID传递给API
        const response = await learningPathsApi.generate({
          goal: learningGoal,
          userLevel: 'beginner', // 默认为初学者级别
          userId: user.id
        });

        console.log('学习路径生成成功:', response);

        // 生成成功后，将学习路径ID存储在会话存储中
        if (response && response.path && response.path.id) {
          sessionStorage.setItem('newPathId', response.path.id);

          // 重定向到学习路径页面
          router.push('/learning-paths/new');
        } else {
          throw new Error('服务器返回的学习路径数据无效');
        }
      } else {
        // 如果用户未登录，则将学习目标存储在会话存储中，并重定向到登录页面
        sessionStorage.setItem('learningGoal', learningGoal);
        sessionStorage.setItem('redirectPath', '/learning-paths/new');
        router.push('/login');
      }
    } catch (err: any) {
      console.error('生成学习路径失败:', err);

      // 提供更详细的错误信息
      if (typeof err === 'string') {
        setError(err);
      } else if (err && err.message) {
        setError(err.message);
      } else {
        setError('生成学习路径失败，请检查网络连接或稍后再试');
      }

      // 如果是API连接问题，提供更具体的提示
      if (err && err.message && err.message.includes('fetch')) {
        setError('无法连接到服务器，请检查后端服务是否正常运行');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <SchoolIcon fontSize="large" color="primary" />,
      title: '个性化学习路径',
      description: 'AI根据您的学习目标和基础，自动生成定制化的学习计划，让学习更有针对性。'
    },
    {
      icon: <AutoStoriesIcon fontSize="large" color="primary" />,
      title: '结构化知识体系',
      description: '将复杂知识拆解为清晰的结构和进阶路径，降低认知负担，提高学习效率。'
    },
    {
      icon: <PsychologyIcon fontSize="large" color="primary" />,
      title: '智能实时辅导',
      description: '提供24/7的AI辅导，解答疑问，补充知识点，纠正错误理解，就像您的专属导师。'
    },
    {
      icon: <AssignmentIcon fontSize="large" color="primary" />,
      title: '课后练习巩固',
      description: 'AI根据学习内容自动生成针对性练习题，帮助巩固所学知识，查漏补缺。'
    }
  ];

  const [popularPaths, setPopularPaths] = useState([
    {
      id: '1',
      title: 'React前端开发',
      description: '从零开始学习React，掌握现代前端开发技能',
      level: '初级到中级',
      chapters: 12,
      users: 1245
    },
    {
      id: '2',
      title: 'Python数据分析',
      description: '学习Python数据分析，掌握数据处理和可视化技能',
      level: '初级到高级',
      chapters: 15,
      users: 987
    },
    {
      id: '3',
      title: '机器学习基础',
      description: '了解机器学习的核心概念和常用算法',
      level: '中级',
      chapters: 10,
      users: 756
    }
  ]);

  // 获取热门学习路径
  useEffect(() => {
    const fetchPopularPaths = async () => {
      try {
        const response = await learningPathsApi.getPopularPaths(3);
        if (response.paths && response.paths.length > 0) {
          // 将API返回的数据转换为前端需要的格式
          const formattedPaths = response.paths.map(path => ({
            id: path.id,
            title: path.title,
            description: path.description,
            level: path.level,
            chapters: path.chapters || 0,
            users: Math.floor(Math.random() * 1000) + 500 // 模拟用户数
          }));
          setPopularPaths(formattedPaths);
        }
      } catch (error) {
        console.error('获取热门学习路径失败:', error);
        // 如果API调用失败，保留默认数据
      }
    };

    fetchPopularPaths();
  }, []);

  return (
    <Box>
      <Navbar />

      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          pt: 8,
          pb: 6
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                component="h1"
                variant="h2"
                color="text.primary"
                gutterBottom
                sx={{ fontWeight: 500 }}
              >
                AI辅助学习平台
              </Typography>
              <Typography variant="h5" color="text.secondary" paragraph>
                使用AI技术帮助学习，对学习内容进行拆解和制定标准的学习计划，提供实时辅导和课后练习，让学习更高效。
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      label="输入你想学习的内容"
                      placeholder="例如：React前端开发、Python数据分析..."
                      variant="outlined"
                      value={learningGoal}
                      onChange={(e) => setLearningGoal(e.target.value)}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={isLoading || !learningGoal.trim()}
                      sx={{ height: '56px' }}
                      endIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <ArrowForwardIcon />}
                    >
                      {isLoading ? '生成中...' : '开始学习'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ position: 'relative', height: '400px' }}>
                <Image
                  src="/hero-image.png"
                  alt="AI学习助手"
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            component="h2"
            variant="h3"
            align="center"
            color="text.primary"
            gutterBottom
          >
            平台特色
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph>
            我们的AI辅助学习平台提供全方位的学习支持，让您的学习更高效、更有成效
          </Typography>

          <Grid container spacing={4} sx={{ mt: 4 }}>
            {features.map((feature, index) => (
              <Grid item key={index} xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }}
                >
                  {feature.icon}
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Popular Learning Paths */}
      <Box sx={{ py: 8, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography
            component="h2"
            variant="h3"
            align="center"
            color="text.primary"
            gutterBottom
          >
            热门学习路径
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph>
            探索其他用户正在学习的热门内容
          </Typography>

          <Grid container spacing={4} sx={{ mt: 4 }}>
            {popularPaths.map((path, index) => (
              <Grid item key={index} xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h5" component="h2">
                      {path.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {path.description}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        难度: {path.level}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        章节: {path.chapters}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {path.users} 人正在学习
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      color="primary"
                      component={Link}
                      href={`/learning-paths/${path.id}`}
                    >
                      查看详情
                    </Button>
                    <Button
                      size="small"
                      color="primary"
                      component={Link}
                      href={isAuthenticated ? `/learning-paths/${path.id}/chapters/1` : '/login'}
                    >
                      开始学习
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Call to Action */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 8 }}>
        <Container maxWidth="md">
          <Typography variant="h4" align="center" gutterBottom>
            准备好开始您的学习之旅了吗？
          </Typography>
          <Typography variant="h6" align="center" paragraph>
            输入您想学习的内容，AI将为您生成个性化的学习计划
          </Typography>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              立即开始
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'background.paper', py: 6 }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} Study With Me - AI辅助学习平台
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
