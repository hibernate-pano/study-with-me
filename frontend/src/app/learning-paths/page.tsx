'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { learningPathsApi, progressApi } from '@/lib/api';
import Link from 'next/link';

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
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  goal: string;
  level: string;
  chapters: number;
  created_at: string;
  progress?: number;
}

export default function LearningPathsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userPaths, setUserPaths] = useState<LearningPath[]>([]);
  const [popularPaths, setPopularPaths] = useState<LearningPath[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchPaths = async () => {
      setIsLoading(true);
      try {
        // 获取用户的学习路径
        const userPathsResponse = await learningPathsApi.getUserPaths();
        setUserPaths(userPathsResponse.paths || []);
        
        // 获取热门学习路径
        const popularPathsResponse = await learningPathsApi.getPopularPaths(6);
        setPopularPaths(popularPathsResponse.paths || []);
      } catch (error) {
        console.error('获取学习路径失败:', error);
        // 如果API调用失败，使用模拟数据
        setUserPaths(mockUserPaths);
        setPopularPaths(mockPopularPaths);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPaths();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, pathId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedPathId(pathId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPathId(null);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedPathId) {
      try {
        await learningPathsApi.deletePath(selectedPathId);
        // 删除成功后，更新学习路径列表
        setUserPaths(userPaths.filter(path => path.id !== selectedPathId));
      } catch (error) {
        console.error('删除学习路径失败:', error);
      }
    }
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleEditClick = () => {
    handleMenuClose();
    if (selectedPathId) {
      router.push(`/learning-paths/${selectedPathId}/edit`);
    }
  };

  const handleCreatePath = () => {
    router.push('/');
  };

  const filteredUserPaths = userPaths.filter(path => 
    path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPopularPaths = popularPaths.filter(path => 
    path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 模拟数据
  const mockUserPaths: LearningPath[] = [
    {
      id: '1',
      title: 'React前端开发',
      description: '从零开始学习React，掌握现代前端开发技能',
      goal: '学习React前端开发',
      level: '初级到中级',
      chapters: 12,
      created_at: '2023-05-15T10:30:00Z',
      progress: 45
    },
    {
      id: '2',
      title: 'Python数据分析',
      description: '学习Python数据分析，掌握数据处理和可视化技能',
      goal: '学习Python数据分析',
      level: '初级到高级',
      chapters: 15,
      created_at: '2023-06-20T14:15:00Z',
      progress: 30
    }
  ];

  const mockPopularPaths: LearningPath[] = [
    {
      id: '3',
      title: '机器学习基础',
      description: '了解机器学习的核心概念和常用算法',
      goal: '学习机器学习基础',
      level: '中级',
      chapters: 10,
      created_at: '2023-04-10T09:45:00Z'
    },
    {
      id: '4',
      title: 'Web开发入门',
      description: '学习HTML、CSS和JavaScript基础知识',
      goal: '学习Web开发入门',
      level: '初级',
      chapters: 8,
      created_at: '2023-03-05T11:20:00Z'
    },
    {
      id: '5',
      title: 'Node.js后端开发',
      description: '使用Node.js构建高性能后端应用',
      goal: '学习Node.js后端开发',
      level: '中级到高级',
      chapters: 14,
      created_at: '2023-07-12T16:30:00Z'
    }
  ];

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />
        
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              学习路径
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePath}
            >
              创建新路径
            </Button>
          </Box>
          
          <Paper sx={{ mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="learning paths tabs">
                <Tab label="我的学习路径" />
                <Tab label="热门学习路径" />
              </Tabs>
            </Box>
            
            <Box sx={{ p: 3 }}>
              <TextField
                fullWidth
                placeholder="搜索学习路径..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
            </Box>
            
            {isLoading ? (
              <Box sx={{ p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TabPanel value={tabValue} index={0}>
                  {filteredUserPaths.length > 0 ? (
                    <Grid container spacing={3}>
                      {filteredUserPaths.map((path) => (
                        <Grid item key={path.id} xs={12} sm={6} md={4}>
                          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Typography gutterBottom variant="h6" component="h2">
                                  {path.title}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMenuOpen(e, path.id)}
                                >
                                  <MoreVertIcon />
                                </IconButton>
                              </Box>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                {path.description}
                              </Typography>
                              <Divider sx={{ my: 1 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  难度: {path.level}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  章节: {path.chapters}
                                </Typography>
                              </Box>
                              {path.progress !== undefined && (
                                <Box sx={{ mt: 2 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2">学习进度</Typography>
                                    <Typography variant="body2">{path.progress}%</Typography>
                                  </Box>
                                  <LinearProgress variant="determinate" value={path.progress} />
                                </Box>
                              )}
                            </CardContent>
                            <CardActions>
                              <Button 
                                size="small" 
                                color="primary"
                                component={Link}
                                href={`/learning-paths/${path.id}/chapters/1`}
                              >
                                {path.progress ? '继续学习' : '开始学习'}
                              </Button>
                              <Button 
                                size="small" 
                                color="primary"
                                component={Link}
                                href={`/learning-paths/${path.id}`}
                              >
                                查看详情
                              </Button>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary" paragraph>
                        您还没有创建任何学习路径
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleCreatePath}
                      >
                        创建新路径
                      </Button>
                    </Box>
                  )}
                </TabPanel>
                
                <TabPanel value={tabValue} index={1}>
                  <Grid container spacing={3}>
                    {filteredPopularPaths.map((path) => (
                      <Grid item key={path.id} xs={12} sm={6} md={4}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Typography gutterBottom variant="h6" component="h2">
                              {path.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              {path.description}
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                难度: {path.level}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                章节: {path.chapters}
                              </Typography>
                            </Box>
                          </CardContent>
                          <CardActions>
                            <Button 
                              size="small" 
                              color="primary"
                              component={Link}
                              href={`/learning-paths/${path.id}/chapters/1`}
                            >
                              开始学习
                            </Button>
                            <Button 
                              size="small" 
                              color="primary"
                              component={Link}
                              href={`/learning-paths/${path.id}`}
                            >
                              查看详情
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </TabPanel>
              </>
            )}
          </Paper>
        </Container>
        
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEditClick}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            编辑
          </MenuItem>
          <MenuItem onClick={handleDeleteClick}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            删除
          </MenuItem>
        </Menu>
        
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
        >
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              您确定要删除这个学习路径吗？此操作无法撤销。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel}>取消</Button>
            <Button onClick={handleDeleteConfirm} color="error" autoFocus>
              删除
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
