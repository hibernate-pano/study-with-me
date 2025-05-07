import express from 'express';
import aiService from '../services/aiService';
import LLMLogger from '../utils/LLMLogger';

const router = express.Router();

/**
 * @route POST /api/tutor/chat
 * @desc Get AI response to a question
 * @access Private
 */
router.post('/chat', async (req, res) => {
  // 使用LLMLogger开始记录API请求
  const apiRequestId = LLMLogger.startRequest({
    type: 'api_request',
    endpoint: '/api/tutor/chat',
    method: 'POST',
    ip: req.ip
  });

  console.log(`[${apiRequestId}] ===== TUTOR CHAT API REQUEST START =====`);
  console.log(`[${apiRequestId}] Request URL: /api/tutor/chat (POST)`);
  console.log(`[${apiRequestId}] Request IP: ${req.ip}`);
  console.log(`[${apiRequestId}] Request Headers:`, JSON.stringify(req.headers, null, 2));

  try {
    const { message, context, userId, pathId, chapterId } = req.body;

    // 记录请求体，但不包含敏感信息
    const sanitizedRequestBody = {
      message: message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : undefined,
      userId,
      pathId,
      chapterId,
      context: context ? '(context object present)' : '(missing)'
    };

    console.log(`[${apiRequestId}] Request Body:`, JSON.stringify(sanitizedRequestBody, null, 2));

    // 使用LLMLogger记录请求详情
    LLMLogger.logPrompt(apiRequestId, JSON.stringify(req.body), {
      userId,
      pathId,
      chapterId,
      messageLength: message ? message.length : 0,
      hasContext: !!context
    });

    if (!message || !context) {
      console.log(`[${apiRequestId}] Bad Request: Message or context missing`);

      // 记录错误并结束请求
      LLMLogger.logError(apiRequestId, new Error('Message or context missing'), {
        errorType: 'validation_error',
        missingFields: !message ? 'message' : 'context'
      });

      LLMLogger.endRequest(apiRequestId, {
        status: 'error',
        statusCode: 400,
        errorType: 'validation_error'
      });

      return res.status(400).json({
        message: 'Message and context are required',
        success: false,
        requestId: apiRequestId
      });
    }

    console.log(`[${apiRequestId}] Processing chat request for user ${userId}, path ${pathId}, chapter ${chapterId}`);
    console.log(`[${apiRequestId}] Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

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
    console.log(`[${apiRequestId}] Answer sample: ${answer.substring(0, 200)}${answer.length > 200 ? '...' : ''}`);

    // 使用LLMLogger记录处理后的响应
    LLMLogger.logProcessedContent(apiRequestId, answer, {
      processingDuration,
      responseLength: answer.length,
      containsMarkdown: answer.includes('#') || answer.includes('*') || answer.includes('>')
    });

    // Return consistent response format
    const response = {
      message: answer, // Use 'message' key to match frontend expectation
      success: true,
      requestId: apiRequestId
    };

    console.log(`[${apiRequestId}] Sending response with status 200`);
    console.log(`[${apiRequestId}] ===== TUTOR CHAT API RESPONSE END =====`);

    // 结束LLMLogger请求记录
    LLMLogger.endRequest(apiRequestId, {
      status: 'success',
      statusCode: 200,
      processingDuration,
      responseLength: answer.length
    });

    res.status(200).json(response);
  } catch (error: any) {
    console.error(`[${apiRequestId}] ===== TUTOR CHAT API ERROR =====`);
    console.error(`[${apiRequestId}] Chat API error:`, error);
    console.error(`[${apiRequestId}] Error stack:`, error.stack);
    console.error(`[${apiRequestId}] ===== TUTOR CHAT API ERROR END =====`);

    // 使用LLMLogger记录错误
    LLMLogger.logError(apiRequestId, error, {
      errorPhase: 'api_processing',
      errorType: 'server_error'
    });

    const errorResponse = {
      message: 'Failed to generate response: ' + error.message,
      success: false,
      requestId: apiRequestId,
      error: {
        name: error.name,
        message: error.message
      }
    };

    // 结束LLMLogger请求记录
    LLMLogger.endRequest(apiRequestId, {
      status: 'error',
      statusCode: 500,
      errorType: 'server_error',
      errorMessage: error.message
    });

    res.status(500).json(errorResponse);
  }
});

export = router;
