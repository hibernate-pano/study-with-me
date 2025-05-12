import axios from 'axios';
import config from '../config';
import mermaidService from './mermaidService';
import LLMLogger from '../utils/LLMLogger';

/**
 * Service for interacting with the AI model (deepseek-ai/DeepSeek-V3)
 */
class AIService {
  private apiUrl: string;
  private apiKey: string;
  private modelName: string;

  constructor() {
    this.apiUrl = config.ai.apiUrl;
    this.apiKey = config.ai.apiKey;
    this.modelName = config.ai.modelName;
  }

  /**
   * Generate content using the AI model
   * @param prompt The prompt to send to the AI model
   * @param options Additional options for the API call
   * @returns The generated content
   */
  async generateContent(prompt: string, options: any = {}): Promise<string> {
    // 使用LLMLogger开始记录请求
    const requestId = LLMLogger.startRequest({
      apiUrl: this.apiUrl,
      model: this.modelName,
      options
    });

    console.log(`[${requestId}] ===== AI API REQUEST START =====`);
    try {
      console.log(`[${requestId}] API URL:`, this.apiUrl);
      console.log(`[${requestId}] Model:`, this.modelName);
      console.log(`[${requestId}] API Key (first 5 chars):`, this.apiKey ? this.apiKey.substring(0, 5) + '...' : 'undefined');
      console.log(`[${requestId}] Request Timestamp:`, new Date().toISOString());

      const requestBody = {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant for an educational platform.' },
          { role: 'user', content: prompt }
        ],
        ...options
      };

      // 记录完整的请求内容，但对于长提示词只记录前500个字符
      console.log(`[${requestId}] Request Body (partial):`, JSON.stringify({
        ...requestBody,
        messages: requestBody.messages.map((msg: { role: string, content: string }) => ({
          ...msg,
          content: msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content
        }))
      }, null, 2));

      console.log(`[${requestId}] Full Prompt Length:`, prompt.length);
      console.log(`[${requestId}] Making API call to:`, this.apiUrl);

      // 使用LLMLogger记录提示词
      LLMLogger.logPrompt(requestId, prompt, {
        model: this.modelName,
        temperature: options.temperature,
        maxTokens: options.max_tokens
      });

      // 记录请求开始时间
      const startTime = Date.now();

      // This is a placeholder implementation
      // You'll need to adjust this based on the actual API of 硅基流动
      const response = await axios.post(
        this.apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 60000 // 60秒超时
        }
      );

