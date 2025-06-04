const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001/api";
import LLMLogger from "@/utils/LLMLogger";

/**
 * Base API client for making requests to the backend
 */
class ApiClient {
  /**
   * Make a GET request
   * @param endpoint The API endpoint
   * @param options Additional fetch options
   * @returns The response data
   */
  async get(endpoint: string, options = {}) {
    return this.request(endpoint, {
      method: "GET",
      ...options,
    });
  }

  /**
   * Make a POST request
   * @param endpoint The API endpoint
   * @param data The request body
   * @param options Additional fetch options
   * @returns The response data
   */
  async post(endpoint: string, data: any, options = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    });
  }

  /**
   * Make a PUT request
   * @param endpoint The API endpoint
   * @param data The request body
   * @param options Additional fetch options
   * @returns The response data
   */
  async put(endpoint: string, data: any, options = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      ...options,
    });
  }

  /**
   * Make a DELETE request
   * @param endpoint The API endpoint
   * @param options Additional fetch options
   * @returns The response data
   */
  async delete(endpoint: string, options = {}) {
    return this.request(endpoint, {
      method: "DELETE",
      ...options,
    });
  }

  /**
   * Make a request to the API
   * @param endpoint The API endpoint
   * @param options The fetch options
   * @returns The response data
   */
  async request(endpoint: string, options: any = {}) {
    // 使用LLMLogger开始记录API请求
    const requestId = LLMLogger.startRequest({
      type: "api_request",
      endpoint,
      method: options.method || "GET",
      url: `${API_URL}${endpoint}`,
    });

    const url = `${API_URL}${endpoint}`;

    console.log(`[${requestId}] ===== API REQUEST START =====`);
    console.log(`[${requestId}] ${options.method || "GET"} ${url}`);
    console.log(`[${requestId}] Request Timestamp:`, new Date().toISOString());

    // 获取认证令牌
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    // 记录请求体，但对于长内容只记录部分
    if (config.body && typeof config.body === "string") {
      try {
        // 尝试解析为JSON以便更好地记录
        const bodyObj = JSON.parse(config.body);

        // 使用LLMLogger记录请求数据
        LLMLogger.logRequest(requestId, bodyObj, {
          headers: {
            contentType: headers["Content-Type"],
            hasAuth: !!headers["Authorization"],
          },
        });

        console.log(
          `[${requestId}] Request Body:`,
          JSON.stringify(
            bodyObj,
            (key, value) => {
              // 对于长文本内容，只记录前100个字符
              if (
                typeof value === "string" &&
                value.length > 100 &&
                key !== "userId"
              ) {
                return value.substring(0, 100) + "...";
              }
              return value;
            },
            2
          )
        );
      } catch (e) {
        // 如果不是有效的JSON，记录原始内容的一部分
        console.log(
          `[${requestId}] Request Body (raw):`,
          config.body.length > 200
            ? config.body.substring(0, 200) + "..."
            : config.body
        );

        // 使用LLMLogger记录请求数据
        LLMLogger.logRequest(
          requestId,
          { rawBody: "Non-JSON body" },
          {
            headers: {
              contentType: headers["Content-Type"],
              hasAuth: !!headers["Authorization"],
            },
            bodyLength: config.body.length,
          }
        );
      }
    } else {
      // 使用LLMLogger记录请求数据
      LLMLogger.logRequest(
        requestId,
        { noBody: true },
        {
          headers: {
            contentType: headers["Content-Type"],
            hasAuth: !!headers["Authorization"],
          },
        }
      );
    }

    try {
      console.log(`[${requestId}] Sending request...`);
      const startTime = Date.now();
      const response = await fetch(url, config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[${requestId}] ===== API RESPONSE START =====`);
      console.log(`[${requestId}] Response Time: ${duration}ms`);
      console.log(
        `[${requestId}] Status:`,
        response.status,
        response.statusText
      );
      console.log(
        `[${requestId}] Headers:`,
        JSON.stringify(Object.fromEntries([...response.headers]), null, 2)
      );

      if (!response.ok) {
        console.error(
          `[${requestId}] Response Error: ${response.status} ${response.statusText}`
        );

        let errorData;
        let responseText = "";

        try {
          // 先获取原始响应文本
          responseText = await response.text();
          console.error(`[${requestId}] Error Response Text:`, responseText);

          // 使用LLMLogger记录错误响应
          LLMLogger.logResponse(requestId, {
            status: response.status,
            statusText: response.statusText,
            responseText,
          });

          // 尝试解析为JSON
          try {
            errorData = JSON.parse(responseText);
            console.error(
              `[${requestId}] Error Response Data:`,
              JSON.stringify(errorData, null, 2)
            );
          } catch (jsonError) {
            // 如果不是JSON，使用原始文本
            errorData = {
              message: `HTTP Error: ${response.status} ${response.statusText}`,
              rawResponse: responseText,
            };
            console.error(
              `[${requestId}] Failed to parse error response as JSON:`,
              jsonError
            );

            // 使用LLMLogger记录JSON解析错误
            LLMLogger.logError(requestId, jsonError, {
              phase: "response_parsing",
              responseText:
                responseText.substring(0, 500) +
                (responseText.length > 500 ? "..." : ""),
            });
          }
        } catch (e) {
          // 如果无法获取响应文本
          errorData = {
            message: `HTTP Error: ${response.status} ${response.statusText}`,
          };
          console.error(`[${requestId}] Failed to read error response:`, e);

          // 使用LLMLogger记录读取响应错误
          LLMLogger.logError(requestId, e, {
            phase: "response_reading",
            status: response.status,
            statusText: response.statusText,
          });
        }

        console.error(`[${requestId}] ===== API RESPONSE ERROR END =====`);

        // 结束LLMLogger请求记录
        LLMLogger.endRequest(requestId, {
          status: "error",
          statusCode: response.status,
          duration,
          errorMessage: errorData.message || `HTTP Error: ${response.status}`,
        });

        return Promise.reject(
          errorData.error ||
            errorData.message ||
            `HTTP Error: ${response.status}`
        );
      }

      // 获取响应文本
      const responseText = await response.text();
      console.log(`[${requestId}] Response Text Length:`, responseText.length);
      console.log(
        `[${requestId}] Response Text Sample:`,
        responseText.length > 500
          ? responseText.substring(0, 500) + "..."
          : responseText
      );

      // 使用LLMLogger记录原始响应
      LLMLogger.logResponse(requestId, {
        status: response.status,
        statusText: response.statusText,
        responseLength: responseText.length,
        responseTextSample:
          responseText.substring(0, 500) +
          (responseText.length > 500 ? "..." : ""),
      });

      // 记录处理步骤
      const processingSteps: any[] = [];

      // 尝试解析为JSON
      let responseData;
      try {
        // 只有当响应不为空时才尝试解析
        if (responseText.trim()) {
          responseData = JSON.parse(responseText);
          console.log(
            `[${requestId}] Response Data Structure:`,
            Object.keys(responseData)
          );
          console.log(
            `[${requestId}] Response Data Sample:`,
            JSON.stringify(
              responseData,
              (_key, value) => {
                // 对于长文本内容，只记录前100个字符
                if (typeof value === "string" && value.length > 100) {
                  return value.substring(0, 100) + "...";
                }
                return value;
              },
              2
            )
          );

          processingSteps.push({
            step: "parse_json",
            success: true,
            responseKeys: Object.keys(responseData),
          });

          // 检查是否是AI响应
          if (
            endpoint.includes("/tutor/chat") ||
            endpoint.includes("/content/generate") ||
            endpoint.includes("/learning-paths/generate")
          ) {
            // 使用LLMLogger记录处理后的内容
            if (
              responseData.message ||
              responseData.answer ||
              responseData.content
            ) {
              const aiContent =
                responseData.message ||
                responseData.answer ||
                responseData.content;
              LLMLogger.logProcessedContent(
                requestId,
                typeof aiContent === "string"
                  ? aiContent
                  : JSON.stringify(aiContent),
                {
                  processingSteps,
                  responseType: "ai_response",
                  field: responseData.message
                    ? "message"
                    : responseData.answer
                    ? "answer"
                    : "content",
                }
              );
            }
          }
        } else {
          console.log(`[${requestId}] Empty response`);
          responseData = {};

          processingSteps.push({
            step: "handle_empty_response",
            success: true,
          });
        }
      } catch (jsonError: any) {
        console.error(
          `[${requestId}] Failed to parse response as JSON:`,
          jsonError
        );
        console.error(`[${requestId}] Raw response:`, responseText);

        processingSteps.push({
          step: "parse_json",
          success: false,
          error: jsonError.message,
        });

        // 使用LLMLogger记录JSON解析错误
        LLMLogger.logError(requestId, jsonError, {
          phase: "json_parsing",
          responseText:
            responseText.substring(0, 500) +
            (responseText.length > 500 ? "..." : ""),
        });

        // 结束LLMLogger请求记录
        LLMLogger.endRequest(requestId, {
          status: "error",
          statusCode: response.status,
          duration,
          errorType: "json_parsing_error",
          errorMessage: jsonError.message,
        });

        throw new Error(
          `Invalid JSON response: ${jsonError.message || "Unknown error"}`
        );
      }

      console.log(`[${requestId}] ===== API RESPONSE END =====`);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "success",
        statusCode: response.status,
        duration,
        responseType: "json",
        responseKeys: Object.keys(responseData),
      });

      return responseData;
    } catch (error: any) {
      console.error(`[${requestId}] ===== API REQUEST ERROR =====`);
      console.error(`[${requestId}] Request Failed:`, error);
      if (error && error.stack) {
        console.error(`[${requestId}] Error Stack:`, error.stack);
      }
      console.error(`[${requestId}] ===== API REQUEST ERROR END =====`);

      // 使用LLMLogger记录请求错误
      LLMLogger.logError(requestId, error, {
        phase: "request",
        endpoint,
        method: options.method || "GET",
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "error",
        errorType: "network_error",
        errorMessage:
          error && error.message ? error.message : "Network error occurred",
      });

      return Promise.reject(
        error && error.message ? error.message : "Network error occurred"
      );
    }
  }
}

// API client instances for different services
export const api = new ApiClient();

// Auth API
export const authApi = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: any) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout", {}),
  getCurrentUser: () => api.get("/auth/me"),
};

// Learning Paths API
export const learningPathsApi = {
  generate: (data: any) => api.post("/learning-paths/generate", data),
  getById: (id: string) => api.get(`/learning-paths/${id}`),
  getUserPaths: (userId?: string) => {
    // 如果提供了userId，则使用它，否则从当前用户获取
    if (userId) {
      return api.get(`/learning-paths/user/${userId}`);
    } else {
      // 从localStorage获取当前用户信息
      const userStr =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          return api.get(`/learning-paths/user/${user.id}`);
        } catch (e) {
          console.error("解析用户信息失败:", e);
        }
      }
      // 如果没有用户信息，则使用通用路径
      return api.get("/learning-paths/user");
    }
  },
  getPopularPaths: (limit: number = 3) =>
    api.get(`/learning-paths/popular?limit=${limit}`),
  getChapters: (pathId: string) =>
    api.get(`/learning-paths/${pathId}/chapters`),
  getChapter: (pathId: string, chapterId: string) =>
    api.get(`/learning-paths/${pathId}/chapters/${chapterId}`),
  updatePath: (pathId: string, data: any) =>
    api.put(`/learning-paths/${pathId}`, data),
  deletePath: (pathId: string) => api.delete(`/learning-paths/${pathId}`),
};

// Content API
export const contentApi = {
  generate: (data: any) => api.post("/content/generate", data),
  getById: (id: string) => {
    // Validate if the ID looks like a UUID before making the request
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );
    if (!isUuid && !isNaN(Number(id))) {
      console.warn(
        `ID ${id} is not in UUID format, this may cause errors with the backend`
      );
    }
    return api.get(`/content/${id}`);
  },

  /**
   * 流式生成章节内容
   * @param pathId 学习路径ID
   * @param chapterId 章节ID
   * @param onEvent 事件回调函数，用于处理流式响应
   */
  generateStream: (
    pathId: string,
    chapterId: string,
    onEvent: (event: any) => void
  ) => {
    // 使用LLMLogger开始记录API请求
    const requestId = LLMLogger.startRequest({
      type: "api_request_stream",
      endpoint: `/content/generate-stream/${pathId}/${chapterId}`,
      method: "POST",
      url: `${API_URL}/content/generate-stream/${pathId}/${chapterId}`,
    });

    console.log(`[${requestId}] ===== STREAM API REQUEST START =====`);
    console.log(
      `[${requestId}] POST ${API_URL}/content/generate-stream/${pathId}/${chapterId}`
    );
    console.log(`[${requestId}] Request Timestamp:`, new Date().toISOString());

    // 获取认证令牌
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 创建EventSource连接
    console.log(
      `创建SSE连接: ${API_URL}/content/generate-stream/${pathId}/${chapterId}`
    );

    // 注意：我们改为使用GET请求，并且不使用withCredentials，因为它可能与CORS冲突
    const eventSource = new EventSource(
      `${API_URL}/content/generate-stream/${pathId}/${chapterId}`
    );

    // 记录连接开始时间
    const startTime = Date.now();

    // 处理事件
    eventSource.onopen = () => {
      console.log(`[${requestId}] SSE连接已打开`);
      onEvent({
        type: "connection",
        status: "open",
        timestamp: new Date().toISOString(),
      });
    };

    eventSource.onmessage = (event) => {
      try {
        console.log(`[${requestId}] 收到SSE消息:`, event.data);
        const data = JSON.parse(event.data);

        // 使用LLMLogger记录流式响应
        LLMLogger.logResponse(requestId, {
          type: "stream_chunk",
          data,
          timestamp: new Date().toISOString(),
        });

        // 调用回调函数处理事件
        onEvent(data);

        // 如果是完成事件，关闭连接
        if (data.type === "complete") {
          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`[${requestId}] 流式生成完成，总耗时: ${duration}ms`);

          // 结束LLMLogger请求记录
          LLMLogger.endRequest(requestId, {
            status: "success",
            duration,
            responseType: "stream",
            completionType: "normal",
          });

          eventSource.close();
        }
      } catch (error) {
        console.error(`[${requestId}] 解析SSE消息时出错:`, error);

        // 使用LLMLogger记录错误
        LLMLogger.logError(requestId, error, {
          phase: "stream_parsing",
          rawData: event.data,
        });

        onEvent({
          type: "error",
          message: "解析服务器消息时出错",
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
    };

    eventSource.onerror = (error) => {
      console.error(`[${requestId}] SSE连接错误:`, error);

      // 获取更详细的错误信息
      const errorInfo = {
        readyState: eventSource.readyState, // 0: connecting, 1: open, 2: closed
        url: `${API_URL}/content/generate-stream/${pathId}/${chapterId}`,
        timestamp: new Date().toISOString(),
        browserInfo: navigator.userAgent,
        errorObj: error,
      };

      console.error(
        `[${requestId}] SSE连接错误详情:`,
        JSON.stringify(
          errorInfo,
          (key, value) => {
            // 处理循环引用和DOM对象
            if (key === "errorObj" && value instanceof Event) {
              return "[Event Object]";
            }
            return value;
          },
          2
        )
      );

      // 使用LLMLogger记录错误
      LLMLogger.logError(requestId, error, {
        phase: "stream_connection",
        errorInfo,
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "error",
        errorType: "stream_connection_error",
        errorMessage: "EventSource连接错误",
        readyState: eventSource.readyState,
      });

      // 根据readyState提供更具体的错误信息
      let errorMessage = "SSE连接错误";
      if (eventSource.readyState === 0) {
        errorMessage = "SSE连接建立中断，可能是网络问题或服务器未响应";
      } else if (eventSource.readyState === 2) {
        errorMessage = "SSE连接已关闭，可能是服务器主动关闭或连接超时";
      }

      onEvent({
        type: "error",
        message: errorMessage,
        error: error instanceof Event ? "连接中断" : "未知错误",
        readyState: eventSource.readyState,
      });

      // 关闭连接
      eventSource.close();

      // 尝试重新连接（可选）
      // setTimeout(() => {
      //   console.log(`[${requestId}] 尝试重新连接SSE...`);
      //   onEvent({ type: 'status', message: '正在尝试重新连接...' });
      //   contentApi.generateStream(pathId, chapterId, onEvent);
      // }, 3000);
    };

    // 返回一个函数，用于手动关闭连接
    return () => {
      console.log(`[${requestId}] 手动关闭SSE连接`);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "success",
        completionType: "manual_close",
      });

      eventSource.close();
    };
  },
};

// Tutor API
export const tutorApi = {
  chat: (data: any) => api.post("/tutor/chat", data),
  getChatHistory: (userId: string, pathId: string, chapterId: string) =>
    api.get(`/tutor/history/${userId}/${pathId}/${chapterId}`),
  saveChatHistory: (data: any) => api.post("/tutor/history/save", data),
  clearChatHistory: (userId: string, pathId: string, chapterId: string) =>
    api.delete(`/tutor/history/${userId}/${pathId}/${chapterId}`),
  getRecommendedQuestions: (pathId: string, chapterId: string) =>
    api.get(`/tutor/recommended-questions/${pathId}/${chapterId}`),

  // 流式聊天API
  chatStream: (
    data: any,
    onEvent: (event: {
      type: "connection" | "status" | "content_chunk" | "complete" | "error";
      message?: string;
      content?: string;
      requestId?: string;
      error?: string;
      processingTime?: number;
    }) => void
  ) => {
    // 生成请求ID用于日志记录
    const requestId = `stream_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    console.log(`[${requestId}] 开始流式辅导请求`);

    // 创建SSE连接
    const eventSource = new EventSource(`${API_URL}/tutor/chat-stream`, {
      withCredentials: true,
    });

    // 设置连接打开回调
    eventSource.onopen = () => {
      console.log(`[${requestId}] SSE连接已打开`);

      // 发送请求数据
      fetch(`${API_URL}/tutor/chat-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          requestId,
        }),
        credentials: "include",
      }).catch((error) => {
        console.error(`[${requestId}] 发送请求数据失败:`, error);
        onEvent({
          type: "error",
          message: "发送请求数据失败",
          error: error instanceof Error ? error.message : "未知错误",
        });
        eventSource.close();
      });
    };

    // 设置消息接收回调
    eventSource.onmessage = (event) => {
      console.log(
        `[${requestId}] 收到SSE消息:`,
        event.data.substring(0, 50) + (event.data.length > 50 ? "..." : "")
      );

      try {
        const data = JSON.parse(event.data);
        onEvent(data);

        // 如果收到完成或错误事件，关闭连接
        if (data.type === "complete" || data.type === "error") {
          console.log(`[${requestId}] 收到${data.type}事件，关闭SSE连接`);
          eventSource.close();
        }
      } catch (error) {
        console.error(`[${requestId}] 解析SSE消息时出错:`, error);
        onEvent({
          type: "error",
          message: "解析服务器消息时出错",
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
    };

    // 设置错误回调
    eventSource.onerror = (error) => {
      console.error(`[${requestId}] SSE连接错误:`, error);

      onEvent({
        type: "error",
        message: "SSE连接错误",
        error: error instanceof Event ? "连接中断" : "未知错误",
      });

      // 关闭连接
      eventSource.close();
    };

    // 返回一个函数，用于手动关闭连接
    return () => {
      console.log(`[${requestId}] 手动关闭SSE连接`);
      eventSource.close();
    };
  },
};

// Progress API
export const progressApi = {
  update: (data: any) => api.post("/progress/update", data),
  getUserProgress: (userId: string, pathId: string) =>
    api.get(`/progress/${userId}/${pathId}`),
  getUserStats: (userId: string) => api.get(`/progress/stats/${userId}`),
  getPathStats: (userId: string, pathId: string) =>
    api.get(`/progress/path-stats/${userId}/${pathId}`),
  getLearningTimeHistory: (
    userId: string,
    period: "day" | "week" | "month" = "week"
  ) => api.get(`/progress/time-history/${userId}?period=${period}`),
};

// Exercises API
export const exercisesApi = {
  generate: (data: any) => api.post("/exercises/generate", data),
  getChapterExercises: (chapterId: string) =>
    api.get(`/exercises/chapter/${chapterId}`),
};

// Achievements API
export const achievementsApi = {
  getAll: () => api.get("/achievements"),
  getUserAchievements: (userId: string) =>
    api.get(`/achievements/user/${userId}`),
  checkAchievements: (userId: string) =>
    api.post(`/achievements/check/${userId}`, {}),
};

// Streaks API
export const streaksApi = {
  getUserStreak: (userId: string) => api.get(`/streaks/${userId}`),
  updateStreak: (userId: string) => api.post(`/streaks/${userId}/update`, {}),
  getStreakRewards: (userId: string) => api.get(`/streaks/${userId}/rewards`),
  grantStreakReward: (userId: string, rewardId: string) =>
    api.post(`/streaks/${userId}/rewards/${rewardId}/grant`, {}),
};

// Leaderboard API
export const leaderboardApi = {
  getTimeLeaderboard: (
    limit: number = 10,
    period: "week" | "month" | "all" = "week"
  ) => api.get(`/leaderboard/time?limit=${limit}&period=${period}`),
  getCompletionLeaderboard: (limit: number = 10) =>
    api.get(`/leaderboard/completion?limit=${limit}`),
  getStreakLeaderboard: (limit: number = 10) =>
    api.get(`/leaderboard/streak?limit=${limit}`),
  getUserRanking: (
    userId: string,
    type: "time" | "completion" | "streak" = "time",
    period: "week" | "month" | "all" = "week"
  ) => api.get(`/leaderboard/user/${userId}?type=${type}&period=${period}`),
};

// Diagrams API
export const diagramsApi = {
  generate: (data: any) => api.post("/diagrams/generate", data),
  getChapterDiagrams: (chapterId: string) =>
    api.get(`/diagrams/chapter/${chapterId}`),
  generateMindMap: (data: any) => api.post("/diagrams/mindmap", data),
  generateFlowchart: (data: any) => api.post("/diagrams/flowchart", data),
  generateSequence: (data: any) => api.post("/diagrams/sequence", data),
  generateClass: (data: any) => api.post("/diagrams/class", data),
  generatePie: (data: any) => api.post("/diagrams/pie", data),
  generateBar: (data: any) => api.post("/diagrams/bar", data),
  generateAuto: (data: any) => api.post("/diagrams/auto", data),
};
