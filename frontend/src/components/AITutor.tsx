'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Chip,
  Divider,
  Button,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Send as SendIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  QuestionAnswer as QuestionAnswerIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { tutorApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LLMLogger from '@/utils/LLMLogger';

interface AITutorProps {
  pathId: string;
  chapterId: string;
  chapterTitle?: string;
}

interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isError?: boolean;
}

export default function AITutor({ pathId, chapterId, chapterTitle }: AITutorProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取聊天历史记录
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!user) return;

      setIsLoadingHistory(true);

      try {
        const response = await tutorApi.getChatHistory(user.id, pathId, chapterId);

        if (response.history && response.history.messages) {
          setMessages(response.history.messages);
        } else {
          // 如果没有历史记录，添加一条欢迎消息
          const welcomeMessage: Message = {
            id: Date.now(),
            role: 'assistant',
            content: `欢迎来到AI辅导助手！我是您学习"${chapterTitle || '本章节'}"的AI助手。有任何问题都可以向我提问，我会尽力帮助您理解本章内容。`,
            timestamp: new Date().toISOString()
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('获取聊天历史失败:', error);
        // 添加一条欢迎消息
        const welcomeMessage: Message = {
          id: Date.now(),
          role: 'assistant',
          content: `欢迎来到AI辅导助手！我是您学习"${chapterTitle || '本章节'}"的AI助手。有任何问题都可以向我提问，我会尽力帮助您理解本章内容。`,
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchChatHistory();
  }, [user, pathId, chapterId, chapterTitle]);

  // 获取推荐问题
  useEffect(() => {
    const fetchRecommendedQuestions = async () => {
      try {
        const response = await tutorApi.getRecommendedQuestions(pathId, chapterId);

        if (response.questions) {
          setRecommendedQuestions(response.questions);
        } else {
          // 如果API调用失败，使用默认问题
          setRecommendedQuestions([
            '这个概念的核心原理是什么？',
            '如何在实际项目中应用这个知识点？',
            '这个技术与其他相关技术有什么区别？',
            '学习这个内容的最佳实践是什么？'
          ]);
        }
      } catch (error) {
        console.error('获取推荐问题失败:', error);
        // 使用默认问题
        setRecommendedQuestions([
          '这个概念的核心原理是什么？',
          '如何在实际项目中应用这个知识点？',
          '这个技术与其他相关技术有什么区别？',
          '学习这个内容的最佳实践是什么？'
        ]);
      }
    };

    fetchRecommendedQuestions();
  }, [pathId, chapterId]);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendQuestion = async () => {
    if (!question.trim()) return;
    if (!user) {
      setError('请先登录再使用AI辅导功能');
      return;
    }

    // 添加用户问题到聊天记录
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);
    setError('');

    // 使用LLMLogger开始记录请求
    const requestId = LLMLogger.startRequest({
      type: 'tutor_question',
      userId: user?.id,
      pathId,
      chapterId,
      chapterTitle,
      questionLength: question.length
    });

    console.log(`[${requestId}] ===== AI TUTOR FRONTEND REQUEST START =====`);
    console.log(`[${requestId}] User ID:`, user?.id);
    console.log(`[${requestId}] Path ID:`, pathId);
    console.log(`[${requestId}] Chapter ID:`, chapterId);
    console.log(`[${requestId}] Chapter Title:`, chapterTitle);
    console.log(`[${requestId}] User Message:`, userMessage.content);
    console.log(`[${requestId}] Chat History Length:`, messages.length);

    try {
      // 准备请求数据
      const requestData = {
        userId: user.id,
        pathId,
        chapterId,
        message: userMessage.content,
        context: {
          pathTitle: '学习路径', // 这里可以添加实际的路径标题
          chapterTitle: chapterTitle || '当前章节',
          conceptTitle: '', // 如果有特定概念，可以在这里添加
          conceptContent: '', // 如果有特定内容，可以在这里添加
          messages: messages.map(msg => ({ role: msg.role, content: msg.content }))
        }
      };

      // 使用LLMLogger记录请求数据
      LLMLogger.logRequest(requestId, requestData, {
        messageCount: messages.length,
        newMessageLength: userMessage.content.length
      });

      console.log(`[${requestId}] Request Data:`, JSON.stringify(requestData, (key, value) => {
        // 对于长文本内容，只记录前100个字符
        if (typeof value === 'string' && value.length > 100 && key !== 'userId') {
          return value.substring(0, 100) + '...';
        }
        return value;
      }, 2));

      // 调用AI辅导API
      console.log(`[${requestId}] Calling tutorApi.chat...`);
      const startTime = Date.now();
      const response = await tutorApi.chat(requestData);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 使用LLMLogger记录响应
      LLMLogger.logResponse(requestId, response);

      console.log(`[${requestId}] ===== AI TUTOR FRONTEND RESPONSE START =====`);
      console.log(`[${requestId}] Response Time: ${duration}ms`);
      console.log(`[${requestId}] Response Type:`, typeof response);
      console.log(`[${requestId}] Response Structure:`, Object.keys(response || {}));
      console.log(`[${requestId}] Raw Response:`, JSON.stringify(response, null, 2));

      // 记录处理步骤
      const processingSteps: any[] = [];

      // 检查响应格式并提取消息内容
      let aiContent = '';
      if (response) {
        if (typeof response.message === 'string') {
          console.log(`[${requestId}] Found 'message' field (string) in response`);
          aiContent = response.message;
          processingSteps.push({ step: 'extract_field', field: 'message', success: true });
        } else if (response.answer && typeof response.answer === 'string') {
          console.log(`[${requestId}] Found 'answer' field (string) in response`);
          aiContent = response.answer;
          processingSteps.push({ step: 'extract_field', field: 'answer', success: true });
        } else if (typeof response === 'string') {
          console.log(`[${requestId}] Response is a string`);
          aiContent = response;
          processingSteps.push({ step: 'use_raw_string', success: true });
        } else {
          console.warn(`[${requestId}] Unexpected response format:`, response);
          aiContent = '收到了回复，但格式不正确。请重试。';
          processingSteps.push({
            step: 'handle_unexpected_format',
            success: false,
            responseType: typeof response,
            responseKeys: Object.keys(response || {})
          });
        }
      } else {
        console.warn(`[${requestId}] No response received`);
        aiContent = '没有收到有效回复。请重试。';
        processingSteps.push({ step: 'handle_empty_response', success: false });
      }

      console.log(`[${requestId}] Extracted Content Length:`, aiContent.length);
      console.log(`[${requestId}] Extracted Content Sample:`, aiContent.substring(0, 200) + (aiContent.length > 200 ? '...' : ''));

      // 使用LLMLogger记录处理后的内容
      LLMLogger.logProcessedContent(requestId, aiContent, {
        processingSteps,
        processingDuration: 0, // 前端处理几乎是瞬时的
        originalResponseType: typeof response,
        processedLength: aiContent.length,
        containsMarkdown: aiContent.includes('#') || aiContent.includes('*') || aiContent.includes('>')
      });

      // 添加AI回复到聊天记录
      const aiMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: aiContent,
        timestamp: new Date().toISOString()
      };

      console.log(`[${requestId}] Created AI message with ID:`, aiMessage.id);
      setMessages(prev => [...prev, aiMessage]);

      // 保存聊天历史
      try {
        console.log(`[${requestId}] Saving chat history...`);
        await tutorApi.saveChatHistory({
          userId: user.id,
          pathId,
          chapterId,
          messages: [...messages, userMessage, aiMessage]
        });
        console.log(`[${requestId}] Chat history saved successfully`);
      } catch (saveError: any) {
        console.error(`[${requestId}] Failed to save chat history:`, saveError);
        console.error(`[${requestId}] Error message:`, saveError.message);
        console.error(`[${requestId}] Error stack:`, saveError.stack);
        // 不中断用户体验，只记录错误
      }

      console.log(`[${requestId}] ===== AI TUTOR FRONTEND RESPONSE END =====`);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'success',
        duration,
        responseLength: aiContent.length,
        question: {
          length: question.length,
          type: 'tutor'
        }
      });
    } catch (error: any) {
      console.error(`[${requestId}] ===== AI TUTOR FRONTEND ERROR =====`);
      console.error(`[${requestId}] AI辅导请求失败:`, error);
      console.error(`[${requestId}] Error message:`, error.message);
      console.error(`[${requestId}] Error stack:`, error.stack);

      // 使用LLMLogger记录错误
      LLMLogger.logError(requestId, error, {
        errorPhase: 'api_request',
        question,
        context: {
          chapterTitle,
          pathId,
          chapterId
        }
      });

      if (error.response) {
        console.error(`[${requestId}] Error response:`, error.response);
        try {
          console.error(`[${requestId}] Error response data:`, JSON.stringify(error.response.data));
        } catch (e) {
          console.error(`[${requestId}] Could not stringify error response data`);
        }
      }

      // 添加错误消息到聊天记录
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `抱歉，我暂时无法回答您的问题。请稍后再试。\n\n错误信息: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString(),
        isError: true
      };

      console.error(`[${requestId}] Created error message with ID:`, errorMessage.id);
      setMessages(prev => [...prev, errorMessage]);
      setError(error.message || 'AI辅导请求失败，请稍后再试');
      console.error(`[${requestId}] ===== AI TUTOR FRONTEND ERROR END =====`);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'error',
        errorMessage: error.message,
        errorType: error.name || 'Unknown'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseRecommendedQuestion = (question: string) => {
    setQuestion(question);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleClearChat = async () => {
    handleMenuClose();

    if (!user) return;

    try {
      await tutorApi.clearChatHistory(user.id, pathId, chapterId);

      // 添加一条欢迎消息
      const welcomeMessage: Message = {
        id: Date.now(),
        role: 'assistant',
        content: `欢迎来到AI辅导助手！我是您学习"${chapterTitle || '本章节'}"的AI助手。有任何问题都可以向我提问，我会尽力帮助您理解本章内容。`,
        timestamp: new Date().toISOString()
      };

      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('清除聊天历史失败:', error);
      setError('清除聊天历史失败，请稍后再试');
    }
  };

  const handleSaveChat = async () => {
    handleMenuClose();

    if (!user || messages.length === 0) return;

    try {
      // 在实际应用中，这里会调用API保存聊天记录
      await tutorApi.saveChatHistory({
        userId: user.id,
        pathId,
        chapterId,
        messages
      });

      // 显示成功消息
      alert('聊天记录已保存');
    } catch (error) {
      console.error('保存聊天历史失败:', error);
      setError('保存聊天历史失败，请稍后再试');
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">AI辅导助手</Typography>
        <IconButton onClick={handleMenuOpen}>
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleClearChat}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>清除聊天记录</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleSaveChat}>
            <ListItemIcon>
              <SaveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>保存聊天记录</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        有任何问题都可以向AI助手提问，它会根据当前学习内容为您提供解答。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          推荐问题:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {recommendedQuestions.map((q, index) => (
            <Chip
              key={index}
              label={q}
              onClick={() => handleUseRecommendedQuestion(q)}
              clickable
              color="primary"
              variant="outlined"
              size="small"
              icon={<QuestionAnswerIcon />}
            />
          ))}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{
        flexGrow: 1,
        bgcolor: 'background.default',
        borderRadius: 2,
        p: 2,
        mb: 2,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {isLoadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%'
              }}
            >
              <Paper
                sx={{
                  p: 2,
                  bgcolor: message.role === 'user' ? 'primary.main' : message.isError ? 'error.light' : 'grey.100',
                  color: message.role === 'user' ? 'white' : 'text.primary',
                  borderRadius: 2
                }}
              >
                {message.role === 'user' ? (
                  <Typography variant="body1">
                    {message.content}
                  </Typography>
                ) : (
                  <Box sx={{
                    '& pre': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      padding: 1,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxWidth: '100%'
                    },
                    '& code': {
                      fontFamily: 'monospace',
                      fontSize: '0.9em',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(0, 0, 0, 0.04)'
                    },
                    '& img': { maxWidth: '100%' },
                    '& a': { color: 'primary.main' },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      marginBottom: 2
                    },
                    '& th, & td': {
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      padding: '8px 12px',
                      textAlign: 'left'
                    },
                    '& blockquote': {
                      borderLeft: '4px solid rgba(0, 0, 0, 0.12)',
                      margin: '0 0 16px',
                      padding: '0 16px',
                      color: 'text.secondary'
                    }
                  }}>
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </Box>
                )}
              </Paper>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          placeholder="输入您的问题..."
          variant="outlined"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendQuestion()}
          disabled={isLoading || isLoadingHistory}
          multiline
          maxRows={3}
        />
        <IconButton
          color="primary"
          onClick={handleSendQuestion}
          disabled={!question.trim() || isLoading || isLoadingHistory}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