      // 记录请求耗时
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[${requestId}] ===== AI API RESPONSE START =====`);
      console.log(`[${requestId}] Response Time: ${duration}ms`);
      console.log(`[${requestId}] Response Status:`, response.status);
      console.log(`[${requestId}] Response Headers:`, JSON.stringify(response.headers, null, 2));

      // 记录完整的响应数据结构，但对于长内容只记录部分
      const responseDataStr = JSON.stringify(response.data);
      console.log(`[${requestId}] Response Data Structure:`, Object.keys(response.data));
      console.log(`[${requestId}] Response Data Length:`, responseDataStr.length);
      console.log(`[${requestId}] Response Data Sample:`, responseDataStr.substring(0, 500) + (responseDataStr.length > 500 ? '...' : ''));

      // 使用LLMLogger记录原始响应
      LLMLogger.logResponse(requestId, response.data);

      // 检查响应结构
      if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        console.error(`[${requestId}] Unexpected response structure:`, JSON.stringify(response.data, null, 2));
        LLMLogger.logError(requestId, new Error('Unexpected response structure from AI API'), response.data);
        throw new Error('Unexpected response structure from AI API');
      }

      const content = response.data.choices[0].message.content;
      console.log(`[${requestId}] Extracted Content Length:`, content.length);
      console.log(`[${requestId}] Extracted Content Sample:`, content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      console.log(`[${requestId}] ===== AI API RESPONSE END =====`);

      // 使用LLMLogger记录处理后的内容
      LLMLogger.logProcessedContent(requestId, content, {
        processingMethod: 'direct extraction',
        sourceField: 'choices[0].message.content',
        tokenCount: response.data.usage?.total_tokens || 'unknown'
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'success',
        duration: duration,
        tokenUsage: response.data.usage,
        contentLength: content.length
      });

      // Extract the response content based on the API's response format
      return content;
    } catch (error: any) {
      console.error(`[${requestId}] ===== AI API ERROR =====`);
      console.error(`[${requestId}] Error Name:`, error.name);
      console.error(`[${requestId}] Error Message:`, error.message);
      console.error(`[${requestId}] Error Stack:`, error.stack);

      // 记录详细错误信息
      const errorContext: any = {
        errorType: 'api_call_error',
        errorName: error.name,
        errorMessage: error.message
      };

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`[${requestId}] Error Status:`, error.response.status);
        console.error(`[${requestId}] Error Headers:`, JSON.stringify(error.response.headers, null, 2));
        console.error(`[${requestId}] Error Data:`, JSON.stringify(error.response.data, null, 2));

        errorContext.responseStatus = error.response.status;
        errorContext.responseData = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        console.error(`[${requestId}] Error Request:`, JSON.stringify(error.request, null, 2));
        errorContext.requestInfo = error.request;
        errorContext.errorType = 'network_error';
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(`[${requestId}] Error Config:`, error.config ? JSON.stringify(error.config, null, 2) : 'No config available');
        errorContext.errorType = 'request_setup_error';
      }

      console.error(`[${requestId}] ===== AI API ERROR END =====`);

      // 使用LLMLogger记录错误
      LLMLogger.logError(requestId, error, errorContext);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'error',
        errorType: errorContext.errorType,
        errorMessage: error.message
      });

      throw new Error(`Failed to generate content from AI model: ${error.message}`);
    }
  }

  /**
   * Generate a learning path based on a learning goal
   * @param goal The learning goal
   * @param userLevel The user's current knowledge level
   * @returns The generated learning path
   */
  async generateLearningPath(goal: string, userLevel: string = 'beginner'): Promise<any> {
    const prompt = `
    作为一名教育专家，请为用户创建一个关于"${goal}"的学习路径。
    用户当前水平：${userLevel}
    请提供以下格式的学习路径：
    1. 路径标题
    2. 简短描述
    3. 学习阶段（3-5个）
       - 每个阶段的标题
       - 每个阶段的学习目标
       - 每个阶段包含的章节（3-7个）
         - 章节标题
         - 章节要点（3-5个）

    请以JSON格式返回，结构如下：
    {
      "title": "路径标题",
      "description": "路径描述",
      "stages": [
        {
          "title": "阶段标题",
          "objectives": ["目标1", "目标2"],
          "chapters": [
            {
              "title": "章节标题",
              "keyPoints": ["要点1", "要点2", "要点3"]
            }
          ]
        }
      ]
    }

