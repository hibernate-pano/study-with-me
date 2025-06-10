"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Divider,
  Chip,
  Button,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  Lightbulb as LightbulbIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import { contentApi } from "@/lib/api";
import ContentDisplay from "./ContentDisplay";

interface StreamingContentDisplayProps {
  pathId: string;
  chapterId: string;
  onComplete?: (content: any) => void;
}

/**
 * 流式内容渲染组件
 * 用于实时显示从API流式获取的章节内容
 */
export default function StreamingContentDisplay({
  pathId,
  chapterId,
  onComplete,
}: StreamingContentDisplayProps) {
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("正在准备内容...");
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<any>({
    title: "",
    summary: "",
    concepts: [],
    codeExamples: [],
    faq: [],
  });
  const [currentText, setCurrentText] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const [typingComplete, setTypingComplete] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);

  // 用于存储流式关闭函数的引用
  const closeStreamRef = useRef<(() => void) | null>(null);

  // 重试函数
  const handleRetry = () => {
    setIsLoading(true);
    setIsGenerating(true);
    setError(null);
    setStatus("正在重新生成内容...");
    setContent({
      title: "",
      summary: "",
      concepts: [],
      codeExamples: [],
      faq: [],
    });
    setCurrentText("");
    setTypingIndex(0);
    setTypingComplete(false);
    setGeneratedContent(null);

    // 开始流式生成
    startStreaming();
  };

  // 开始流式生成
  const startStreaming = () => {
    setIsGenerating(true);
    console.log(`开始流式生成内容 - 路径ID: ${pathId}, 章节ID: ${chapterId}`);

    try {
      // 调用API开始流式生成
      const closeStream = contentApi.generateStream(
        pathId,
        chapterId,
        (event) => {
          console.log(`收到流式事件: ${event.type}`, event);
          handleStreamEvent(event);
        }
      );

      // 保存关闭函数的引用
      closeStreamRef.current = closeStream;
    } catch (error) {
      console.error("启动流式生成失败:", error);
      setError("无法启动内容生成，请检查网络连接");
      setIsGenerating(false);
    }
  };

  // 处理流式事件
  const handleStreamEvent = (event: any) => {
    switch (event.type) {
      case "status":
        setStatus(event.message);
        break;

      case "content_chunk":
        if (event.chunk) {
          setCurrentText((prev) => prev + event.chunk);
        }
        break;

      case "complete":
        console.log(`内容生成完成 - 路径ID: ${pathId}, 章节ID: ${chapterId}`);
        setIsGenerating(false);
        setTypingComplete(true);
        setStatus("内容生成完成");

        // 保存生成的完整内容
        if (event.content) {
          setGeneratedContent(event.content);
          if (onComplete) {
            console.log(`调用onComplete回调 - 内容ID: ${event.content.id}`);
            onComplete(event.content);
          }
        } else {
          console.warn("生成完成事件中没有内容数据");
        }
        break;

      case "error":
        console.error(`流式生成错误: ${event.message}`, event);
        setIsGenerating(false);
        setError(event.message || "生成内容时发生错误");
        break;

      default:
        console.log("未处理的事件类型:", event.type, event);
    }
  };

  // 打字机效果
  useEffect(() => {
    if (!currentText || typingComplete) return;

    const typingSpeed = 10; // 打字速度（毫秒）
    const timer = setTimeout(() => {
      if (typingIndex < currentText.length) {
        setTypingIndex((prev) => prev + 1);
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [currentText, typingIndex, typingComplete]);

  // 显示的文本（带打字机效果）
  const displayText = currentText.substring(0, typingIndex);

  // 组件挂载时开始流式生成
  useEffect(() => {
    setIsLoading(true);
    startStreaming();

    // 组件卸载时关闭流
    return () => {
      if (closeStreamRef.current) {
        closeStreamRef.current();
      }
    };
  }, [pathId, chapterId]);

  // 加载完成后
  useEffect(() => {
    if (currentText) {
      setIsLoading(false);
    }
  }, [currentText]);

  // 如果生成完成且有完整内容，使用ContentDisplay组件显示
  if (!isLoading && !isGenerating && generatedContent) {
    return <ContentDisplay content={generatedContent} />;
  }

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2, position: "relative" }}>
      {/* 加载状态 */}
      {isLoading && (
        <Box sx={{ width: "100%", mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* 状态信息 */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" color="text.secondary">
          {status}
        </Typography>

        {/* 重试按钮 */}
        {error && (
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            color="primary"
            onClick={handleRetry}
            size="small"
          >
            重试
          </Button>
        )}
      </Box>

      {/* 错误信息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 流式内容显示 */}
      {!isLoading && !error && (
        <Box sx={{ mt: 2 }}>
          <ReactMarkdown>{displayText}</ReactMarkdown>
        </Box>
      )}
    </Paper>
  );
}
