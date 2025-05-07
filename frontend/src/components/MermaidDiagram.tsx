'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Zoom,
  Fade,
  Divider,
  useTheme,
  Chip
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Code as CodeIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  title?: string;
  description?: string;
  height?: number | string;
  width?: number | string;
  isLoading?: boolean;
  error?: string;
  showCode?: boolean;
  diagramType?: string;
}

/**
 * 增强版Mermaid图表组件
 * 用于渲染Mermaid语法的图表，支持缩放、下载和全屏查看
 */
export default function MermaidDiagram({
  code,
  title,
  description,
  height = 400,
  width = '100%',
  isLoading = false,
  error = '',
  showCode = false,
  diagramType
}: MermaidDiagramProps) {
  const theme = useTheme();
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [isCodeVisible, setIsCodeVisible] = useState<boolean>(showCode);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showDescription, setShowDescription] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

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
    // 初始化Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: theme.palette.mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: theme.typography.fontFamily,
      themeVariables: {
        primaryColor: theme.palette.primary.main,
        primaryTextColor: theme.palette.primary.contrastText,
        primaryBorderColor: theme.palette.primary.light,
        lineColor: theme.palette.text.primary,
        secondaryColor: theme.palette.secondary.main,
        tertiaryColor: theme.palette.background.paper
      }
    });
  }, [theme]);

  useEffect(() => {
    if (!code || isLoading) return;

    const renderDiagram = async () => {
      try {
        setRenderError('');

        // 使用Mermaid渲染图表
        const { svg } = await mermaid.render('mermaid-diagram-' + Math.random(), code);
        setSvgContent(svg);

        // 在下一个渲染周期获取SVG引用
        setTimeout(() => {
          if (containerRef.current) {
            svgRef.current = containerRef.current.querySelector('svg');
          }
        }, 0);
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

  // 放大图表
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };

  // 缩小图表
  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  // 下载SVG图表
  const downloadSVG = () => {
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'diagram'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 全屏查看图表
  const viewFullscreen = () => {
    if (svgRef.current) {
      if (svgRef.current.requestFullscreen) {
        svgRef.current.requestFullscreen();
      }
    }
  };

  // 切换描述显示
  const toggleDescription = () => {
    setShowDescription(!showDescription);
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
    <Paper
      sx={{
        p: 3,
        height: 'auto',
        width,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: 3
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {title && (
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
          )}
          {diagramType && (
            <Chip
              label={getDiagramTypeName(diagramType)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 1 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex' }}>
          {description && (
            <Tooltip title="查看描述">
              <IconButton size="small" onClick={toggleDescription} color={showDescription ? 'primary' : 'default'}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="放大">
            <IconButton size="small" onClick={zoomIn} disabled={zoomLevel >= 2}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="缩小">
            <IconButton size="small" onClick={zoomOut} disabled={zoomLevel <= 0.5}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="下载SVG">
            <IconButton size="small" onClick={downloadSVG}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="全屏查看">
            <IconButton size="small" onClick={viewFullscreen}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isCodeVisible ? "隐藏代码" : "显示代码"}>
            <IconButton
              size="small"
              onClick={toggleCodeVisibility}
              color={isCodeVisible ? 'primary' : 'default'}
            >
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {description && showDescription && (
        <Fade in={showDescription}>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Fade>
      )}

      <Divider sx={{ mb: 2 }} />

      <Box
        ref={containerRef}
        sx={{
          height: isCodeVisible ? 'auto' : height,
          width: '100%',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
      >
        {svgContent ? (
          <Zoom in={true}>
            <Box
              dangerouslySetInnerHTML={{ __html: svgContent }}
              sx={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center top',
                transition: 'transform 0.3s ease',
                '& svg': {
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 1,
                  transition: 'all 0.3s ease'
                }
              }}
            />
          </Zoom>
        ) : (
          <Typography color="text.secondary" align="center">
            暂无图表内容
          </Typography>
        )}
      </Box>

      {isCodeVisible && code && (
        <Fade in={isCodeVisible}>
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Mermaid 代码:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                color: theme.palette.mode === 'dark' ? 'grey.300' : 'grey.900',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.8rem',
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <code>{code}</code>
            </Box>
          </Box>
        </Fade>
      )}
    </Paper>
  );
}
