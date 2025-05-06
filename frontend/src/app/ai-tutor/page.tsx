'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  CircularProgress,
  TextField,
  Autocomplete,
  Alert,
  IconButton
} from '@mui/material';
import {
  School as SchoolIcon,
  QuestionAnswer as QuestionAnswerIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { learningPathsApi } from '@/lib/api';
import AITutor from '@/components/AITutor';
import ChatHistoryDialog from '@/components/ChatHistoryDialog';

interface LearningPath {
  id: string;
  title: string;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  title: string;
}

export default function AITutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // 从URL参数中获取初始选择的路径和章节
  useEffect(() => {
    const pathId = searchParams.get('pathId');
    const chapterId = searchParams.get('chapterId');

    if (pathId) {
      // 如果URL中有pathId参数，则设置为初始选择的路径
      const fetchInitialPath = async () => {
        try {
          const response = await learningPathsApi.getById(pathId);
          if (response.path) {
            setSelectedPath(response.path);

            // 获取章节列表
            const chaptersResponse = await learningPathsApi.getChapters(pathId);
            if (chaptersResponse.chapters) {
              // 更新学习路径的章节列表
              const updatedPath = {
                ...response.path,
                chapters: chaptersResponse.chapters
              };
              setSelectedPath(updatedPath);

              // 如果URL中有chapterId参数，则设置为初始选择的章节
              if (chapterId) {
                const chapter = chaptersResponse.chapters.find((ch: any) => ch.id === chapterId);
                if (chapter) {
                  setSelectedChapter(chapter);
                }
              }
            }
          }
        } catch (error) {
          console.error('获取初始学习路径失败:', error);
          setError('获取学习路径失败，请稍后再试');
        }
      };

      fetchInitialPath();
    }
  }, [searchParams]);

  // 获取用户的学习路径
  useEffect(() => {
    const fetchLearningPaths = async () => {
      if (!isAuthenticated || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const response = await learningPathsApi.getUserPaths();

        if (response.paths) {
          // 获取每个学习路径的章节列表
          const pathsWithChapters = await Promise.all(
            response.paths.map(async (path: any) => {
              try {
                const chaptersResponse = await learningPathsApi.getChapters(path.id);
                return {
                  ...path,
                  chapters: chaptersResponse.chapters || []
                };
              } catch (error) {
                console.error(`获取学习路径 ${path.id} 的章节列表失败:`, error);
                return {
                  ...path,
                  chapters: []
                };
              }
            })
          );

          setLearningPaths(pathsWithChapters);
        } else {
          setLearningPaths([]);
        }
      } catch (error) {
        console.error('获取学习路径失败:', error);
        setError('获取学习路径失败，请稍后再试');
        setLearningPaths([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLearningPaths();
  }, [isAuthenticated, user]);

  const handlePathChange = (event: any, newValue: LearningPath | null) => {
    setSelectedPath(newValue);
    setSelectedChapter(null);
  };

  const handleChapterChange = (event: any, newValue: Chapter | null) => {
    setSelectedChapter(newValue);

    // 更新URL参数
    if (selectedPath && newValue) {
      const url = `/ai-tutor?pathId=${selectedPath.id}&chapterId=${newValue.id}`;
      window.history.pushState({}, '', url);
    }
  };

  const handleGoToChapter = () => {
    if (selectedPath && selectedChapter) {
      router.push(`/learning-paths/${selectedPath.id}/chapters/${selectedChapter.id}`);
    }
  };

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />

        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">
              AI辅导中心
            </Typography>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setHistoryDialogOpen(true)}
            >
              聊天历史
            </Button>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  选择学习内容
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <Autocomplete
                      options={learningPaths}
                      getOptionLabel={(option) => option.title}
                      value={selectedPath}
                      onChange={handlePathChange}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="选择学习路径"
                          variant="outlined"
                          fullWidth
                          margin="normal"
                        />
                      )}
                    />

                    <Autocomplete
                      options={selectedPath?.chapters || []}
                      getOptionLabel={(option) => option.title}
                      value={selectedChapter}
                      onChange={handleChapterChange}
                      disabled={!selectedPath}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="选择章节"
                          variant="outlined"
                          fullWidth
                          margin="normal"
                        />
                      )}
                    />

                    <Button
                      variant="outlined"
                      fullWidth
                      sx={{ mt: 2 }}
                      disabled={!selectedPath || !selectedChapter}
                      onClick={handleGoToChapter}
                      startIcon={<SchoolIcon />}
                    >
                      前往学习章节
                    </Button>
                  </>
                )}

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  AI辅导功能
                </Typography>

                <Typography variant="body2" color="text.secondary" paragraph>
                  AI辅导助手可以帮助您:
                </Typography>

                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    解答您对学习内容的疑问
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    提供更深入的知识解释
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    给出实际应用的例子
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    帮助您理解复杂概念
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
                {selectedPath && selectedChapter ? (
                  <AITutor
                    pathId={selectedPath.id}
                    chapterId={selectedChapter.id}
                    chapterTitle={selectedChapter.title}
                  />
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <QuestionAnswerIcon sx={{ fontSize: 80, color: 'primary.light', mb: 2 }} />
                    <Typography variant="h5" gutterBottom align="center">
                      请选择学习路径和章节
                    </Typography>
                    <Typography variant="body1" color="text.secondary" align="center">
                      选择左侧的学习路径和章节，开始AI辅导对话
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* 聊天历史对话框 */}
      {user && (
        <ChatHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          userId={user.id}
        />
      )}
    </ProtectedRoute>
  );
}
