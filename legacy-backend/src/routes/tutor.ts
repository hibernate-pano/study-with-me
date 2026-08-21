import express from "express";
import aiService from "../services/aiService";
import LLMLogger from "../utils/LLMLogger";

const router = express.Router();

/**
 * @route POST /api/tutor/chat
 * @desc Get AI response to a question
 * @access Private
 */
router.post("/chat", async (req, res) => {
  // 使用LLMLogger开始记录API请求
  const apiRequestId = LLMLogger.startRequest({
    type: "api_request",
    endpoint: "/api/tutor/chat",
    method: "POST",
    ip: req.ip,
  });

  console.log(`[${apiRequestId}] ===== TUTOR CHAT API REQUEST START =====`);
  console.log(`[${apiRequestId}] Request URL: /api/tutor/chat (POST)`);
  console.log(`[${apiRequestId}] Request IP: ${req.ip}`);
  console.log(
    `[${apiRequestId}] Request Headers:`,
    JSON.stringify(req.headers, null, 2)
  );

  try {
    const { message, context, userId, pathId, chapterId } = req.body;

    // 记录请求体，但不包含敏感信息
    const sanitizedRequestBody = {
      message: message
        ? message.length > 100
          ? message.substring(0, 100) + "..."
          : message
        : undefined,
      userId,
      pathId,
      chapterId,
      context: context ? "(context object present)" : "(missing)",
    };

    console.log(
      `[${apiRequestId}] Request Body:`,
      JSON.stringify(sanitizedRequestBody, null, 2)
    );

    // 使用LLMLogger记录请求详情
    LLMLogger.logPrompt(apiRequestId, JSON.stringify(req.body), {
      userId,
      pathId,
      chapterId,
      messageLength: message ? message.length : 0,
      hasContext: !!context,
    });

    if (!message || !context) {
      console.log(`[${apiRequestId}] Bad Request: Message or context missing`);

      // 记录错误并结束请求
      LLMLogger.logError(
        apiRequestId,
        new Error("Message or context missing"),
        {
          errorType: "validation_error",
          missingFields: !message ? "message" : "context",
        }
      );

      LLMLogger.endRequest(apiRequestId, {
        status: "error",
        statusCode: 400,
        errorType: "validation_error",
      });

      return res.status(400).json({
        message: "Message and context are required",
        success: false,
        requestId: apiRequestId,
      });
    }

    console.log(
      `[${apiRequestId}] Processing chat request for user ${userId}, path ${pathId}, chapter ${chapterId}`
    );
    console.log(
      `[${apiRequestId}] Message: ${message.substring(0, 100)}${
        message.length > 100 ? "..." : ""
      }`
    );

    // 记录处理开始时间
    const processingStartTime = Date.now();

    // Get AI response
    console.log(`[${apiRequestId}] Calling aiService.answerQuestion...`);
    const answer = await aiService.answerQuestion(message, context);

    // 记录处理结束时间和总耗时
    const processingEndTime = Date.now();
    const processingDuration = processingEndTime - processingStartTime;

    console.log(`[${apiRequestId}] ===== TUTOR CHAT API RESPONSE START =====`);
    console.log(`[${apiRequestId}] Processing Time: ${processingDuration}ms`);
    console.log(`[${apiRequestId}] Answer received, length: ${answer.length}`);
    console.log(
      `[${apiRequestId}] Answer sample: ${answer.substring(0, 200)}${
        answer.length > 200 ? "..." : ""
      }`
    );

    // 使用LLMLogger记录处理后的响应
    LLMLogger.logProcessedContent(apiRequestId, answer, {
      processingDuration,
      responseLength: answer.length,
      containsMarkdown:
        answer.includes("#") || answer.includes("*") || answer.includes(">"),
    });

    // Return consistent response format
    const response = {
      message: answer, // Use 'message' key to match frontend expectation
      success: true,
      requestId: apiRequestId,
    };

    console.log(`[${apiRequestId}] Sending response with status 200`);
    console.log(`[${apiRequestId}] ===== TUTOR CHAT API RESPONSE END =====`);

    // 结束LLMLogger请求记录
    LLMLogger.endRequest(apiRequestId, {
      status: "success",
      statusCode: 200,
      processingDuration,
      responseLength: answer.length,
    });

    res.status(200).json(response);
  } catch (error: any) {
    console.error(`[${apiRequestId}] ===== TUTOR CHAT API ERROR =====`);
    console.error(`[${apiRequestId}] Chat API error:`, error);
    console.error(`[${apiRequestId}] Error stack:`, error.stack);
    console.error(`[${apiRequestId}] ===== TUTOR CHAT API ERROR END =====`);

    // 使用LLMLogger记录错误
    LLMLogger.logError(apiRequestId, error, {
      errorPhase: "api_processing",
      errorType: "server_error",
    });

    const errorResponse = {
      message: "Failed to generate response: " + error.message,
      success: false,
      requestId: apiRequestId,
      error: {
        name: error.name,
        message: error.message,
      },
    };

    // 结束LLMLogger请求记录
    LLMLogger.endRequest(apiRequestId, {
      status: "error",
      statusCode: 500,
      errorType: "server_error",
      errorMessage: error.message,
    });

    res.status(500).json(errorResponse);
  }
});

/**
 * @route POST /api/tutor/chat-stream
 * @desc Get AI response to a question with streaming
 * @access Private
 */
