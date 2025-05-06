'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Divider, 
  CircularProgress,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  School as SchoolIcon,
  MenuBook as MenuBookIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { progressApi } from '@/lib/api';
import ProgressChart from './charts/ProgressChart';
import LearningTimeChart from './charts/LearningTimeChart';
import Link from 'next/link';

/**
 * 学习统计组件
 */
export default function LearningStatistics() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [timeHistory, setTimeHistory] = useState<any>([]);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        // 获取用户学习统计数据
        const statsResponse = await progressApi.getUserStats(user.id);
        setStats(statsResponse.stats);
        
        // 获取学习时间历史数据
        const timeResponse = await progressApi.getLearningTimeHistory(user.id, timePeriod);
        setTimeHistory(timeResponse.timeHistory.timeHistory || []);
      } catch (error: any) {
        console.error('获取学习统计数据失败:', error);
        setError('获取学习统计数据失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, [user, timePeriod]);

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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
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

  if (!stats) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          暂无学习数据
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          开始学习后，您的学习统计数据将显示在这里
        </Typography>
        <Button 
          variant="contained" 
          component={Link} 
          href="/learning-paths"
        >
          浏览学习路径
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SchoolIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">学习路径</Typography>
              </Box>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {stats.totalPaths || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                已开始学习的路径数量
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
                {stats.completedChapters || 0} / {stats.totalChapters || 0}
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
                {formatLearningTime(stats.totalTimeSpent || 0)}
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
                <EmojiEventsIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">平均得分</Typography>
              </Box>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {stats.averageScore ? Math.round(stats.averageScore) : '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                练习平均得分
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* 图表区域 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ProgressChart 
            completedChapters={stats.completedChapters || 0}
            totalChapters={stats.totalChapters || 0}
            size={250}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <LearningTimeChart 
            timeHistory={timeHistory}
            height={250}
          />
        </Grid>
      </Grid>
      
      {/* 学习路径列表 */}
      {stats.pathsStarted && stats.pathsStarted.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            学习中的路径
          </Typography>
          <Paper>
            <List>
              {stats.pathsStarted.map((path: any, index: number) => (
                <Box key={path.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    component={Link}
                    href={`/learning-paths/${path.id}`}
                    sx={{ 
                      textDecoration: 'none', 
                      color: 'inherit',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      <SchoolIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={path.title}
                      secondary={`点击查看详细进度`}
                    />
                    <Chip 
                      label="查看详情" 
                      color="primary" 
                      variant="outlined" 
                      size="small" 
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
