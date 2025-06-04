"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  useTheme,
} from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { progressApi } from "@/lib/api";

// 删除模拟数据
// const mockHeatmapData = Array.from({ length: 60 }, (_, i) => {
//   const date = new Date();
//   date.setDate(date.getDate() - i);
//   const dateString = date.toISOString().split("T")[0];
//
//   // 随机生成学习时间，周末概率更高
//   const isWeekend = date.getDay() === 0 || date.getDay() === 6;
//   const probability = isWeekend ? 0.8 : 0.5;
//   const hasActivity = Math.random() < probability;
//
//   return {
//     date: dateString,
//     count: hasActivity ? Math.floor(Math.random() * 5) + 1 : 0,
//     minutes: hasActivity ? Math.floor(Math.random() * 180) : 0,
//   };
// });

interface HeatmapDay {
  date: string;
  count: number;
  minutes: number;
}

/**
 * 学习热图组件
 * 显示用户学习活动的热图，类似于GitHub贡献图
 */
export default function LearningHeatmap() {
  const theme = useTheme();
  const { user } = useAuth();
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  // 获取热图数据
  useEffect(() => {
    const fetchHeatmapData = async () => {
      if (!user) return;

      setIsLoading(true);
      setError("");

      try {
        // 调用API获取学习活动数据
        const response = await progressApi.getLearningTimeHistory(
          user.id,
          period
        );

        if (response && response.timeHistory) {
          // 转换API返回的数据为热图所需格式
          const formattedData = response.timeHistory.map((item: any) => ({
            date: item.date,
            count: item.sessions || 0,
            minutes: item.minutes || 0,
          }));

          setHeatmapData(formattedData);
        } else {
          // 如果API返回数据为空，设置空数组
          setHeatmapData([]);
        }
      } catch (error: any) {
        console.error("获取学习热图数据失败:", error);
        setError("获取学习活动数据失败，请稍后再试");
        // 出错时设置空数组，而不是使用模拟数据
        setHeatmapData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeatmapData();
  }, [user, period]);

  // 处理周期选择变更
  const handlePeriodChange = (event: SelectChangeEvent<string>) => {
    setPeriod(event.target.value as "day" | "week" | "month");
  };

  // 获取日期范围
  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();

    if (period === "day") {
      startDate.setDate(now.getDate() - 7); // 一周内的每日数据
    } else if (period === "week") {
      startDate.setDate(now.getDate() - 28); // 4周数据
    } else if (period === "month") {
      startDate.setMonth(now.getMonth() - 3); // 3个月数据
    }

    return {
      start: startDate,
      end: now,
    };
  };

  // 生成日期网格
  const generateDateGrid = () => {
    const { start, end } = getDateRange();
    const days: Date[] = [];

    let currentDate = new Date(start);
    while (currentDate <= end) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 将日期按周分组
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    days.forEach((day) => {
      if (day.getDay() === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
      if (day.getDay() === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  // 获取日期对应的活动数据
  const getActivityForDate = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    return (
      heatmapData.find((day) => day.date === dateString) || {
        date: dateString,
        count: 0,
        minutes: 0,
      }
    );
  };

  // 获取活动强度对应的颜色
  const getActivityColor = (minutes: number) => {
    if (minutes === 0) return theme.palette.grey[200];
    if (minutes < 15) return theme.palette.primary.light;
    if (minutes < 30) return theme.palette.primary.main;
    if (minutes < 60) return theme.palette.primary.dark;
    if (minutes < 120) return theme.palette.secondary.light;
    return theme.palette.secondary.main;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  // 格式化学习时间
  const formatLearningTime = (minutes: number) => {
    if (minutes === 0) return "无学习记录";
    if (minutes < 60) return `${minutes} 分钟`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) return `${hours} 小时`;
    return `${hours} 小时 ${remainingMinutes} 分钟`;
  };

  // 渲染热图
  const renderHeatmap = () => {
    const weeks = generateDateGrid();

    return (
      <Box sx={{ overflowX: "auto", py: 2 }}>
        <Box sx={{ display: "flex", minWidth: weeks.length * 16 }}>
          {weeks.map((week, weekIndex) => (
            <Box
              key={weekIndex}
              sx={{ display: "flex", flexDirection: "column" }}
            >
              {week.map((day, dayIndex) => {
                const activity = getActivityForDate(day);
                return (
                  <Tooltip
                    key={dayIndex}
                    title={
                      <>
                        <Typography variant="body2">
                          {formatDate(day)}
                        </Typography>
                        <Typography variant="body2">
                          {formatLearningTime(activity.minutes)}
                        </Typography>
                      </>
                    }
                    arrow
                  >
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        m: 0.25,
                        bgcolor: getActivityColor(activity.minutes),
                        borderRadius: 0.5,
                        transition: "all 0.2s",
                        "&:hover": {
                          transform: "scale(1.2)",
                          boxShadow: 1,
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  // 渲染图例
  const renderLegend = () => {
    const levels = [0, 15, 30, 60, 120];
    const colors = [
      theme.palette.grey[200],
      theme.palette.primary.light,
      theme.palette.primary.main,
      theme.palette.primary.dark,
      theme.palette.secondary.main,
    ];

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          mt: 1,
        }}
      >
        <Typography variant="caption" sx={{ mr: 1 }}>
          少
        </Typography>
        {colors.map((color, index) => (
          <Box
            key={index}
            sx={{
              width: 14,
              height: 14,
              bgcolor: color,
              mx: 0.25,
              borderRadius: 0.5,
            }}
          />
        ))}
        <Typography variant="caption" sx={{ ml: 1 }}>
          多
        </Typography>
      </Box>
    );
  };

  // 渲染周期选择器
  const renderPeriodSelector = () => {
    return (
      <FormControl
        variant="outlined"
        size="small"
        sx={{ minWidth: 120, ml: 2 }}
      >
        <InputLabel id="period-select-label">时间范围</InputLabel>
        <Select
          labelId="period-select-label"
          id="period-select"
          value={period}
          onChange={handlePeriodChange}
          label="时间范围"
        >
          <MenuItem value="day">每日</MenuItem>
          <MenuItem value="week">每周</MenuItem>
          <MenuItem value="month">每月</MenuItem>
        </Select>
      </FormControl>
    );
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          学习活动热图
        </Typography>

        {renderPeriodSelector()}
      </Box>

      {isLoading ? (
        <Box
          sx={{
            height: 120,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      ) : error ? (
        <Box
          sx={{
            height: 120,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography color="error">{error}</Typography>
        </Box>
      ) : heatmapData.length === 0 ? (
        <Box
          sx={{
            height: 120,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography color="text.secondary">暂无学习记录</Typography>
        </Box>
      ) : (
        <>
          {renderHeatmap()}
          {renderLegend()}
        </>
      )}
    </Paper>
  );
}
