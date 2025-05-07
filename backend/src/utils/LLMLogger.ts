import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * LLM调用日志记录器
 * 用于记录LLM调用的全周期日志，包括请求、响应和处理过程
 */
export class LLMLogger {
  private static instance: LLMLogger;
  private logDir: string;
  private enabled: boolean = true;
  private consoleEnabled: boolean = true;
  private fileEnabled: boolean = true;
  private detailedMode: boolean = true;
  private sessionId: string;
  private currentRequestId: string | null = null;
  private requestStartTime: number | null = null;

  private constructor() {
    // 使用项目根目录而不是当前工作目录
    const projectRoot = path.resolve(process.cwd(), '..');
    this.logDir = process.env.LLM_LOG_DIR || path.join(projectRoot, 'logs', 'llm');
    this.sessionId = uuidv4();

    console.log(`LLMLogger initialized with log directory: ${this.logDir}`);

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      console.log(`Creating log directory: ${this.logDir}`);
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 记录会话开始
    this.log('SESSION', `New LLM logging session started: ${this.sessionId}`);
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
   * 启用或禁用控制台日志
   * @param enabled 是否启用
   */
  public setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  /**
   * 启用或禁用文件日志
   * @param enabled 是否启用
   */
  public setFileEnabled(enabled: boolean): void {
    this.fileEnabled = enabled;
  }

  /**
   * 启用或禁用详细模式
   * @param enabled 是否启用
   */
  public setDetailedMode(enabled: boolean): void {
    this.detailedMode = enabled;
  }

  /**
   * 开始记录一个新的LLM请求
   * @param context 请求上下文信息
   * @returns 请求ID
   */
  public startRequest(context: any = {}): string {
    if (!this.enabled) return '';

    const requestId = uuidv4();
    this.currentRequestId = requestId;
    this.requestStartTime = Date.now();

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
   * @param prompt 提示词
   * @param options 请求选项
   */
  public logPrompt(requestId: string, prompt: string, options: any = {}): void {
    if (!this.enabled) return;

    // 记录完整提示词到文件
    if (this.fileEnabled) {
      const promptLogPath = path.join(this.logDir, `${requestId}_prompt.txt`);
      fs.writeFileSync(promptLogPath, prompt);
    }

    this.log('PROMPT', {
      requestId,
      promptLength: prompt.length,
      promptSample: this.detailedMode ? prompt.substring(0, 500) + (prompt.length > 500 ? '...' : '') : undefined,
      options: this.detailedMode ? options : undefined
    });
  }

  /**
   * 记录LLM响应的详细信息
   * @param requestId 请求ID
   * @param response 原始响应
   */
  public logResponse(requestId: string, response: any): void {
    if (!this.enabled) return;

    // 计算请求耗时
    const requestDuration = this.requestStartTime ? Date.now() - this.requestStartTime : null;

    // 提取响应内容
    let responseContent = '';
    let responseType = typeof response;

    if (typeof response === 'string') {
      responseContent = response;
    } else if (response && typeof response === 'object') {
      try {
        if (response.choices && response.choices[0] && response.choices[0].message) {
          responseContent = response.choices[0].message.content;
        } else if (response.content) {
          responseContent = response.content;
        } else if (response.text) {
          responseContent = response.text;
        } else if (response.message) {
          responseContent = response.message;
        } else if (response.answer) {
          responseContent = response.answer;
        } else {
          responseContent = JSON.stringify(response);
        }
      } catch (e) {
        responseContent = 'Error extracting response content: ' + e;
      }
    }

    // 记录完整响应到文件
    if (this.fileEnabled) {
      const responseLogPath = path.join(this.logDir, `${requestId}_response.txt`);
      fs.writeFileSync(responseLogPath, typeof response === 'string' ? response : JSON.stringify(response, null, 2));

      if (responseContent && responseContent !== response) {
        const contentLogPath = path.join(this.logDir, `${requestId}_content.txt`);
        fs.writeFileSync(contentLogPath, responseContent);
      }
    }

    this.log('RESPONSE', {
      requestId,
      timestamp: new Date().toISOString(),
      duration: requestDuration ? `${requestDuration}ms` : 'unknown',
      responseType,
      responseLength: responseContent.length,
      responseSample: this.detailedMode ? responseContent.substring(0, 500) + (responseContent.length > 500 ? '...' : '') : undefined
    });
  }

  /**
   * 记录处理后的响应内容
   * @param requestId 请求ID
   * @param processedContent 处理后的内容
   * @param processingSteps 处理步骤信息
   */
  public logProcessedContent(requestId: string, processedContent: string, processingSteps: any = {}): void {
    if (!this.enabled) return;

    // 记录处理后的内容到文件
    if (this.fileEnabled) {
      const processedLogPath = path.join(this.logDir, `${requestId}_processed.txt`);
      fs.writeFileSync(processedLogPath, processedContent);
    }

    this.log('PROCESSED', {
      requestId,
      processedLength: processedContent.length,
      processedSample: this.detailedMode ? processedContent.substring(0, 500) + (processedContent.length > 500 ? '...' : '') : undefined,
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

    const errorInfo = {
      requestId,
      timestamp: new Date().toISOString(),
      errorName: error.name,
      errorMessage: error.message,
      errorStack: this.detailedMode ? error.stack : undefined,
      context
    };

    this.log('ERROR', errorInfo);

    // 记录错误到文件
    if (this.fileEnabled) {
      const errorLogPath = path.join(this.logDir, `${requestId}_error.json`);
      fs.writeFileSync(errorLogPath, JSON.stringify(errorInfo, null, 2));
    }
  }

  /**
   * 结束LLM请求记录
   * @param requestId 请求ID
   * @param summary 请求摘要信息
   */
  public endRequest(requestId: string, summary: any = {}): void {
    if (!this.enabled) return;

    // 计算请求总耗时
    const totalDuration = this.requestStartTime ? Date.now() - this.requestStartTime : null;

    this.log('REQUEST_END', {
      requestId,
      timestamp: new Date().toISOString(),
      totalDuration: totalDuration ? `${totalDuration}ms` : 'unknown',
      summary
    });

    // 重置当前请求信息
    if (this.currentRequestId === requestId) {
      this.currentRequestId = null;
      this.requestStartTime = null;
    }
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
    if (this.consoleEnabled) {
      const requestIdStr = data.requestId ? `[${data.requestId.substring(0, 8)}]` : '';
      console.log(`[LLM:${type}]${requestIdStr} ${JSON.stringify(data)}`);
    }

    // 文件日志
    if (this.fileEnabled) {
      const logFilePath = path.join(this.logDir, `llm_${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
    }
  }
}

// 导出单例实例
export default LLMLogger.getInstance();
