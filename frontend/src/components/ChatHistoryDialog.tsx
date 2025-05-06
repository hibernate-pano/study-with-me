'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Divider,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Search as SearchIcon,
  History as HistoryIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { tutorApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface ChatHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

interface ChatHistory {
  id: string;
  pathId: string;
  chapterId: string;
  pathTitle: string;
  chapterTitle: string;
  lastMessage: string;
  lastUpdated: string;
  messageCount: number;
}

export default function ChatHistoryDialog({
  open,
  onClose,
  userId
}: ChatHistoryDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [filteredHistories, setFilteredHistories] = useState<ChatHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && userId) {
      fetchChatHistories();
    }
  }, [open, userId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = chatHistories.filter(
        history =>
          history.pathTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          history.chapterTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          history.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredHistories(filtered);
    } else {
      setFilteredHistories(chatHistories);
    }
  }, [searchQuery, chatHistories]);

  const fetchChatHistories = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // 在实际应用中，这里会调用API获取聊天历史记录
      // const response = await tutorApi.getAllChatHistories(userId);
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟数据
      const mockHistories: ChatHistory[] = [
        {
          id: '1',
          pathId: '1',
          chapterId: '1',
          pathTitle: 'React前端开发',
          chapterTitle: 'React简介',
          lastMessage: '请解释一下React的虚拟DOM是如何工作的？',
          lastUpdated: '2023-11-15T10:30:00Z',
          messageCount: 12
        },
        {
          id: '2',
          pathId: '1',
          chapterId: '2',
          pathTitle: 'React前端开发',
          chapterTitle: 'JSX语法',
          lastMessage: 'JSX和HTML有什么区别？',
          lastUpdated: '2023-11-14T15:45:00Z',
          messageCount: 8
        },
        {
          id: '3',
          pathId: '2',
          chapterId: '1',
          pathTitle: 'Python数据分析',
          chapterTitle: 'Python基础',
          lastMessage: '如何在Python中处理JSON数据？',
          lastUpdated: '2023-11-10T09:20:00Z',
          messageCount: 5
        }
      ];
      
      setChatHistories(mockHistories);
      setFilteredHistories(mockHistories);
    } catch (error: any) {
      console.error('获取聊天历史失败:', error);
      setError(error.message || '获取聊天历史失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = async (historyId: string) => {
    try {
      // 在实际应用中，这里会调用API删除聊天历史记录
      // await tutorApi.deleteChatHistory(historyId);
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 更新状态
      setChatHistories(prev => prev.filter(history => history.id !== historyId));
    } catch (error: any) {
      console.error('删除聊天历史失败:', error);
      setError(error.message || '删除聊天历史失败，请稍后再试');
    }
  };

  const handleContinueChat = (pathId: string, chapterId: string) => {
    onClose();
    router.push(`/ai-tutor?pathId=${pathId}&chapterId=${chapterId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HistoryIcon sx={{ mr: 1 }} />
          聊天历史记录
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="搜索历史记录..."
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ my: 2 }}>
            {error}
          </Typography>
        ) : filteredHistories.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ my: 2 }}>
            {searchQuery ? '没有找到匹配的聊天记录' : '暂无聊天历史记录'}
          </Typography>
        ) : (
          <List>
            {filteredHistories.map((history) => (
              <Box key={history.id}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {history.pathTitle} - {history.chapterTitle}
                        </Typography>
                        <Chip 
                          label={`${history.messageCount}条消息`} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                          最后一条消息: {history.lastMessage}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          最后更新时间: {formatDate(history.lastUpdated)}
                        </Typography>
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => handleDeleteHistory(history.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => handleContinueChat(history.pathId, history.chapterId)}
                      >
                        继续对话
                      </Button>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider component="li" />
              </Box>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
