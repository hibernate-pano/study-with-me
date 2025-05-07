'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  title?: string;
  height?: number | string;
  width?: number | string;
  isLoading?: boolean;
  error?: string;
  showCode?: boolean;
}

/**
 * Mermaid图表组件
 * 用于渲染Mermaid语法的图表
 */
export default function MermaidDiagram({
  code,
  title,
  height = 300,
  width = '100%',
  isLoading = false,
  error = '',
  showCode = false
}: MermaidDiagramProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [isCodeVisible, setIsCodeVisible] = useState<boolean>(showCode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初始化Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'sans-serif'
    });
  }, []);

  useEffect(() => {
    if (!code || isLoading) return;

    const renderDiagram = async () => {
      try {
        setRenderError('');
        
        // 使用Mermaid渲染图表
        const { svg } = await mermaid.render('mermaid-diagram-' + Math.random(), code);
        setSvgContent(svg);
      } catch (error: any) {
        console.error('Mermaid渲染错误:', error);
        setRenderError('图表渲染失败: ' + (error.message || '未知错误'));
      }
    };

    renderDiagram();
  }, [code, isLoading]);

  // 切换代码显示
  const toggleCodeVisibility = () => {
    setIsCodeVisible(!isCodeVisible);
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error || renderError) {
    return (
      <Paper sx={{ p: 3, height, width, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography color="error" gutterBottom>
          {error || renderError}
        </Typography>
        {code && (
          <Button 
            variant="outlined" 
            color="primary" 
            size="small"
            onClick={toggleCodeVisibility}
            sx={{ mt: 2 }}
          >
            {isCodeVisible ? '隐藏代码' : '显示代码'}
          </Button>
        )}
        {isCodeVisible && (
          <Box 
            component="pre" 
            sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 1, 
              overflow: 'auto',
              width: '100%',
              maxHeight: 200,
              fontSize: '0.8rem'
            }}
          >
            <code>{code}</code>
          </Box>
        )}
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: 'auto', width, overflow: 'hidden' }}>
      {title && (
        <Typography variant="h6" gutterBottom align="center">
          {title}
        </Typography>
      )}
      
      <Box 
        ref={containerRef}
        sx={{ 
          height: isCodeVisible ? 'auto' : height,
          width: '100%',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        {svgContent ? (
          <Box 
            dangerouslySetInnerHTML={{ __html: svgContent }} 
            sx={{ 
              '& svg': { 
                maxWidth: '100%',
                height: 'auto'
              }
            }}
          />
        ) : (
          <Typography color="text.secondary" align="center">
            暂无图表内容
          </Typography>
        )}
      </Box>
      
      {code && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            variant="outlined" 
            color="primary" 
            size="small"
            onClick={toggleCodeVisibility}
          >
            {isCodeVisible ? '隐藏代码' : '显示代码'}
          </Button>
          
          {isCodeVisible && (
            <Box 
              component="pre" 
              sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                overflow: 'auto',
                textAlign: 'left',
                fontSize: '0.8rem'
              }}
            >
              <code>{code}</code>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