    非常重要：
    1. 请直接返回有效的JSON格式，不要添加任何其他格式化，如Markdown代码块、前导文本或结尾说明
    2. 不要在JSON中的任何字段内容中包含代码块格式，这会导致解析失败
    3. 所有字段内容应该是纯文本，不包含任何特殊格式标记
    4. 确保返回的是一个可以直接被JSON.parse()解析的字符串
    `;

    const content = await this.generateContent(prompt);

    try {
      // 尝试提取JSON内容（处理各种可能的格式）
      let jsonContent = content;
      console.log('Raw AI response:', content);

      // 1. 检查是否包含Markdown代码块 - 使用更宽松的正则表达式
      // 这个正则表达式可以匹配多种格式的代码块，包括有无语言标识符
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = content.match(jsonBlockRegex);

      if (match && match[1]) {
        console.log('Found JSON in Markdown code block, extracting...');
        jsonContent = match[1].trim();

        // 如果提取的内容不是以 { 开头，尝试在内容中查找 JSON
        if (!jsonContent.trim().startsWith('{')) {
          const innerJsonStart = jsonContent.indexOf('{');
          const innerJsonEnd = jsonContent.lastIndexOf('}');
          if (innerJsonStart !== -1 && innerJsonEnd !== -1 && innerJsonEnd > innerJsonStart) {
            jsonContent = jsonContent.substring(innerJsonStart, innerJsonEnd + 1);
          }
        }
      } else {
        // 2. 尝试查找JSON的开始和结束位置
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}');

        if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
          console.log('Found JSON by brackets, extracting...');
          jsonContent = content.substring(jsonStartIndex, jsonEndIndex + 1);
        }
      }

      // 打印提取的JSON内容
      console.log('Extracted JSON content:', jsonContent.substring(0, 100) + '...');

      // 3. 清理可能的非JSON字符
      jsonContent = jsonContent.trim();

      // 4. 尝试修复常见的JSON格式问题
      // 替换单引号为双引号
      jsonContent = jsonContent.replace(/'/g, '"');

      // 移除可能的尾随逗号
      jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      console.log('Cleaned JSON content:', jsonContent.substring(0, 100) + '...');

      // 5. 尝试解析JSON
      try {
        const parsedJson = JSON.parse(jsonContent);
        console.log('Successfully parsed JSON');

        // 6. 验证JSON结构
        if (!parsedJson.title || !parsedJson.description || !Array.isArray(parsedJson.stages)) {
          console.warn('JSON missing required fields');
          // 创建一个基本的结构以避免错误
          if (!parsedJson.title) parsedJson.title = goal;
          if (!parsedJson.description) parsedJson.description = `关于${goal}的学习路径`;
          if (!Array.isArray(parsedJson.stages)) parsedJson.stages = [];
        }

        return parsedJson;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);

        // 7. 如果解析失败，尝试使用更宽松的方法
        try {
          // 使用Function构造函数尝试解析（注意：这在生产环境中可能有安全风险）
          const relaxedParse = new Function('return ' + jsonContent);
          const result = relaxedParse();
          console.log('Parsed JSON using relaxed method');
          return result;
        } catch (relaxedError: any) {
          throw new Error('Failed to parse JSON with relaxed method: ' + (relaxedError.message || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error processing AI response:', error);
      console.error('Raw content:', content);

      // 8. 如果所有方法都失败，创建一个基本的学习路径
      console.log('Creating fallback learning path');
      return {
        title: `${goal} 学习路径`,
        description: `这是一个关于 ${goal} 的基础学习路径。由于AI生成内容解析错误，这是一个简化版本。`,
        stages: [
          {
            title: "基础阶段",
            objectives: ["了解基本概念", "掌握核心知识"],
            chapters: [
              {
                title: `${goal} 入门`,
                keyPoints: ["基础知识", "核心概念", "实践应用"]
              }
            ]
          }
        ]
      };
    }
  }

  /**
   * Generate chapter content based on a chapter title and key points
   * @param chapterTitle The chapter title
   * @param keyPoints The key points to cover
   * @param onChunk 可选的回调函数，用于流式处理生成的内容块
   * @param includeVisuals 是否包含可视化内容
   * @returns The generated chapter content
   */
  async generateChapterContent(
    chapterTitle: string,
    keyPoints: string[],
    onChunk?: (chunk: string) => void,
    includeVisuals: boolean = true
  ): Promise<any> {
    const prompt = `
    请为章节"${chapterTitle}"创建详细的教学内容。
    需要涵盖以下知识点：
    ${keyPoints.map(point => `- ${point}`).join('\n')}

    请按照以下结构组织内容：
    1. 章节概述（200-300字）
    2. 核心概念解释（针对每个知识点）
    3. 代码示例（如适用）
    4. 实践练习
    5. 常见问题与解答

    请以JSON格式返回，结构如下：
    {
      "summary": "章节概述",
      "concepts": [
        {
          "title": "概念标题",
          "explanation": "概念解释",
          "examples": ["示例1", "示例2"],
          "diagramType": "concept|process|comparison|sequence|class" // 指明这个概念适合什么类型的图表
        }
      ],
      "codeExamples": [
        {
          "title": "示例标题",
          "code": "代码内容",
          "explanation": "代码解释"
        }
      ],
      "exercises": [
        {
          "question": "练习问题",
          "hint": "提示"
        }
      ],
      "faq": [
        {
          "question": "常见问题",
          "answer": "回答"
        }
      ]
    }

