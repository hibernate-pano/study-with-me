'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  School as SchoolIcon,
  Explore as ExploreIcon,
  Timer as TimerIcon,
  Assignment as AssignmentIcon,
  CalendarMonth as CalendarIcon,
  EmojiEvents as EmojiEventsIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { achievementsApi } from '@/lib/api';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  earned_at?: string;
}

interface AchievementsListProps {
  userId?: string;
  showLockedAchievements?: boolean;
}

/**
 * 成就列表组件
 */
export default function AchievementsList({
  userId,
  showLockedAchievements = true
}: AchievementsListProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const { width, height } = useWindowSize();

  // 获取成就数据
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!user && !userId) return;
      
      const targetUserId = userId || user?.id;
      if (!targetUserId) return;

      setIsLoading(true);
      setError('');
      
      try {
        // 获取所有成就
        const allResponse = await achievementsApi.getAll();
        setAllAchievements(allResponse.achievements);
        
        // 获取用户已获得的成就
        const userResponse = await achievementsApi.getUserAchievements(targetUserId);
        setUserAchievements(userResponse.achievements.map((a: any) => ({
          ...a.achievement,
          earned_at: a.earned_at
        })));
      } catch (error: any) {
        console.error('获取成就失败:', error);
        setError('获取成就失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAchievements();
  }, [user, userId]);

  // 检查新成就
  const checkNewAchievements = async () => {
    if (!user && !userId) return;
    
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;
    
    try {
      const response = await achievementsApi.checkAchievements(targetUserId);
      
      if (response.newAchievements && response.newAchievements.length > 0) {
        const newAchievementsData = response.newAchievements.map((a: any) => ({
          ...a.achievement,
          earned_at: a.earned_at
        }));
        
        setNewAchievements(newAchievementsData);
        setUserAchievements(prev => [...prev, ...newAchievementsData]);
        setShowConfetti(true);
        
        // 显示第一个新成就
        setSelectedAchievement(newAchievementsData[0]);
        
        // 5秒后关闭庆祝效果
        setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
      }
    } catch (error) {
      console.error('检查成就失败:', error);
    }
  };

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'school':
        return <SchoolIcon />;
      case 'explore':
        return <ExploreIcon />;
      case 'timer':
        return <TimerIcon />;
      case 'assignment':
        return <AssignmentIcon />;
      case 'calendar':
        return <CalendarIcon />;
      default:
        return <EmojiEventsIcon />;
    }
  };

  // 获取成就类型名称
  const getAchievementTypeName = (type: string) => {
    switch (type) {
      case 'chapter_completion':
        return '章节完成';
      case 'path_completion':
        return '学习路径';
      case 'learning_time':
        return '学习时间';
      case 'exercise_completion':
        return '练习完成';
      case 'streak':
        return '连续学习';
      default:
        return '其他';
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 关闭成就详情对话框
  const handleCloseDialog = () => {
    setSelectedAchievement(null);
  };

  // 显示下一个新成就
  const handleNextAchievement = () => {
    if (!selectedAchievement || newAchievements.length <= 1) {
      setSelectedAchievement(null);
      return;
    }
    
    const currentIndex = newAchievements.findIndex(a => a.id === selectedAchievement.id);
    if (currentIndex < newAchievements.length - 1) {
      setSelectedAchievement(newAchievements[currentIndex + 1]);
    } else {
      setSelectedAchievement(null);
    }
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

  // 准备显示的成就列表
  const achievementsToShow = showLockedAchievements
    ? allAchievements.map(achievement => {
        const earned = userAchievements.find(ua => ua.id === achievement.id);
        return earned ? { ...achievement, earned_at: earned.earned_at } : achievement;
      })
    : userAchievements;

  return (
    <Box sx={{ py: 2 }}>
      {showConfetti && <Confetti width={width} height={height} recycle={false} />}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          我的成就 ({userAchievements.length}/{allAchievements.length})
        </Typography>
        <Button 
          variant="contained" 
          onClick={checkNewAchievements}
        >
          检查新成就
        </Button>
      </Box>
      
      <Grid container spacing={2}>
        {achievementsToShow.map((achievement) => {
          const isEarned = userAchievements.some(ua => ua.id === achievement.id);
          const isNew = newAchievements.some(na => na.id === achievement.id);
          
          return (
            <Grid item xs={12} sm={6} md={4} key={achievement.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  opacity: isEarned ? 1 : 0.7,
                  transform: isNew ? 'scale(1.03)' : 'scale(1)',
                  transition: 'all 0.3s ease',
                  boxShadow: isNew ? '0 0 15px rgba(66, 133, 244, 0.7)' : undefined,
                  '&:hover': {
                    transform: 'scale(1.03)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }
                }}
                onClick={() => setSelectedAchievement(achievement)}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: isEarned ? 'primary.main' : 'grey.300',
                        color: isEarned ? 'white' : 'grey.700',
                        mr: 2
                      }}
                    >
                      {isEarned ? getIconComponent(achievement.icon) : <LockIcon />}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="div">
                        {achievement.title}
                      </Typography>
                      <Chip
                        label={getAchievementTypeName(achievement.type)}
                        size="small"
                        color={isEarned ? 'primary' : 'default'}
                        variant={isEarned ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {achievement.description}
                  </Typography>
                  
                  {isEarned && achievement.earned_at && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, alignSelf: 'flex-end' }}>
                      获得于: {formatDate(achievement.earned_at)}
                    </Typography>
                  )}
                  
                  {isNew && (
                    <Chip
                      label="新获得!"
                      color="secondary"
                      size="small"
                      sx={{ alignSelf: 'flex-start', mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      {/* 成就详情对话框 */}
      <Dialog open={!!selectedAchievement} onClose={handleCloseDialog}>
        {selectedAchievement && (
          <>
            <DialogTitle>
              {selectedAchievement.title}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    width: 60,
                    height: 60,
                    mr: 2
                  }}
                >
                  {getIconComponent(selectedAchievement.icon)}
                </Avatar>
                <Box>
                  <Typography variant="body1" paragraph>
                    {selectedAchievement.description}
                  </Typography>
                  <Chip
                    label={getAchievementTypeName(selectedAchievement.type)}
                    color="primary"
                  />
                </Box>
              </Box>
              
              {selectedAchievement.earned_at && (
                <Typography variant="body2" color="text.secondary">
                  获得于: {formatDate(selectedAchievement.earned_at)}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              {newAchievements.length > 1 && (
                <Button onClick={handleNextAchievement}>
                  下一个成就
                </Button>
              )}
              <Button onClick={handleCloseDialog} autoFocus>
                关闭
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
