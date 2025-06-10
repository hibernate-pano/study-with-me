"use client";

import React, { useState, useRef, useEffect } from "react";
import { Box, Typography, CircularProgress, useTheme } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  pullDistance?: number; // 下拉多少距离触发刷新
  maxPullDistance?: number; // 最大下拉距离
  refreshingText?: string;
  pullingText?: string;
  releaseText?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * 下拉刷新组件，支持移动端下拉刷新功能
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  pullDistance = 80, // 默认下拉80px触发刷新
  maxPullDistance = 120, // 默认最大下拉距离120px
  refreshingText = "正在刷新...",
  pullingText = "下拉刷新",
  releaseText = "释放刷新",
  className,
  style,
  disabled = false,
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullHeight, setPullHeight] = useState(0);
  const [isAtTop, setIsAtTop] = useState(false);

  // 检查滚动位置是否在顶部
  const checkIfAtTop = () => {
    if (!containerRef.current) return false;

    // 检查页面滚动位置
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return scrollTop === 0;
  };

  // 处理触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;

    // 检查是否在顶部
    const atTop = checkIfAtTop();
    setIsAtTop(atTop);

    if (atTop) {
      setStartY(e.touches[0].clientY);
      setCurrentY(e.touches[0].clientY);
    }
  };

  // 处理触摸移动
  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || refreshing || !isAtTop || startY === null) return;

    setCurrentY(e.touches[0].clientY);

    // 计算下拉距离（只允许向下拉）
    const pullDelta = Math.max(0, (e.touches[0].clientY - startY) * 0.5); // 添加阻尼效果
    const newPullHeight = Math.min(pullDelta, maxPullDistance);

    if (newPullHeight > 0) {
      // 阻止默认滚动行为
      e.preventDefault();
      setPullHeight(newPullHeight);
    }
  };

  // 处理触摸结束
  const handleTouchEnd = async () => {
    if (
      disabled ||
      refreshing ||
      !isAtTop ||
      startY === null ||
      currentY === null
    )
      return;

    // 如果下拉距离超过阈值，触发刷新
    if (pullHeight >= pullDistance) {
      setRefreshing(true);

      try {
        await onRefresh();
      } catch (error) {
        console.error("刷新失败:", error);
      } finally {
        // 延迟重置状态，让用户看到刷新动画
        setTimeout(() => {
          setRefreshing(false);
          setPullHeight(0);
        }, 300);
      }
    } else {
      // 未达到刷新阈值，重置状态
      setPullHeight(0);
    }

    // 重置触摸状态
    setStartY(null);
    setCurrentY(null);
  };

  // 计算下拉指示器的旋转角度
  const getRotation = () => {
    if (refreshing) return 0; // 刷新中不旋转
    // 根据下拉高度计算旋转角度，最大180度
    return Math.min(180, (pullHeight / pullDistance) * 180);
  };

  // 获取下拉提示文本
  const getPullText = () => {
    if (refreshing) return refreshingText;
    return pullHeight >= pullDistance ? releaseText : pullingText;
  };

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: "relative",
        width: "100%",
        ...style,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉指示器 */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: `${pullHeight}px`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.palette.background.paper,
          transition: !startY ? "height 0.3s ease" : "none",
          overflow: "hidden",
          zIndex: 10,
          boxShadow: pullHeight > 0 ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          {refreshing ? (
            <CircularProgress size={24} color="primary" />
          ) : (
            <RefreshIcon
              sx={{
                fontSize: "24px",
                color: "primary.main",
                transform: `rotate(${getRotation()}deg)`,
                transition: !startY ? "transform 0.3s ease" : "none",
              }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {getPullText()}
          </Typography>
        </Box>
      </Box>

      {/* 内容区域，根据下拉高度进行偏移 */}
      <Box
        sx={{
          transform: `translateY(${pullHeight}px)`,
          transition: !startY ? "transform 0.3s ease" : "none",
          width: "100%",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
