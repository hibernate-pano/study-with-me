/**
 * LLM调用前端日志记录器
 * 用于记录LLM调用的全周期日志，包括请求、响应和处理过程
 */
export class LLMLogger {
  private static instance: LLMLogger;
  private enabled: boolean = true;
  private detailedMode: boolean = true;
  private sessionId: string;
  private requests: Map<string, any> = new Map();

  private constructor() {
    this.sessionId = this.generateId();
    console.log(`[LLM-FE] New LLM logging session started: ${this.sessionId}`);
  }

  /**
   * 获取LLMLogger实例
   */
  public static getInstance(): LLMLogger {
    if (!LLMLogger.instance) {
      LLMLogger.instance = new LLMLogger();
    }
    return LLMLogger.instance;
  }

  /**
   * 启用或禁用日志记录
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 启用或禁用详细模式
   * @param enabled 是否启用
   */
  public setDetailedMode(enabled: boolean): void {
    this.detailedMode = enabled;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 开始记录一个新的LLM请求
   * @param context 请求上下文信息
   * @returns 请求ID
   */
  public startRequest(context: any = {}): string {
    if (!this.enabled) return '';
    
    const requestId = this.generateId();
    const startTime = Date.now();
    
    this.requests.set(requestId, {
      startTime,
      context,
      steps: [],
      status: 'pending'
    });
    
    this.log('REQUEST_START', {
      requestId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      context
    });
    
    return requestId;
  }

  /**
   * 记录LLM请求的详细信息
   * @param requestId 请求ID
   * @param requestData 请求数据
   * @param options 请求选项
   */
  public logRequest(requestId: string, requestData: any, options: any = {}): void {
    if (!this.enabled || !this.requests.has(requestId)) return;
    
    const request = this.requests.get(requestId);
    request.requestData = requestData;
    request.options = options;
    request.steps.push({
      step: 'request_sent',
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - request.startTime
    });
    
    this.log('REQUEST', {
      requestId,
      requestDataSample: this.detailedMode ? this.sanitizeData(requestData) : undefined,
      options: this.detailedMode ? options : undefined
    });
  }

  /**
   * 记录LLM响应的详细信息
   * @param requestId 请求ID
   * @param response 原始响应
   */
  public logResponse(requestId: string, response: any): void {
    if (!this.enabled || !this.requests.has(requestId)) return;
    
    const request = this.requests.get(requestId);
    request.rawResponse = response;
    request.steps.push({
      step: 'response_received',
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - request.startTime
    });
    
    // 提取响应内容
    let responseContent = '';
    let responseType = typeof response;
    
    if (typeof response === 'string') {
      responseContent = response;
    } else if (response && typeof response === 'object') {
      try {
        if (response.message) {
          responseContent = response.message;
        } else if (response.answer) {
          responseContent = response.answer;
        } else if (response.content) {
          responseContent = response.content;
        } else if (response.text) {
          responseContent = response.text;
        } else {
          responseContent = JSON.stringify(response);
        }
      } catch (e) {
        responseContent = 'Error extracting response content';
      }
    }
    
    request.responseContent = responseContent;
    
    this.log('RESPONSE', {
      requestId,
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - request.startTime}ms`,
      responseType,
      responseLength: responseContent.length,
      responseSample: this.detailedMode ? this.truncateString(responseContent, 500) : undefined
    });
  }

  /**
   * 记录处理后的响应内容
   * @param requestId 请求ID
   * @param processedContent 处理后的内容
   * @param processingSteps 处理步骤信息
   */
  public logProcessedContent(requestId: string, processedContent: string, processingSteps: any = {}): void {
    if (!this.enabled || !this.requests.has(requestId)) return;
    
    const request = this.requests.get(requestId);
    request.processedContent = processedContent;
    request.processingSteps = processingSteps;
    request.steps.push({
      step: 'content_processed',
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - request.startTime
    });
    
    this.log('PROCESSED', {
      requestId,
      processedLength: processedContent.length,
      processedSample: this.detailedMode ? this.truncateString(processedContent, 500) : undefined,
      processingSteps: this.detailedMode ? processingSteps : undefined
    });
  }

  /**
   * 记录错误信息
   * @param requestId 请求ID
   * @param error 错误对象
   * @param context 错误上下文
   */
  public logError(requestId: string, error: any, context: any = {}): void {
    if (!this.enabled) return;
    
    if (this.requests.has(requestId)) {
      const request = this.requests.get(requestId);
      request.error = error;
      request.errorContext = context;
      request.status = 'error';
      request.steps.push({
        step: 'error_occurred',
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - request.startTime
      });
    }
    
    const errorInfo = {
      requestId,
      timestamp: new Date().toISOString(),
      errorName: error.name,
      errorMessage: error.message,
      errorStack: this.detailedMode ? error.stack : undefined,
      context
    };
    
    this.log('ERROR', errorInfo);
  }

  /**
   * 结束LLM请求记录
   * @param requestId 请求ID
   * @param summary 请求摘要信息
   */
  public endRequest(requestId: string, summary: any = {}): void {
    if (!this.enabled || !this.requests.has(requestId)) return;
    
    const request = this.requests.get(requestId);
    const endTime = Date.now();
    const totalDuration = endTime - request.startTime;
    
    request.endTime = endTime;
    request.totalDuration = totalDuration;
    request.summary = summary;
    request.status = summary.status || 'completed';
    request.steps.push({
      step: 'request_completed',
      timestamp: new Date().toISOString(),
      elapsedMs: totalDuration
    });
    
    this.log('REQUEST_END', {
      requestId,
      timestamp: new Date().toISOString(),
      totalDuration: `${totalDuration}ms`,
      summary
    });
    
    // 保存请求日志到本地存储
    this.saveRequestToStorage(requestId, request);
  }

  /**
   * 保存请求日志到本地存储
   * @param requestId 请求ID
   * @param requestData 请求数据
   */
  private saveRequestToStorage(requestId: string, requestData: any): void {
    try {
      // 获取现有日志
      const existingLogsStr = localStorage.getItem('llm_request_logs') || '{}';
      const existingLogs = JSON.parse(existingLogsStr);
      
      // 添加新日志
      existingLogs[requestId] = {
        timestamp: new Date().toISOString(),
        duration: requestData.totalDuration,
        status: requestData.status,
        steps: requestData.steps,
        summary: requestData.summary
      };
      
      // 限制存储的日志数量（保留最新的20条）
      const logIds = Object.keys(existingLogs).sort((a, b) => {
        return new Date(existingLogs[b].timestamp).getTime() - new Date(existingLogs[a].timestamp).getTime();
      });
      
      if (logIds.length > 20) {
        const logsToKeep = logIds.slice(0, 20);
        const newLogs: Record<string, any> = {};
        
        logsToKeep.forEach(id => {
          newLogs[id] = existingLogs[id];
        });
        
        // 保存到本地存储
        localStorage.setItem('llm_request_logs', JSON.stringify(newLogs));
      } else {
        // 保存到本地存储
        localStorage.setItem('llm_request_logs', JSON.stringify(existingLogs));
      }
    } catch (e) {
      console.error('Failed to save LLM request log to storage:', e);
    }
  }

  /**
   * 获取所有请求日志
   */
  public getAllLogs(): Record<string, any> {
    try {
      const logsStr = localStorage.getItem('llm_request_logs') || '{}';
      return JSON.parse(logsStr);
    } catch (e) {
      console.error('Failed to retrieve LLM logs from storage:', e);
      return {};
    }
  }

  /**
   * 清除所有日志
   */
  public clearLogs(): void {
    localStorage.removeItem('llm_request_logs');
    this.requests.clear();
  }

  /**
   * 截断字符串
   * @param str 原始字符串
   * @param maxLength 最大长度
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  /**
   * 清理敏感数据
   * @param data 原始数据
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return this.truncateString(data, 500);
    }
    
    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
            result[key] = '[REDACTED]';
          } else if (typeof data[key] === 'string') {
            result[key] = this.truncateString(data[key], 100);
          } else if (typeof data[key] === 'object' && data[key] !== null) {
            result[key] = this.sanitizeData(data[key]);
          } else {
            result[key] = data[key];
          }
        }
      }
      
      return result;
    }
    
    return data;
  }

  /**
   * 记录通用日志信息
   * @param type 日志类型
   * @param data 日志数据
   */
  private log(type: string, data: any): void {
    if (!this.enabled) return;
    
    const logEntry = {
      type,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...data
    };
    
    // 控制台日志
    const requestIdStr = data.requestId ? `[${data.requestId.substring(0, 8)}]` : '';
    console.log(`[LLM-FE:${type}]${requestIdStr}`, logEntry);
  }
}

// 导出单例实例
export default LLMLogger.getInstance();
