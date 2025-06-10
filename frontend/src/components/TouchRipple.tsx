"use client";

import React, { useState, useRef, useEffect } from "react";
import { Box, keyframes, useTheme } from "@mui/material";

interface TouchRippleProps {
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
}

interface RippleState {
  x: number;
  y: number;
  size: number;
  id: number;
}

// 定义涟漪动画
const rippleAnimation = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
`;

/**
 * 自定义触摸反馈组件，提供更好的移动端触摸体验
 */
const TouchRipple: React.FC<TouchRippleProps> = ({
  children,
  color,
  disabled = false,
  className,
  style,
  onClick,
  onTouchStart,
  onTouchEnd,
}) => {
  const theme = useTheme();
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const nextId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 清除涟漪效果
  const clearRipple = (id: number) => {
    setRipples((prevRipples) =>
      prevRipples.filter((ripple) => ripple.id !== id)
    );
  };

  // 创建涟漪效果
  const createRipple = (
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (disabled) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // 获取点击/触摸位置
    let clientX: number, clientY: number;

    if ("touches" in event) {
      // 触摸事件
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      // 鼠标事件
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // 计算相对于容器的坐标
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 计算涟漪大小（取容器宽高的最大值）
    const size = Math.max(rect.width, rect.height);

    // 创建新的涟漪
    const id = nextId.current;
    nextId.current += 1;

    setRipples((prevRipples) => [...prevRipples, { x, y, size, id }]);

    // 设置涟漪消失的定时器
    setTimeout(() => {
      clearRipple(id);
    }, 600); // 动画持续时间
  };

  // 处理触摸开始事件
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    createRipple(e);
    if (onTouchStart) onTouchStart(e);
  };

  // 处理点击事件
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 只在非触摸设备上创建涟漪
    if (window.matchMedia("(hover: hover)").matches) {
      createRipple(e);
    }
    if (onClick) onClick(e);
  };

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: disabled ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent", // 移除iOS默认点击高亮
        ...style,
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}

      {/* 渲染涟漪效果 */}
      {ripples.map((ripple) => (
        <Box
          key={ripple.id}
          sx={{
            position: "absolute",
            borderRadius: "50%",
            width: ripple.size,
            height: ripple.size,
            left: ripple.x - ripple.size / 2,
            top: ripple.y - ripple.size / 2,
            backgroundColor: color || theme.palette.primary.main,
            opacity: 0.5,
            pointerEvents: "none",
            animation: `${rippleAnimation} 600ms ${theme.transitions.easing.easeOut}`,
          }}
        />
      ))}
    </Box>
  );
};

export default TouchRipple;
