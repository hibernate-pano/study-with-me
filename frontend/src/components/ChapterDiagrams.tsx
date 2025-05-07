'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Button,
  Fade,
  Zoom,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ViewCarousel as ViewCarouselIcon,
  ViewModule as ViewModuleIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { diagramsApi } from '@/lib/api';
import MermaidDiagram from './MermaidDiagram';

interface ChapterDiagramsProps {
  chapterId: string;
}

/**
 * 增强版章节图表组件
 * 用于显示章节的所有图表，支持多种查看模式
 */
export default function ChapterDiagrams({ chapterId }: ChapterDiagramsProps) {
  const theme = useTheme();
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs');
  const [showInfo, setShowInfo] = useState<boolean>(false);

  // 获取图表类型的友好名称
  const getDiagramTypeName = (type?: string) => {
    switch (type) {
      case 'concept': return '思维导图';
      case 'process': return '流程图';
      case 'comparison': return '比较图';
      case 'sequence': return '时序图';
      case 'class': return '类图';
      case 'pie': return '饼图';
      default: return '图表';
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, [chapterId]);

  const fetchDiagrams = async () => {
    if (!chapterId) return;

    setIsLoading(true);
    setError('');

    try {
      // 获取章节的所有图表
      const response = await diagramsApi.getChapterDiagrams(chapterId);
      setDiagrams(response.diagrams || []);
    } catch (error: any) {
      console.error('获取图表失败:', error);
      setError('获取图表失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理标签切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // 切换视图模式
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'tabs' ? 'grid' : 'tabs');
  };

  // 刷新图表
  const handleRefresh = () => {
    fetchDiagrams();
  };

  // 切换信息显示
  const toggleInfo = () => {
    setShowInfo(!showInfo);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          正在加载图表...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, bgcolor: 'error.light' }}>
        <Typography color="error.dark" gutterBottom>
          {error}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          sx={{ mt: 1 }}
        >
          重试
        </Button>
      </Paper>
    );
  }

  if (diagrams.length === 0) {
    return (
      <Fade in={true}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            暂无图表内容
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            系统将在生成内容时自动创建相关图表
          </Typography>
        </Paper>
      </Fade>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">
            图表与可视化
          </Typography>
          <Chip
            label={`${diagrams.length} 个图表`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        </Box>

        <Box>
          <Tooltip title="图表信息">
            <IconButton size="small" onClick={toggleInfo} color={showInfo ? 'primary' : 'default'}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={viewMode === 'tabs' ? "切换到网格视图" : "切换到标签视图"}>
            <IconButton size="small" onClick={toggleViewMode}>
              {viewMode === 'tabs' ? <ViewModuleIcon fontSize="small" /> : <ViewCarouselIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="刷新图表">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {showInfo && (
        <Fade in={showInfo}>
          <Paper sx={{ p: 2, mb: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              图表是理解复杂概念的有力工具。本章节包含 {diagrams.length} 个图表，涵盖了
              {Array.from(new Set(diagrams.map(d => d.diagram_type))).map(type => getDiagramTypeName(type as string)).join('、')}
              等类型。您可以放大、缩小、下载或全屏查看这些图表，也可以查看图表的Mermaid代码。
            </Typography>
          </Paper>
        </Fade>
      )}

      <Divider sx={{ mb: 2 }} />

      {viewMode === 'tabs' && diagrams.length > 0 ? (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              indicatorColor="primary"
            >
              {diagrams.map((diagram, index) => (
                <Tab
                  key={diagram.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <span>{diagram.title}</span>
                      {diagram.diagram_type && (
                        <Chip
                          label={getDiagramTypeName(diagram.diagram_type)}
                          size="small"
                          sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                  }
                  id={`diagram-tab-${index}`}
                  aria-controls={`diagram-tabpanel-${index}`}
                />
              ))}
            </Tabs>
          </Box>

          {diagrams.map((diagram, index) => (
            <Box
              key={diagram.id}
              role="tabpanel"
              hidden={activeTab !== index}
              id={`diagram-tabpanel-${index}`}
              aria-labelledby={`diagram-tab-${index}`}
            >
              {activeTab === index && (
                <Fade in={activeTab === index} timeout={500}>
                  <Box>
                    <MermaidDiagram
                      code={diagram.mermaid_code}
                      title={diagram.title}
                      description={diagram.description}
                      height={450}
                      diagramType={diagram.diagram_type}
                    />
                  </Box>
                </Fade>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        // 网格视图
        <Grid container spacing={3}>
          {diagrams.map((diagram, index) => (
            <Grid item xs={12} md={6} key={diagram.id}>
              <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-4px)'
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      setViewMode('tabs');
                      setActiveTab(index);
                    }}
                    sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <CardContent sx={{ p: 2, pb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" component="h3" noWrap>
                          {diagram.title}
                        </Typography>
                        {diagram.diagram_type && (
                          <Chip
                            label={getDiagramTypeName(diagram.diagram_type)}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </CardContent>
                    <Box sx={{ p: 2, pt: 0, flexGrow: 1, height: 200, overflow: 'hidden' }}>
                      <Box
                        dangerouslySetInnerHTML={{ __html: diagram.diagram_url ? `<img src="${diagram.diagram_url}" alt="${diagram.title}" style="max-width:100%; max-height:180px; object-fit:contain;" />` : '' }}
                        sx={{
                          height: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                          borderRadius: 1
                        }}
                      />
                    </Box>
                  </CardActionArea>
                </Card>
              </Zoom>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
