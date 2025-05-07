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
  Divider
} from '@mui/material';
import { diagramsApi } from '@/lib/api';
import MermaidDiagram from './MermaidDiagram';

interface ChapterDiagramsProps {
  chapterId: string;
}

/**
 * 章节图表组件
 * 用于显示章节的所有图表
 */
export default function ChapterDiagrams({ chapterId }: ChapterDiagramsProps) {
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0);

  useEffect(() => {
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
    
    fetchDiagrams();
  }, [chapterId]);

  // 处理标签切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
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
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">
          {error}
        </Typography>
      </Paper>
    );
  }

  if (diagrams.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          暂无图表内容
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        图表与可视化
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {diagrams.length > 1 ? (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              {diagrams.map((diagram, index) => (
                <Tab 
                  key={diagram.id} 
                  label={diagram.title} 
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
                <MermaidDiagram
                  code={diagram.mermaid_code}
                  title={diagram.title}
                  height={400}
                />
              )}
            </Box>
          ))}
        </Box>
      ) : (
        // 只有一个图表时直接显示
        <MermaidDiagram
          code={diagrams[0].mermaid_code}
          title={diagrams[0].title}
          height={400}
        />
      )}
    </Box>
  );
}