router.post("/chat-stream", async (req, res) => {
  // 使用LLMLogger开始记录API请求
  const apiRequestId = LLMLogger.startRequest({
    type: "api_request_stream",
    endpoint: "/api/tutor/chat-stream",
    method: "POST",
    ip: req.ip,
  });

  console.log(
    `[${apiRequestId}] ===== TUTOR CHAT STREAM API REQUEST START =====`
  );
  console.log(`[${apiRequestId}] Request URL: /api/tutor/chat-stream (POST)`);
  console.log(`[${apiRequestId}] Request IP: ${req.ip}`);

  // 设置SSE响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 禁用Nginx缓冲

  // 发送初始连接成功事件
  res.write(
    `data: ${JSON.stringify({
      type: "connection",
      status: "open",
      requestId: apiRequestId,
    })}\n\n`
  );

  try {
    const { message, context, userId, pathId, chapterId } = req.body;

    // 记录请求体，但不包含敏感信息
    const sanitizedRequestBody = {
      message: message
        ? message.length > 100
          ? message.substring(0, 100) + "..."
          : message
        : undefined,
      userId,
      pathId,
      chapterId,
      context: context ? "(context object present)" : "(missing)",
    };

    console.log(
      `[${apiRequestId}] Request Body:`,
      JSON.stringify(sanitizedRequestBody, null, 2)
    );

    // 使用LLMLogger记录请求详情
    LLMLogger.logPrompt(apiRequestId, JSON.stringify(req.body), {
      userId,
      pathId,
      chapterId,
      messageLength: message ? message.length : 0,
      hasContext: !!context,
      streamMode: true,
    });

    if (!message || !context) {
      console.log(`[${apiRequestId}] Bad Request: Message or context missing`);

      // 记录错误并结束请求
      LLMLogger.logError(
        apiRequestId,
        new Error("Message or context missing"),
        {
          errorType: "validation_error",
          missingFields: !message ? "message" : "context",
        }
      );

      // 发送错误事件
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Message and context are required",
          requestId: apiRequestId,
        })}\n\n`
      );

      // 结束请求
      LLMLogger.endRequest(apiRequestId, {
        status: "error",
        statusCode: 400,
        errorType: "validation_error",
      });

      return res.end();
    }

    console.log(
      `[${apiRequestId}] Processing streaming chat request for user ${userId}, path ${pathId}, chapter ${chapterId}`
    );

    // 记录处理开始时间
    const processingStartTime = Date.now();

    // 发送状态更新事件
    res.write(
      `data: ${JSON.stringify({
        type: "status",
        message: "正在处理您的问题...",
        requestId: apiRequestId,
      })}\n\n`
    );

    // 创建流式响应处理函数
    const handleStreamChunk = (chunk: string) => {
      // 发送内容块事件
      res.write(
        `data: ${JSON.stringify({
          type: "content_chunk",
          content: chunk,
          requestId: apiRequestId,
        })}\n\n`
      );

      // 使用LLMLogger记录流式响应块
      LLMLogger.logResponse(apiRequestId, {
        type: "stream_chunk",
        content: chunk,
        timestamp: new Date().toISOString(),
      });
    };

    try {
      // 调用AI服务的流式回答方法
      await aiService.answerQuestionStream(message, context, handleStreamChunk);

      // 记录处理结束时间和总耗时
      const processingEndTime = Date.now();
      const processingDuration = processingEndTime - processingStartTime;

      console.log(
        `[${apiRequestId}] ===== TUTOR CHAT STREAM API COMPLETE =====`
      );
      console.log(`[${apiRequestId}] Processing Time: ${processingDuration}ms`);

      // 发送完成事件
      res.write(
        `data: ${JSON.stringify({
          type: "complete",
          message: "回答已完成",
          requestId: apiRequestId,
          processingTime: processingDuration,
        })}\n\n`
      );

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(apiRequestId, {
        status: "success",
        statusCode: 200,
        processingDuration,
        streamMode: true,
      });

      // 结束响应
      res.end();
    } catch (streamError: any) {
      console.error(`[${apiRequestId}] Stream processing error:`, streamError);

      // 使用LLMLogger记录流处理错误
      LLMLogger.logError(apiRequestId, streamError, {
        errorPhase: "stream_processing",
        errorType: "stream_error",
      });

      // 发送错误事件
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "处理您的问题时出错: " + streamError.message,
          requestId: apiRequestId,
        })}\n\n`
      );

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(apiRequestId, {
        status: "error",
        statusCode: 500,
        errorType: "stream_error",
        errorMessage: streamError.message,
      });

      // 结束响应
      res.end();
    }
  } catch (error: any) {
    console.error(`[${apiRequestId}] ===== TUTOR CHAT STREAM API ERROR =====`);
    console.error(`[${apiRequestId}] Chat stream API error:`, error);
    console.error(`[${apiRequestId}] Error stack:`, error.stack);

    // 使用LLMLogger记录错误
    LLMLogger.logError(apiRequestId, error, {
      errorPhase: "api_setup",
      errorType: "server_error",
    });

    // 尝试发送错误事件
    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "服务器错误: " + error.message,
          requestId: apiRequestId,
        })}\n\n`
      );
    } catch (writeError) {
      console.error(
        `[${apiRequestId}] Failed to write error event:`,
        writeError
      );
    }

    // 结束LLMLogger请求记录
    LLMLogger.endRequest(apiRequestId, {
      status: "error",
      statusCode: 500,
      errorType: "server_error",
      errorMessage: error.message,
    });

    // 结束响应
    try {
      res.end();
    } catch (endError) {
      console.error(`[${apiRequestId}] Failed to end response:`, endError);
    }
  }
});

export = router;
