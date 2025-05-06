'use client';

import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  ToggleButtonGroup, 
  ToggleButton,
  CircularProgress
} from '@mui/material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface TimeHistoryItem {
  date: string;
  time_spent: number;
}

interface LearningTimeChartProps {
  timeHistory: TimeHistoryItem[];
  isLoading?: boolean;
  error?: string;
  height?: number;
}

/**
 * 学习时间柱状图组件
 */
export default function LearningTimeChart({
  timeHistory,
  isLoading = false,
  error = '',
  height = 300
}: LearningTimeChartProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  const handlePeriodChange = (
    event: React.MouseEvent<HTMLElement>,
    newPeriod: 'day' | 'week' | 'month',
  ) => {
    if (newPeriod !== null) {
      setPeriod(newPeriod);
    }
  };

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 格式化时间显示（分钟）
  const formatTime = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} 分钟`;
  };

  // 处理数据，添加格式化的日期
  const formattedData = timeHistory.map(item => ({
    ...item,
    formattedDate: formatDate(item.date),
    minutes: Math.round(item.time_spent / 60)
  }));

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  if (timeHistory.length === 0) {
    return (
      <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          学习时间统计
        </Typography>
        <Typography variant="body2" color="text.secondary">
          暂无学习时间数据
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: height + 80 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          学习时间统计
        </Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={handlePeriodChange}
          size="small"
        >
          <ToggleButton value="day">
            24小时
          </ToggleButton>
          <ToggleButton value="week">
            7天
          </ToggleButton>
          <ToggleButton value="month">
            30天
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={formattedData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="formattedDate" />
          <YAxis 
            label={{ value: '学习时间（分钟）', angle: -90, position: 'insideLeft' }} 
            allowDecimals={false}
          />
          <Tooltip 
            formatter={(value) => [`${value} 分钟`, '学习时间']}
            labelFormatter={(label) => `日期: ${label}`}
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
          <Legend />
          <Bar dataKey="minutes" name="学习时间" fill="#4285F4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
