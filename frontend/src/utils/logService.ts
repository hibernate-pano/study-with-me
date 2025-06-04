// 使用与api.ts相同的API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * 日志服务 - 用于从后端获取日志并显示在浏览器控制台
 */
class LogService {
  private static instance: LogService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastLogTimestamp: string = "";
  private isPolling: boolean = false;
  private pollIntervalMs: number = 2000; // 默认2秒轮询一次

  private constructor() {
    // 私有构造函数，确保单例
  }

  /**
   * 获取LogService实例
   */
  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  /**
   * 开始轮询日志
   * @param intervalMs 轮询间隔（毫秒）
   */
  public startPolling(intervalMs: number = 2000): void {
    if (this.isPolling) {
      console.log("[LogService] Already polling logs");
      return;
    }

    this.pollIntervalMs = intervalMs;
    this.isPolling = true;

    // 立即获取一次日志
    this.fetchLogs();

    // 设置轮询
    this.pollingInterval = setInterval(() => {
      this.fetchLogs();
    }, this.pollIntervalMs);

    console.log(
      `[LogService] Started polling logs every ${this.pollIntervalMs}ms`
    );
  }

  /**
   * 停止轮询日志
   */
  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log("[LogService] Stopped polling logs");
  }

  /**
   * 获取日志
   * @param limit 获取日志的数量限制
   */
  private async fetchLogs(limit: number = 50): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/logs?limit=${limit}`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch logs: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
        // 过滤出新日志
        const newLogs = this.lastLogTimestamp
          ? data.logs.filter(
              (log: any) => log.timestamp > this.lastLogTimestamp
            )
          : data.logs;

        // 更新最后一条日志的时间戳
        if (data.logs.length > 0) {
          this.lastLogTimestamp = data.logs[0].timestamp;
        }

        // 打印新日志到控制台
        this.printLogs(newLogs);
      }
    } catch (error) {
      console.error("[LogService] Error fetching logs:", error);
    }
  }

  /**
   * 打印日志到浏览器控制台
   * @param logs 日志数组
   */
  private printLogs(logs: any[]): void {
    if (!logs || logs.length === 0) return;

    // 按时间戳排序（从旧到新）
    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 打印日志
    sortedLogs.forEach((log) => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const prefix = `[${timestamp}] [${log.level.toUpperCase()}]`;

      switch (log.level) {
        case "error":
          console.error(`${prefix} ${log.message}`, log.meta || "");
          break;
        case "warn":
          console.warn(`${prefix} ${log.message}`, log.meta || "");
          break;
        case "info":
          console.info(`${prefix} ${log.message}`, log.meta || "");
          break;
        default:
          console.log(`${prefix} ${log.message}`, log.meta || "");
          break;
      }
    });
  }

  /**
   * 清除所有日志
   */
  public async clearLogs(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/logs`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to clear logs: ${response.status} ${response.statusText}`
        );
      }

      console.log("[LogService] Logs cleared successfully");
    } catch (error) {
      console.error("[LogService] Error clearing logs:", error);
    }
  }
}

export default LogService.getInstance();
