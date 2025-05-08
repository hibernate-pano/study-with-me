import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// 存储最近的日志
const recentLogs: any[] = [];
const MAX_LOGS = 1000; // 最多保存1000条日志

// 添加日志
function addLog(level: string, message: string, meta: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta
  };
  
  // 添加到最近的日志
  recentLogs.unshift(logEntry);
  
  // 保持日志数量在限制内
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.pop();
  }
  
  return logEntry;
}

// 重写console方法，捕获所有日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = function(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  addLog('log', message);
  originalConsoleLog.apply(console, args);
};

console.error = function(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  addLog('error', message);
  originalConsoleError.apply(console, args);
};

console.warn = function(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  addLog('warn', message);
  originalConsoleWarn.apply(console, args);
};

console.info = function(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  addLog('info', message);
  originalConsoleInfo.apply(console, args);
};

// 获取最近的日志
router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = recentLogs.slice(0, Math.min(limit, MAX_LOGS));
  
  res.json({
    logs,
    total: recentLogs.length
  });
});

// 清除日志
router.delete('/', (req: Request, res: Response) => {
  recentLogs.length = 0;
  res.json({ message: 'Logs cleared' });
});

// 添加日志（用于前端直接发送日志）
router.post('/', (req: Request, res: Response) => {
  const { level, message, meta } = req.body;
  
  if (!level || !message) {
    return res.status(400).json({ error: 'Level and message are required' });
  }
  
  const logEntry = addLog(level, message, meta);
  res.status(201).json(logEntry);
});

export default router;
