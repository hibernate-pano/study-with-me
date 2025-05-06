'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { progressApi } from '@/lib/api';

interface LearningTimeTrackerProps {
  pathId: string;
  chapterId: string;
  autoSaveInterval?: number; // 自动保存间隔（秒）
  showTimer?: boolean; // 是否显示计时器
}

/**
 * 学习时间记录组件
 * 
 * 自动记录用户在章节页面的学习时间，并定期将时间更新到后端
 */
export default function LearningTimeTracker({
  pathId,
  chapterId,
  autoSaveInterval = 60, // 默认每60秒保存一次
  showTimer = true
}: LearningTimeTrackerProps) {
  const { user } = useAuth();
  const [elapsedTime, setElapsedTime] = useState(0); // 当前会话的学习时间（秒）
  const [totalTimeSpent, setTotalTimeSpent] = useState(0); // 总学习时间（秒）
  const [isActive, setIsActive] = useState(true); // 是否正在计时
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化：获取已有的学习时间
  useEffect(() => {
    const fetchExistingTime = async () => {
      if (!user || !pathId || !chapterId) return;

      try {
        const progressResponse = await progressApi.getUserProgress(user.id, pathId);
        const chapterProgress = progressResponse.progress?.find(
          (p: any) => p.chapter_id === chapterId
        );
        
        if (chapterProgress && chapterProgress.time_spent) {
          setTotalTimeSpent(chapterProgress.time_spent);
        }
      } catch (error) {
        console.error('获取学习时间失败:', error);
      }
    };

    fetchExistingTime();
  }, [user, pathId, chapterId]);

  // 设置计时器
  useEffect(() => {
    // 每秒更新计时器
    timerRef.current = setInterval(() => {
      if (isActive) {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);

    // 设置自动保存计时器
    saveTimerRef.current = setInterval(() => {
      if (isActive && elapsedTime > 0) {
        saveTime();
      }
    }, autoSaveInterval * 1000);

    return () => {
      // 清理计时器
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      
      // 组件卸载时保存时间
      if (elapsedTime > 0) {
        saveTime();
      }
    };
  }, [isActive, elapsedTime, autoSaveInterval]);

  // 监听用户活动
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const inactivityTimeout = 5 * 60 * 1000; // 5分钟无活动视为不活跃

    const handleActivity = () => {
      const now = Date.now();
      
      // 如果之前不活跃，现在有活动，则重新开始计时
      if (!isActive && now - lastActivity > inactivityTimeout) {
        setIsActive(true);
      }
      
      setLastActivity(now);
    };

    // 检查不活跃状态
    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivity > inactivityTimeout) {
        setIsActive(false);
      }
    }, 60000); // 每分钟检查一次

    // 添加事件监听器
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      // 清理事件监听器
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(checkInactivity);
    };
  }, [isActive, lastActivity]);

  // 保存学习时间到后端
  const saveTime = async () => {
    if (!user || !pathId || !chapterId || elapsedTime === 0 || isSaving) return;

    setIsSaving(true);
    
    try {
      const newTotalTime = totalTimeSpent + elapsedTime;
      
      await progressApi.update({
        userId: user.id,
        pathId,
        chapterId,
        time_spent: newTotalTime
      });
      
      // 更新状态
      setTotalTimeSpent(newTotalTime);
      setElapsedTime(0);
    } catch (error) {
      console.error('保存学习时间失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟 ${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  if (!showTimer) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Chip
        icon={<AccessTimeIcon />}
        label={`学习时间: ${formatTime(totalTimeSpent + elapsedTime)}`}
        color="primary"
        variant="outlined"
        size="small"
      />
      {!isActive && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          (暂停计时)
        </Typography>
      )}
    </Box>
  );
}
