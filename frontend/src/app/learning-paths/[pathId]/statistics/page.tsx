'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Paper, 
  Divider, 
  CircularProgress,
  Card,
  CardContent,
  Button,
  Breadcrumbs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  School as SchoolIcon,
  MenuBook as MenuBookIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { progressApi } from '@/lib/api';
import ProgressChart from '@/components/charts/ProgressChart';
import CompletionRateChart from '@/components/charts/CompletionRateChart';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

interface PageProps {
  params: {
    pathId: string;
  };
}

export default function PathStatisticsPage({ params }: PageProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pathStats, setPathStats] = useState<any>(null);

  useEffect(() => {
    const fetchPathStats = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        // 获取学习路径详细统计数据
        const response = await progressApi.getPathStats(user.id, params.pathId);
        setPathStats(response.pathStats);
      } catch (error: any) {
        console.error('获取学习路径统计数据失败:', error);
        setError('获取学习路径统计数据失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPathStats();
  }, [user, params.pathId]);

  // 格式化学习时间
  const formatLearningTime = (seconds: number) => {
    if (!seconds) return '0 分钟';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`;
    }
    return `${minutes} 分钟`;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return '无数据';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ProtectedRoute>
      <Box sx={{ py: 4 }}>
        <Container>
          <Box sx={{ mb: 4 }}>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
              <Link href="/learning-paths" style={{ textDecoration: 'none', color: 'inherit' }}>
                学习路径
              </Link>
              {pathStats && (
                <Link href={`/learning-paths/${params.pathId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {pathStats.path.title}
                </Link>
              )}
              <Typography color="text.primary">学习统计</Typography>
            </Breadcrumbs>
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h4" component="h1" gutterBottom>
                {isLoading ? '加载中...' : pathStats ? `${pathStats.path.title} - 学习统计` : '学习统计'}
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<ArrowBackIcon />}
                component={Link}
                href={`/learning-paths/${params.pathId}`}
              >
                返回学习路径
              </Button>
            </Box>
          </Box>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="error" paragraph>
                {error}
              </Typography>
              <Button 
                variant="contained" 
                component={Link} 
                href={`/learning-paths/${params.pathId}`}
              >
                返回学习路径
              </Button>
            </Paper>
          ) : pathStats ? (
            <>
              {/* 统计卡片 */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6">完成进度</Typography>
                      </Box>
                      <Typography variant="h4" color="primary" fontWeight="bold">
                        {Math.round(pathStats.statistics.completionPercentage)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        学习路径完成率
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <MenuBookIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6">章节完成</Typography>
                      </Box>
                      <Typography variant="h4" color="primary" fontWeight="bold">
                        {pathStats.statistics.completedChapters} / {pathStats.statistics.totalChapters}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        已完成/总章节数
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <AccessTimeIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6">学习时间</Typography>
                      </Box>
                      <Typography variant="h4" color="primary" fontWeight="bold">
                        {formatLearningTime(pathStats.statistics.totalTimeSpent || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        总学习时长
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TimelineIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6">最近学习</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                        {pathStats.statistics.lastAccessedChapter ? pathStats.statistics.lastAccessedChapter.title : '无记录'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pathStats.statistics.lastAccessedChapter ? formatDate(pathStats.statistics.lastAccessedChapter.last_accessed) : '无记录'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* 图表区域 */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={5}>
                  <ProgressChart 
                    completedChapters={pathStats.statistics.completedChapters}
                    totalChapters={pathStats.statistics.totalChapters}
                    title="章节完成情况"
                    size={250}
                  />
                </Grid>
                
                <Grid item xs={12} md={7}>
                  <CompletionRateChart 
                    chaptersWithProgress={pathStats.chaptersWithProgress}
                    height={250}
                  />
                </Grid>
              </Grid>
              
              {/* 章节列表 */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  章节学习详情
                </Typography>
                <List>
                  {pathStats.chaptersWithProgress.map((chapter: any, index: number) => (
                    <Box key={chapter.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        component={Link}
                        href={`/learning-paths/${params.pathId}/chapters/${chapter.id}`}
                        sx={{ 
                          textDecoration: 'none', 
                          color: 'inherit',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <ListItemIcon>
                          {chapter.progress?.completed ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <MenuBookIcon color="primary" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={chapter.title}
                          secondary={
                            chapter.progress 
                              ? `上次访问: ${formatDate(chapter.progress.last_accessed)}${chapter.progress.time_spent ? ` · 学习时间: ${formatLearningTime(chapter.progress.time_spent)}` : ''}`
                              : '尚未开始学习'
                          }
                        />
                        <Chip 
                          label={chapter.progress?.completed ? "已完成" : "继续学习"} 
                          color={chapter.progress?.completed ? "success" : "primary"} 
                          variant={chapter.progress?.completed ? "filled" : "outlined"} 
                          size="small" 
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </Paper>
            </>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                暂无学习数据
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                开始学习后，您的学习统计数据将显示在这里
              </Typography>
              <Button 
                variant="contained" 
                component={Link} 
                href={`/learning-paths/${params.pathId}`}
              >
                开始学习
              </Button>
            </Paper>
          )}
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
