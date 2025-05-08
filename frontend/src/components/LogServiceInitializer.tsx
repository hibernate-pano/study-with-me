'use client';

import { useEffect } from 'react';
import logService from '@/utils/logService';

/**
 * 日志服务初始化组件
 * 用于在客户端初始化日志服务
 */
export default function LogServiceInitializer() {
  useEffect(() => {
    // 在开发环境中启动日志轮询
    if (process.env.NODE_ENV === 'development') {
      console.log('[LogServiceInitializer] Starting log service in development mode');
      logService.startPolling(3000); // 每3秒轮询一次
      
      // 在组件卸载时停止轮询
      return () => {
        logService.stopPolling();
      };
    }
  }, []);

  // 这是一个纯功能组件，不渲染任何内容
  return null;
}
