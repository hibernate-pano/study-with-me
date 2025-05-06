'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Chip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Alert
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  CheckCircle as CompletionIcon,
  LocalFireDepartment as StreakIcon,
  EmojiEvents as TrophyIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { leaderboardApi } from '@/lib/api';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

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
      id={`leaderboard-tabpanel-${index}`}
      aria-labelledby={`leaderboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'all'>('week');
  const [timeLeaderboard, setTimeLeaderboard] = useState<any[]>([]);
  const [completionLeaderboard, setCompletionLeaderboard] = useState<any[]>([]);
  const [streakLeaderboard, setStreakLeaderboard] = useState<any[]>([]);
  const [userRanking, setUserRanking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 处理标签页切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    fetchUserRanking(newValue);
  };

  // 处理时间段切换
  const handlePeriodChange = (
    event: React.MouseEvent<HTMLElement>,
    newPeriod: 'week' | 'month' | 'all',
  ) => {
    if (newPeriod !== null) {
      setTimePeriod(newPeriod);
    }
  };

  // 获取排行榜数据
  useEffect(() => {
    const fetchLeaderboards = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        // 获取学习时间排行榜
        const timeResponse = await leaderboardApi.getTimeLeaderboard(20, timePeriod);
        setTimeLeaderboard(timeResponse.leaderboard);
        
        // 获取完成章节数排行榜
        const completionResponse = await leaderboardApi.getCompletionLeaderboard(20);
        setCompletionLeaderboard(completionResponse.leaderboard);
        
        // 获取连续学习天数排行榜
        const streakResponse = await leaderboardApi.getStreakLeaderboard(20);
        setStreakLeaderboard(streakResponse.leaderboard);
        
        // 获取用户排名
        if (user) {
          fetchUserRanking(tabValue);
        }
      } catch (error: any) {
        console.error('获取排行榜数据失败:', error);
        setError('获取排行榜数据失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLeaderboards();
  }, [user, timePeriod]);

  // 获取用户排名
  const fetchUserRanking = async (tabIndex: number) => {
    if (!user) return;
    
    try {
      let type: 'time' | 'completion' | 'streak' = 'time';
      
      switch (tabIndex) {
        case 0:
          type = 'time';
          break;
        case 1:
          type = 'completion';
          break;
        case 2:
          type = 'streak';
          break;
      }
      
      const response = await leaderboardApi.getUserRanking(
        user.id, 
        type, 
        type === 'time' ? timePeriod : 'all'
      );
      
      setUserRanking(response.ranking);
    } catch (error) {
      console.error('获取用户排名失败:', error);
    }
  };

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

  // 获取时间段显示文本
  const getPeriodText = () => {
    switch (timePeriod) {
      case 'week':
        return '本周';
      case 'month':
        return '本月';
      case 'all':
        return '全部时间';
      default:
        return '';
    }
  };

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />
        
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            学习排行榜
          </Typography>
          
          <Paper sx={{ mt: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="leaderboard tabs"
                variant="fullWidth"
              >
                <Tab icon={<TimeIcon />} label="学习时间" />
                <Tab icon={<CompletionIcon />} label="完成章节" />
                <Tab icon={<StreakIcon />} label="连续学习" />
              </Tabs>
            </Box>
            
            {/* 学习时间排行榜 */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {getPeriodText()}学习时间排行
                </Typography>
                <ToggleButtonGroup
                  value={timePeriod}
                  exclusive
                  onChange={handlePeriodChange}
                  size="small"
                >
                  <ToggleButton value="week">
                    本周
                  </ToggleButton>
                  <ToggleButton value="month">
                    本月
                  </ToggleButton>
                  <ToggleButton value="all">
                    全部
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ my: 2 }}>
                  {error}
                </Alert>
              ) : (
                <>
                  {/* 用户排名 */}
                  {user && userRanking && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight="bold">
                          你的排名: 第 {userRanking.ranking} 名
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="body2">
                          总学习时间: {formatLearningTime(userRanking.stats?.total_time || 0)}
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                  
                  {/* 排行榜列表 */}
                  <List>
                    {timeLeaderboard.map((item, index) => (
                      <Box key={item.user_id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{
                            bgcolor: user && item.user_id === user.id ? 'action.selected' : 'inherit',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Box sx={{ mr: 2, minWidth: 40, textAlign: 'center' }}>
                            {index < 3 ? (
                              <TrophyIcon 
                                sx={{ 
                                  fontSize: 32, 
                                  color: index === 0 ? 'gold' : index === 1 ? 'silver' : '#CD7F32' 
                                }} 
                              />
                            ) : (
                              <Typography variant="h6" color="text.secondary">
                                {index + 1}
                              </Typography>
                            )}
                          </Box>
                          <ListItemAvatar>
                            <Avatar src={item.users?.avatar_url}>
                              {item.users?.display_name?.charAt(0) || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={item.users?.display_name || '用户'}
                            secondary={`学习时间: ${formatLearningTime(item.total_time)}`}
                          />
                          {user && item.user_id === user.id && (
                            <Chip label="你" color="primary" size="small" />
                          )}
                        </ListItem>
                      </Box>
                    ))}
                    
                    {timeLeaderboard.length === 0 && (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          暂无排行数据
                        </Typography>
                      </Box>
                    )}
                  </List>
                </>
              )}
            </TabPanel>
            
            {/* 完成章节排行榜 */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" gutterBottom>
                完成章节排行
              </Typography>
              
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ my: 2 }}>
                  {error}
                </Alert>
              ) : (
                <>
                  {/* 用户排名 */}
                  {user && userRanking && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight="bold">
                          你的排名: 第 {userRanking.ranking} 名
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="body2">
                          完成章节: {userRanking.stats?.completed_count || 0} 章
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                  
                  {/* 排行榜列表 */}
                  <List>
                    {completionLeaderboard.map((item, index) => (
                      <Box key={item.user_id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{
                            bgcolor: user && item.user_id === user.id ? 'action.selected' : 'inherit',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Box sx={{ mr: 2, minWidth: 40, textAlign: 'center' }}>
                            {index < 3 ? (
                              <TrophyIcon 
                                sx={{ 
                                  fontSize: 32, 
                                  color: index === 0 ? 'gold' : index === 1 ? 'silver' : '#CD7F32' 
                                }} 
                              />
                            ) : (
                              <Typography variant="h6" color="text.secondary">
                                {index + 1}
                              </Typography>
                            )}
                          </Box>
                          <ListItemAvatar>
                            <Avatar src={item.users?.avatar_url}>
                              {item.users?.display_name?.charAt(0) || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={item.users?.display_name || '用户'}
                            secondary={`完成章节: ${item.completed_count} 章`}
                          />
                          {user && item.user_id === user.id && (
                            <Chip label="你" color="primary" size="small" />
                          )}
                        </ListItem>
                      </Box>
                    ))}
                    
                    {completionLeaderboard.length === 0 && (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          暂无排行数据
                        </Typography>
                      </Box>
                    )}
                  </List>
                </>
              )}
            </TabPanel>
            
            {/* 连续学习排行榜 */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" gutterBottom>
                连续学习排行
              </Typography>
              
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ my: 2 }}>
                  {error}
                </Alert>
              ) : (
                <>
                  {/* 用户排名 */}
                  {user && userRanking && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight="bold">
                          你的排名: 第 {userRanking.ranking} 名
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="body2">
                          当前连续: {userRanking.stats?.current_streak || 0} 天 | 
                          最长连续: {userRanking.stats?.longest_streak || 0} 天
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                  
                  {/* 排行榜列表 */}
                  <List>
                    {streakLeaderboard.map((item, index) => (
                      <Box key={item.user_id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{
                            bgcolor: user && item.user_id === user.id ? 'action.selected' : 'inherit',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Box sx={{ mr: 2, minWidth: 40, textAlign: 'center' }}>
                            {index < 3 ? (
                              <TrophyIcon 
                                sx={{ 
                                  fontSize: 32, 
                                  color: index === 0 ? 'gold' : index === 1 ? 'silver' : '#CD7F32' 
                                }} 
                              />
                            ) : (
                              <Typography variant="h6" color="text.secondary">
                                {index + 1}
                              </Typography>
                            )}
                          </Box>
                          <ListItemAvatar>
                            <Avatar src={item.users?.avatar_url}>
                              {item.users?.display_name?.charAt(0) || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={item.users?.display_name || '用户'}
                            secondary={`当前连续: ${item.current_streak} 天 | 最长连续: ${item.longest_streak} 天`}
                          />
                          {user && item.user_id === user.id && (
                            <Chip label="你" color="primary" size="small" />
                          )}
                        </ListItem>
                      </Box>
                    ))}
                    
                    {streakLeaderboard.length === 0 && (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          暂无排行数据
                        </Typography>
                      </Box>
                    )}
                  </List>
                </>
              )}
            </TabPanel>
          </Paper>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
