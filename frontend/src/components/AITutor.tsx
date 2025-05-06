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

    try {
      // 调用AI辅导API
      const response = await tutorApi.chat({
        userId: user.id,
        pathId,
        chapterId,
        message: userMessage.content,
        context: messages.map(msg => ({ role: msg.role, content: msg.content }))
      });

      // 添加AI回复到聊天记录
      const aiMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

      // 保存聊天历史
      await tutorApi.saveChatHistory({
        userId: user.id,
        pathId,
        chapterId,
        messages: [...messages, userMessage, aiMessage]
      });
    } catch (error: any) {
      console.error('AI辅导请求失败:', error);

      // 添加错误消息到聊天记录
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，我暂时无法回答您的问题。请稍后再试。',
        timestamp: new Date().toISOString(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
      setError(error.message || 'AI辅导请求失败，请稍后再试');
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
                  <ReactMarkdown>
                    {message.content}
                  </ReactMarkdown>
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
