'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
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
  Delete as DeleteIcon,
  Edit as EditIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { learningPathsApi } from '@/lib/api';

import LearningPathCard from '@/components/LearningPathCard';

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
  goal?: string;
  level: string;
  chapters: number;
  created_at?: string;
  progress?: number;
  users?: number;
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
        if (user) {
          const userPathsResponse = await learningPathsApi.getUserPaths(user.id);
          setUserPaths(userPathsResponse.paths || []);
        } else {
          console.log('用户未登录或用户信息未加载完成');
          setUserPaths([]);
        }

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
  }, [user]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
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
      <Box sx={{ bgcolor: '#F8F9FA', minHeight: '100vh' }}>
        <Navbar />

        <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 500, color: '#202124' }}>
                学习路径
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                探索和管理您的学习旅程
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePath}
              disableElevation
              sx={{
                borderRadius: 8,
                px: 3,
                py: 1,
                bgcolor: '#4285F4',
                '&:hover': { bgcolor: '#3367D6' }
              }}
            >
              创建新路径
            </Button>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)'
            }}
          >
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="learning paths tabs"
                sx={{
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.95rem',
                    py: 2,
                    px: 3
                  },
                  '& .Mui-selected': {
                    color: '#4285F4',
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#4285F4',
                    height: 3
                  }
                }}
              >
                <Tab label="我的学习路径" />
                <Tab label="热门学习路径" />
              </Tabs>
            </Box>

            <Box sx={{ p: 3, bgcolor: 'white' }}>
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
                      <SearchIcon sx={{ color: '#5F6368' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '& fieldset': {
                      borderColor: '#DADCE0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#DADCE0',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#4285F4',
                    },
                  }
                }}
              />
            </Box>

            {isLoading ? (
              <Box sx={{ p: 5, textAlign: 'center' }}>
                <CircularProgress size={40} sx={{ color: '#4285F4' }} />
                <Typography variant="body1" sx={{ mt: 2, color: '#5F6368' }}>
                  正在加载学习路径...
                </Typography>
              </Box>
            ) : (
              <>
                <TabPanel value={tabValue} index={0}>
                  {filteredUserPaths.length > 0 ? (
                    <Grid container spacing={3}>
                      {filteredUserPaths.map((path) => (
                        <Grid item key={path.id} xs={12} sm={6} md={4}>
                          <LearningPathCard
                            path={path}
                            onMenuOpen={handleMenuOpen}
                            color="#4285F4"
                          />
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box
                      sx={{
                        p: 5,
                        textAlign: 'center',
                        bgcolor: '#F8F9FA',
                        borderRadius: 2,
                        my: 2
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 60, color: '#DADCE0', mb: 2 }} />
                      <Typography variant="h6" color="#202124" paragraph>
                        您还没有创建任何学习路径
                      </Typography>
                      <Typography variant="body1" color="#5F6368" paragraph sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                        创建您的第一个学习路径，开始您的学习之旅。我们将帮助您组织和跟踪您的学习进度。
                      </Typography>
                      <Button
                        variant="contained"
                        disableElevation
                        startIcon={<AddIcon />}
                        onClick={handleCreatePath}
                        sx={{
                          borderRadius: 8,
                          px: 3,
                          py: 1,
                          bgcolor: '#4285F4',
                          '&:hover': { bgcolor: '#3367D6' },
                          textTransform: 'none',
                          fontWeight: 500
                        }}
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
                        <LearningPathCard
                          path={path}
                          onMenuOpen={handleMenuOpen}
                          variant="featured"
                          color="#FBBC04"
                        />
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
          PaperProps={{
            elevation: 3,
            sx: {
              borderRadius: 2,
              mt: 1
            }
          }}
        >
          <MenuItem onClick={handleEditClick} sx={{ py: 1.5, px: 2 }}>
            <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#5F6368' }} />
            <Typography sx={{ fontWeight: 500 }}>编辑</Typography>
          </MenuItem>
          <MenuItem onClick={handleDeleteClick} sx={{ py: 1.5, px: 2 }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: '#5F6368' }} />
            <Typography sx={{ fontWeight: 500 }}>删除</Typography>
          </MenuItem>
        </Menu>

        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 500, pb: 1 }}>确认删除</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: '#5F6368' }}>
              您确定要删除这个学习路径吗？此操作无法撤销。
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={handleDeleteCancel}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 6
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disableElevation
              autoFocus
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 6,
                bgcolor: '#EA4335',
                '&:hover': { bgcolor: '#D93025' }
              }}
            >
              删除
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
