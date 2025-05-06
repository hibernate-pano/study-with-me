'use client';

import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ProgressChartProps {
  completedChapters: number;
  totalChapters: number;
  title?: string;
  size?: number;
  showLegend?: boolean;
}

/**
 * 学习进度饼图组件
 */
export default function ProgressChart({
  completedChapters,
  totalChapters,
  title = '学习进度',
  size = 200,
  showLegend = true
}: ProgressChartProps) {
  const remainingChapters = totalChapters - completedChapters;
  const completionPercentage = totalChapters > 0 
    ? Math.round((completedChapters / totalChapters) * 100) 
    : 0;

  const data = [
    { name: '已完成', value: completedChapters, color: '#4285F4' },
    { name: '未完成', value: remainingChapters, color: '#E1E5EA' }
  ];

  // 如果没有章节，显示空状态
  if (totalChapters === 0) {
    return (
      <Paper sx={{ p: 3, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          暂无学习数据
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: size + 80 }}>
      <Typography variant="h6" align="center" gutterBottom>
        {title}
      </Typography>
      
      <Box sx={{ position: 'relative', width: '100%', height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size / 3}
              outerRadius={size / 2}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [`${value} 章节`, '']}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}
        >
          <Typography variant="h4" color="primary" fontWeight="bold">
            {completionPercentage}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            完成率
          </Typography>
        </Box>
      </Box>
      
      {showLegend && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 2 }}>
          {data.map((entry, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                  mr: 1
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {entry.name}: {entry.value} 章节
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