    对于每个核心概念，请添加一个diagramType字段，指明这个概念适合什么类型的图表：
    - concept: 适合思维导图、概念图等
    - process: 适合流程图、步骤图等
    - comparison: 适合比较图表、饼图等
    - sequence: 适合时序图、交互图等
    - class: 适合类图、结构图等

    非常重要：
    1. 请直接返回有效的JSON格式，不要添加任何其他格式化，如Markdown代码块、前导文本或结尾说明
    2. 不要在JSON中的任何字段内容中包含代码块格式，这会导致解析失败
    3. 所有字段内容应该是纯文本，不包含任何特殊格式标记
    4. 确保返回的是一个可以直接被JSON.parse()解析的字符串
    5. 代码示例应该作为纯文本字符串，不要使用Markdown代码块格式
    `;

    // 如果提供了onChunk回调，则使用流式生成
    if (onChunk) {
      // 发送初始状态更新
      onChunk(`正在为章节"${chapterTitle}"生成内容...`);

      // 模拟流式生成过程
      // 注意：这里只是模拟，实际实现需要根据您使用的AI API的流式能力来调整
      await new Promise(resolve => setTimeout(resolve, 500));
      onChunk(`已确定章节结构，开始生成章节概述...`);

      await new Promise(resolve => setTimeout(resolve, 1000));
      onChunk(`正在生成核心概念解释，处理知识点: ${keyPoints[0]}...`);

      // 继续生成内容...
    }

    const content = await this.generateContent(prompt);

    try {
      // 如果提供了onChunk回调，发送进度更新
      if (onChunk) {
        onChunk(`内容生成完成，正在处理JSON格式...`);
      }

      // 尝试提取JSON内容（处理可能的Markdown代码块）
      let jsonContent = content;

      // 检查是否包含Markdown代码块 - 使用更宽松的正则表达式
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = content.match(jsonBlockRegex);

      if (match && match[1]) {
        console.log('Found JSON in Markdown code block, extracting...');
        jsonContent = match[1].trim();

        // 如果提取的内容不是以 { 开头，尝试在内容中查找 JSON
        if (!jsonContent.trim().startsWith('{')) {
          const innerJsonStart = jsonContent.indexOf('{');
          const innerJsonEnd = jsonContent.lastIndexOf('}');
          if (innerJsonStart !== -1 && innerJsonEnd !== -1 && innerJsonEnd > innerJsonStart) {
            jsonContent = jsonContent.substring(innerJsonStart, innerJsonEnd + 1);
          }
        }
      }

      console.log('Attempting to parse JSON:', jsonContent.substring(0, 100) + '...');

      // Parse the JSON response
      const chapterContent = JSON.parse(jsonContent);

      // 如果提供了onChunk回调，发送进度更新
      if (onChunk) {
        onChunk(`JSON解析成功，正在生成可视化内容...`);
      }

      // 如果需要包含可视化内容，为每个概念生成可视化
      if (includeVisuals) {
        await this.enrichWithVisualizations(chapterContent);
      }

      // 如果提供了onChunk回调，发送完成消息
      if (onChunk) {
        onChunk(`章节内容生成完成！`);
      }

      return chapterContent;
    } catch (error) {
      console.error('Error parsing AI response as JSON:', error);
      console.error('Raw content:', content);

      // 如果提供了onChunk回调，发送错误消息
      if (onChunk) {
        onChunk(`生成内容时出错: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      throw new Error('AI response is not in valid JSON format');
    }
  }

  /**
   * 为章节内容添加可视化元素
   * @param chapterContent 章节内容
   */
  private async enrichWithVisualizations(chapterContent: any): Promise<void> {
    // 为章节添加可视化内容
    if (!chapterContent.diagrams) {
      chapterContent.diagrams = [];
    }

    // 为每个概念生成图表
    if (chapterContent.concepts && Array.isArray(chapterContent.concepts)) {
      for (const concept of chapterContent.concepts) {
        if (concept.diagramType) {
          try {
            // 生成图表内容
            const diagram = await mermaidService.generateDiagramForContent(
              concept.title,
              concept,
              concept.diagramType
            );

            // 添加到图表列表
            chapterContent.diagrams.push({
              ...diagram,
              conceptTitle: concept.title
            });

            // 在概念中添加图表引用
            concept.diagramRef = diagram.type;
          } catch (error) {
            console.error(`Error generating diagram for concept "${concept.title}":`, error);
            // 继续处理其他概念，不中断流程
          }
        }
      }
    }

    // 为章节概述生成一个总体思维导图
    try {
      const summaryDiagram = await mermaidService.generateDiagramForContent(
        '章节概述',
        chapterContent,
        'concept'
      );

      chapterContent.diagrams.unshift({
        ...summaryDiagram,
        conceptTitle: '章节概述'
      });
    } catch (error) {
      console.error('Error generating summary diagram:', error);
    }
  }



  /**
   * Generate exercises based on chapter content
   * @param chapterContent The chapter content
   * @param difficulty The difficulty level
   * @param count The number of exercises to generate
   * @returns The generated exercises
   */
  async generateExercises(chapterContent: any, difficulty: string = 'medium', count: number = 5): Promise<any> {
    const prompt = `
    作为教育专家，请基于以下学习内容生成${count}道练习题，难度级别为"${difficulty}"。

    章节标题：${chapterContent.title}
    章节概述：${chapterContent.summary}
    核心概念：
    ${chapterContent.concepts.map((concept: any) => `- ${concept.title}: ${concept.explanation.substring(0, 100)}...`).join('\n')}

    请生成多种类型的题目，包括：选择题、判断题、填空题、简答题

    对于每道题目，请提供：
    1. 题目内容
    2. 题目类型
    3. 难度级别
    4. 正确答案
    5. 详细解析

    请以JSON格式返回，结构如下：
    {
      "exercises": [
        {
          "question": "题目内容",
          "type": "multiple_choice|true_false|fill_blank|short_answer",
          "difficulty": "easy|medium|hard",
          "options": ["选项A", "选项B", "选项C", "选项D"],
          "answer": "正确答案",
          "explanation": "解析"
        }
      ]
    }

    非常重要：
    1. 请直接返回有效的JSON格式，不要添加任何其他格式化，如Markdown代码块、前导文本或结尾说明
    2. 不要在JSON中的任何字段内容中包含代码块格式，这会导致解析失败
    3. 所有字段内容应该是纯文本，不包含任何特殊格式标记
    4. 确保返回的是一个可以直接被JSON.parse()解析的字符串
    5. 代码示例应该作为纯文本字符串，不要使用Markdown代码块格式
    `;

    const content = await this.generateContent(prompt);

    try {
      // 尝试提取JSON内容（处理可能的Markdown代码块）
      let jsonContent = content;

      // 检查是否包含Markdown代码块 - 使用更宽松的正则表达式
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = content.match(jsonBlockRegex);

      if (match && match[1]) {
        console.log('Found JSON in Markdown code block, extracting...');
        jsonContent = match[1].trim();

        // 如果提取的内容不是以 { 开头，尝试在内容中查找 JSON
        if (!jsonContent.trim().startsWith('{')) {
          const innerJsonStart = jsonContent.indexOf('{');
          const innerJsonEnd = jsonContent.lastIndexOf('}');
          if (innerJsonStart !== -1 && innerJsonEnd !== -1 && innerJsonEnd > innerJsonStart) {
            jsonContent = jsonContent.substring(innerJsonStart, innerJsonEnd + 1);
          }
        }
      }

      console.log('Attempting to parse JSON:', jsonContent.substring(0, 100) + '...');

      // Parse the JSON response
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing AI response as JSON:', error);
      console.error('Raw content:', content);
      throw new Error('AI response is not in valid JSON format');
    }
  }

  /**
   * Answer a question based on the learning context
   * @param question The user's question
   * @param context The learning context
   * @returns The AI's answer
   */
  async answerQuestion(question: string, context: any): Promise<string> {
    // 使用LLMLogger开始记录请求
    const requestId = LLMLogger.startRequest({
      type: 'tutor_question',
      question,
      contextType: context.chapterTitle ? 'chapter' : 'general'
    });

    console.log(`[${requestId}] ===== AI TUTOR QUESTION START =====`);
    console.log(`[${requestId}] Question:`, question);
    console.log(`[${requestId}] Context:`, JSON.stringify(context, null, 2));

    const prompt = `
    作为AI学习助手，请回答用户关于"${context.chapterTitle || '当前主题'}"的问题。

    用户问题：${question}

    当前学习上下文：
    - 学习路径：${context.pathTitle || '未指定'}
    - 当前章节：${context.chapterTitle || '未指定'}
    - 相关知识点：${context.conceptTitle || '未指定'}

    请基于以下相关知识提供准确、清晰的回答：
    ${context.conceptContent || ''}

    回答要求：
    1. 直接解答问题，使用清晰的语言
    2. 提供具体例子，帮助理解
    3. 如有必要，解释相关概念
    4. 建议下一步学习方向
    5. 使用标准Markdown格式，确保代码块、列表和标题格式正确
    6. 避免使用复杂的HTML或非标准Markdown语法
    7. 确保代码示例使用正确的语法高亮标记（如\`\`\`javascript\`\`\`）
    8. 使用简洁明了的表达方式
    9. 非常重要：请直接返回纯文本回答，不要返回JSON格式

    请注意：你的回答将直接显示在学习平台上，不需要额外的格式化或包装。请确保回答是完整且独立的。
    `;

    console.log(`[${requestId}] Prompt Length:`, prompt.length);
    console.log(`[${requestId}] Prompt Sample:`, prompt.substring(0, 200) + '...');

    // 使用LLMLogger记录提示词
    LLMLogger.logPrompt(requestId, prompt, {
      questionType: 'tutor',
      chapterTitle: context.chapterTitle,
      pathTitle: context.pathTitle
    });

    try {
      // 记录处理开始时间
      const processingStartTime = Date.now();

      // Get the raw response from the AI
      console.log(`[${requestId}] Calling generateContent...`);
      const rawResponse = await this.generateContent(prompt);

      console.log(`[${requestId}] ===== AI TUTOR RESPONSE PROCESSING START =====`);
      console.log(`[${requestId}] Raw Response Length:`, rawResponse.length);
      console.log(`[${requestId}] Raw Response Sample:`, rawResponse.substring(0, 500) + (rawResponse.length > 500 ? '...' : ''));
      console.log(`[${requestId}] Raw Response First 20 chars:`, JSON.stringify(rawResponse.substring(0, 20)));
      console.log(`[${requestId}] Raw Response Last 20 chars:`, JSON.stringify(rawResponse.substring(rawResponse.length - 20)));

      // 使用LLMLogger记录原始响应
      LLMLogger.logResponse(requestId, rawResponse);

      // 记录处理步骤
      const processingSteps: any[] = [];

      // Clean up the response to ensure it's valid markdown
      // Remove any potential JSON formatting or code blocks that might be wrapping the entire response
      let cleanResponse = rawResponse;

      // Remove any JSON-like wrapping if present
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = rawResponse.match(jsonBlockRegex);
      if (match && match[0] === rawResponse.trim()) {
        console.log(`[${requestId}] Found JSON code block, extracting content`);
        cleanResponse = match[1].trim();
        console.log(`[${requestId}] Extracted content length:`, cleanResponse.length);
        console.log(`[${requestId}] Extracted content sample:`, cleanResponse.substring(0, 200) + '...');

        processingSteps.push({
          step: 'extract_from_code_block',
          pattern: 'code block with triple backticks',
          success: true,
          resultLength: cleanResponse.length
        });
      }

      // If the response looks like it might be JSON but isn't wrapped in code blocks
      if (rawResponse.trim().startsWith('{') && rawResponse.trim().endsWith('}')) {
        console.log(`[${requestId}] Response appears to be JSON, attempting to parse`);
        try {
          // Try to parse it as JSON
          const jsonObj = JSON.parse(rawResponse);
          console.log(`[${requestId}] Successfully parsed as JSON:`, JSON.stringify(Object.keys(jsonObj)));

          processingSteps.push({
            step: 'parse_json',
            success: true,
            fields: Object.keys(jsonObj)
          });

          // If it has a content or text field, use that
          let fieldUsed = null;
          if (jsonObj.content) {
            console.log(`[${requestId}] Using 'content' field from JSON`);
            cleanResponse = jsonObj.content;
            fieldUsed = 'content';
          } else if (jsonObj.text) {
            console.log(`[${requestId}] Using 'text' field from JSON`);
            cleanResponse = jsonObj.text;
            fieldUsed = 'text';
          } else if (jsonObj.answer) {
            console.log(`[${requestId}] Using 'answer' field from JSON`);
            cleanResponse = jsonObj.answer;
            fieldUsed = 'answer';
          } else if (jsonObj.message) {
            console.log(`[${requestId}] Using 'message' field from JSON`);
            cleanResponse = jsonObj.message;
            fieldUsed = 'message';
          } else {
            // Otherwise stringify it nicely
            console.log(`[${requestId}] No recognized field found, stringifying entire JSON`);
            cleanResponse = JSON.stringify(jsonObj, null, 2);
            fieldUsed = 'full_json_stringify';
          }

          processingSteps.push({
            step: 'extract_field',
            field: fieldUsed,
            success: true,
            resultLength: cleanResponse.length
          });
        } catch (e) {
          // Not valid JSON, keep the original response
          console.log(`[${requestId}] Response looked like JSON but failed to parse:`, e);
          console.log(`[${requestId}] Keeping original response`);

          processingSteps.push({
            step: 'parse_json',
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error'
          });
        }
      }

      // 记录处理结束时间和总耗时
      const processingEndTime = Date.now();
      const processingDuration = processingEndTime - processingStartTime;

      console.log(`[${requestId}] Final cleaned response length:`, cleanResponse.length);
      console.log(`[${requestId}] Final cleaned response sample:`, cleanResponse.substring(0, 200) + '...');
      console.log(`[${requestId}] Processing time: ${processingDuration}ms`);
      console.log(`[${requestId}] ===== AI TUTOR RESPONSE PROCESSING END =====`);

      // 使用LLMLogger记录处理后的内容
      LLMLogger.logProcessedContent(requestId, cleanResponse, {
        processingSteps,
        processingDuration,
        originalLength: rawResponse.length,
        processedLength: cleanResponse.length,
        containsCodeBlocks: cleanResponse.includes('```'),
        containsMarkdown: cleanResponse.includes('#') || cleanResponse.includes('*') || cleanResponse.includes('>')
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'success',
        processingDuration,
        responseLength: cleanResponse.length,
        question: {
          length: question.length,
          type: 'tutor'
        }
      });

      return cleanResponse;
    } catch (error: any) {
      console.error(`[${requestId}] ===== AI TUTOR ERROR =====`);
      console.error(`[${requestId}] Error in answerQuestion:`, error);
      console.error(`[${requestId}] Error stack:`, error.stack);
      console.error(`[${requestId}] ===== AI TUTOR ERROR END =====`);

      // 使用LLMLogger记录错误
      LLMLogger.logError(requestId, error, {
        errorPhase: 'tutor_response_processing',
        question,
        context: {
          chapterTitle: context.chapterTitle,
          pathTitle: context.pathTitle
        }
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: 'error',
        errorMessage: error.message,
        errorType: error.name || 'Unknown'
      });

      return '抱歉，我无法回答这个问题。请尝试重新表述或询问其他问题。错误信息：' + error.message;
    }
  }
}

export default new AIService();
