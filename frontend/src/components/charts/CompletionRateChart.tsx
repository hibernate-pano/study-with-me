'use client';

import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ChapterProgress {
  id: string;
  title: string;
  order_index: number;
  progress: {
    completed: boolean;
    score: number | null;
    last_accessed: string;
    completed_at: string | null;
  } | null;
}

interface CompletionRateChartProps {
  chaptersWithProgress: ChapterProgress[];
  isLoading?: boolean;
  error?: string;
  height?: number;
}

/**
 * 学习完成率折线图组件
 */
export default function CompletionRateChart({
  chaptersWithProgress,
  isLoading = false,
  error = '',
  height = 300
}: CompletionRateChartProps) {
  // 处理数据，计算累计完成率
  const processData = () => {
    let completedCount = 0;
    const totalChapters = chaptersWithProgress.length;
    
    return chaptersWithProgress
      .sort((a, b) => a.order_index - b.order_index)
      .map((chapter, index) => {
        if (chapter.progress?.completed) {
          completedCount++;
        }
        
        const completionRate = totalChapters > 0 
          ? (completedCount / totalChapters) * 100 
          : 0;
        
        return {
          name: `章节 ${index + 1}`,
          title: chapter.title,
          completionRate: Math.round(completionRate),
          completed: chapter.progress?.completed ? 1 : 0,
          score: chapter.progress?.score || 0
        };
      });
  };

  const data = processData();

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

  if (chaptersWithProgress.length === 0) {
    return (
      <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          学习进度曲线
        </Typography>
        <Typography variant="body2" color="text.secondary">
          暂无学习进度数据
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: height + 80 }}>
      <Typography variant="h6" gutterBottom>
        学习进度曲线
      </Typography>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis 
            label={{ value: '完成率 (%)', angle: -90, position: 'insideLeft' }} 
            domain={[0, 100]}
          />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'completionRate') return [`${value}%`, '完成率'];
              if (name === 'score') return [`${value}分`, '得分'];
              return [value, name];
            }}
            labelFormatter={(label, items) => {
              const item = data.find(d => d.name === label);
              return item ? item.title : label;
            }}
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="completionRate" 
            name="完成率" 
            stroke="#4285F4" 
            activeDot={{ r: 8 }} 
            strokeWidth={2}
          />
          {data.some(item => item.score > 0) && (
            <Line 
              type="monotone" 
              dataKey="score" 
              name="得分" 
              stroke="#34A853" 
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
