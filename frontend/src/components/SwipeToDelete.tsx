"use client";

import React, { useState, useRef, useEffect } from "react";
import { Box, Typography, IconButton, Slide, useTheme } from "@mui/material";
import { Delete as DeleteIcon, Close as CloseIcon } from "@mui/icons-material";

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  onCancel?: () => void;
  deleteText?: string;
  deleteIcon?: React.ReactNode;
  threshold?: number; // 触发删除的阈值，0-1之间
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 可滑动删除组件，支持左滑显示删除按钮
 */
const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({
  children,
  onDelete,
  onCancel,
  deleteText = "删除",
  deleteIcon = <DeleteIcon />,
  threshold = 0.3, // 默认滑动超过30%宽度时触发
  disabled = false,
  className,
  style,
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 测量容器宽度
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  // 计算滑动距离
  const getSwipeDistance = () => {
    if (startX === null || currentX === null) return 0;
    // 只允许向左滑动（负值）
    return Math.min(0, currentX - startX);
  };

  // 计算滑动比例
  const getSwipeRatio = () => {
    return Math.abs(getSwipeDistance()) / containerWidth;
  };

  // 处理触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isDeleting) return;
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  // 处理触摸移动
  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || startX === null || isDeleting) return;
    setCurrentX(e.touches[0].clientX);

    // 如果已经显示删除按钮，阻止默认行为（滚动）
    if (showDeleteButton) {
      e.preventDefault();
    }
  };

  // 处理触摸结束
  const handleTouchEnd = () => {
    if (disabled || startX === null || currentX === null || isDeleting) return;

    // 如果滑动距离超过阈值，显示删除按钮
    if (getSwipeRatio() > threshold) {
      setShowDeleteButton(true);
    } else {
      // 否则重置位置
      resetPosition();
    }

    // 重置触摸状态
    setStartX(null);
    setCurrentX(null);
  };

  // 重置位置
  const resetPosition = () => {
    setShowDeleteButton(false);
  };

  // 处理删除
  const handleDelete = () => {
    setIsDeleting(true);
    // 调用删除回调
    onDelete();
    // 重置状态
    setTimeout(() => {
      setShowDeleteButton(false);
      setIsDeleting(false);
    }, 300);
  };

  // 处理取消
  const handleCancel = () => {
    resetPosition();
    if (onCancel) onCancel();
  };

  // 计算内容样式
  const contentStyle = {
    transform:
      startX !== null && currentX !== null && !showDeleteButton
        ? `translateX(${getSwipeDistance()}px)`
        : showDeleteButton
        ? `translateX(-${containerWidth * 0.25}px)` // 显示删除按钮时的位置
        : "translateX(0)",
    transition: startX !== null ? "none" : "transform 0.3s ease",
  };

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        touchAction: showDeleteButton ? "none" : "auto",
        ...style,
      }}
    >
      {/* 滑动内容 */}
      <Box
        sx={{
          width: "100%",
          ...contentStyle,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </Box>

      {/* 删除按钮区域 */}
      <Slide direction="left" in={showDeleteButton} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            bgcolor: theme.palette.error.main,
            color: theme.palette.error.contrastText,
            width: "25%",
            justifyContent: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {deleteIcon}
            <Typography
              variant="body2"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {deleteText}
            </Typography>
          </Box>
        </Box>
      </Slide>

      {/* 取消按钮 - 当显示删除按钮时出现 */}
      {showDeleteButton && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
          }}
        >
          <IconButton
            size="small"
            onClick={handleCancel}
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.5)",
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.7)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* 点击删除按钮区域触发删除 */}
      {showDeleteButton && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: "25%",
            cursor: "pointer",
          }}
          onClick={handleDelete}
        />
      )}
    </Box>
  );
};

export default SwipeToDelete;
