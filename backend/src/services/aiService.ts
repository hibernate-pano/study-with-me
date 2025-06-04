import axios from "axios";
import config from "../config";
import mermaidService from "./mermaidService";
import LLMLogger from "../utils/LLMLogger";

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
      options,
    });

    console.log(`[${requestId}] ===== AI API REQUEST START =====`);
    try {
      console.log(`[${requestId}] API URL:`, this.apiUrl);
      console.log(`[${requestId}] Model:`, this.modelName);
      console.log(
        `[${requestId}] API Key (first 5 chars):`,
        this.apiKey ? this.apiKey.substring(0, 5) + "..." : "undefined"
      );
      console.log(
        `[${requestId}] Request Timestamp:`,
        new Date().toISOString()
      );

      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant for an educational platform.",
          },
          { role: "user", content: prompt },
        ],
        ...options,
      };

      // 记录完整的请求内容，但对于长提示词只记录前500个字符
      console.log(
        `[${requestId}] Request Body (partial):`,
        JSON.stringify(
          {
            ...requestBody,
            messages: requestBody.messages.map(
              (msg: { role: string; content: string }) => ({
                ...msg,
                content:
                  msg.content.length > 500
                    ? msg.content.substring(0, 500) + "..."
                    : msg.content,
              })
            ),
          },
          null,
          2
        )
      );

      console.log(`[${requestId}] Full Prompt Length:`, prompt.length);
      console.log(`[${requestId}] Making API call to:`, this.apiUrl);

      // 使用LLMLogger记录提示词
      LLMLogger.logPrompt(requestId, prompt, {
        model: this.modelName,
        temperature: options.temperature,
        maxTokens: options.max_tokens,
      });

      // 记录请求开始时间
      const startTime = Date.now();

      // This is a placeholder implementation
      // You'll need to adjust this based on the actual API of 硅基流动
      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 60000, // 60秒超时
      });

      // 记录请求耗时
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[${requestId}] ===== AI API RESPONSE START =====`);
      console.log(`[${requestId}] Response Time: ${duration}ms`);
      console.log(`[${requestId}] Response Status:`, response.status);
      console.log(
        `[${requestId}] Response Headers:`,
        JSON.stringify(response.headers, null, 2)
      );

      // 记录完整的响应数据结构，但对于长内容只记录部分
      const responseDataStr = JSON.stringify(response.data);
      console.log(
        `[${requestId}] Response Data Structure:`,
        Object.keys(response.data)
      );
      console.log(
        `[${requestId}] Response Data Length:`,
        responseDataStr.length
      );
      console.log(
        `[${requestId}] Response Data Sample:`,
        responseDataStr.substring(0, 500) +
          (responseDataStr.length > 500 ? "..." : "")
      );

      // 使用LLMLogger记录原始响应
      LLMLogger.logResponse(requestId, response.data);

      // 检查响应结构
      if (
        !response.data.choices ||
        !response.data.choices[0] ||
        !response.data.choices[0].message
      ) {
        console.error(
          `[${requestId}] Unexpected response structure:`,
          JSON.stringify(response.data, null, 2)
        );
        LLMLogger.logError(
          requestId,
          new Error("Unexpected response structure from AI API"),
          response.data
        );
        throw new Error("Unexpected response structure from AI API");
      }

      const content = response.data.choices[0].message.content;
      console.log(`[${requestId}] Extracted Content Length:`, content.length);
      console.log(
        `[${requestId}] Extracted Content Sample:`,
        content.substring(0, 500) + (content.length > 500 ? "..." : "")
      );
      console.log(`[${requestId}] ===== AI API RESPONSE END =====`);

      // 使用LLMLogger记录处理后的内容
      LLMLogger.logProcessedContent(requestId, content, {
        processingMethod: "direct extraction",
        sourceField: "choices[0].message.content",
        tokenCount: response.data.usage?.total_tokens || "unknown",
      });

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "success",
        duration: duration,
        tokenUsage: response.data.usage,
        contentLength: content.length,
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
        errorType: "api_call_error",
        errorName: error.name,
        errorMessage: error.message,
      };

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`[${requestId}] Error Status:`, error.response.status);
        console.error(
          `[${requestId}] Error Headers:`,
          JSON.stringify(error.response.headers, null, 2)
        );
        console.error(
          `[${requestId}] Error Data:`,
          JSON.stringify(error.response.data, null, 2)
        );

        errorContext.responseStatus = error.response.status;
        errorContext.responseData = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        console.error(
          `[${requestId}] Error Request:`,
          JSON.stringify(error.request, null, 2)
        );
        errorContext.requestInfo = error.request;
        errorContext.errorType = "network_error";
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(
          `[${requestId}] Error Config:`,
          error.config
            ? JSON.stringify(error.config, null, 2)
            : "No config available"
        );
        errorContext.errorType = "request_setup_error";
      }

      console.error(`[${requestId}] ===== AI API ERROR END =====`);

      // 使用LLMLogger记录错误
      LLMLogger.logError(requestId, error, errorContext);

      // 结束LLMLogger请求记录
      LLMLogger.endRequest(requestId, {
        status: "error",
        errorType: errorContext.errorType,
        errorMessage: error.message,
      });

      throw new Error(
        `Failed to generate content from AI model: ${error.message}`
      );
    }
  }

  /**
   * Generate a learning path based on a learning goal
   * @param goal The learning goal
   * @param userLevel The user's current knowledge level
   * @returns The generated learning path
   */
  async generateLearningPath(
    goal: string,
    userLevel: string = "beginner"
  ): Promise<any> {
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
      console.log("Raw AI response:", content);

      // 1. 检查是否包含Markdown代码块 - 使用更宽松的正则表达式
      // 这个正则表达式可以匹配多种格式的代码块，包括有无语言标识符
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = content.match(jsonBlockRegex);

      if (match && match[1]) {
        console.log("Found JSON in Markdown code block, extracting...");
        jsonContent = match[1].trim();

        // 如果提取的内容不是以 { 开头，尝试在内容中查找 JSON
        if (!jsonContent.trim().startsWith("{")) {
          const innerJsonStart = jsonContent.indexOf("{");
          const innerJsonEnd = jsonContent.lastIndexOf("}");
          if (
            innerJsonStart !== -1 &&
            innerJsonEnd !== -1 &&
            innerJsonEnd > innerJsonStart
          ) {
            jsonContent = jsonContent.substring(
              innerJsonStart,
              innerJsonEnd + 1
            );
          }
        }
      } else {
        // 2. 尝试查找JSON的开始和结束位置
        const jsonStartIndex = content.indexOf("{");
        const jsonEndIndex = content.lastIndexOf("}");

        if (
          jsonStartIndex !== -1 &&
          jsonEndIndex !== -1 &&
          jsonEndIndex > jsonStartIndex
        ) {
          console.log("Found JSON by brackets, extracting...");
          jsonContent = content.substring(jsonStartIndex, jsonEndIndex + 1);
        }
      }

      // 打印提取的JSON内容
      console.log(
        "Extracted JSON content:",
        jsonContent.substring(0, 100) + "..."
      );

      // 3. 清理可能的非JSON字符
      jsonContent = jsonContent.trim();

      // 4. 尝试修复常见的JSON格式问题
      // 替换单引号为双引号
      jsonContent = jsonContent.replace(/'/g, '"');

      // 移除可能的尾随逗号
      jsonContent = jsonContent.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

      console.log(
        "Cleaned JSON content:",
        jsonContent.substring(0, 100) + "..."
      );

      // 5. 尝试解析JSON
      try {
        const parsedJson = JSON.parse(jsonContent);
        console.log("Successfully parsed JSON");

        // 6. 验证JSON结构
        if (
          !parsedJson.title ||
          !parsedJson.description ||
          !Array.isArray(parsedJson.stages)
        ) {
          console.warn("JSON missing required fields");
          // 创建一个基本的结构以避免错误
          if (!parsedJson.title) parsedJson.title = goal;
          if (!parsedJson.description)
            parsedJson.description = `关于${goal}的学习路径`;
          if (!Array.isArray(parsedJson.stages)) parsedJson.stages = [];
        }

        return parsedJson;
      } catch (parseError) {
        console.error("JSON parse error:", parseError);

        // 7. 如果解析失败，尝试使用更宽松的方法
        try {
          // 使用Function构造函数尝试解析（注意：这在生产环境中可能有安全风险）
          const relaxedParse = new Function("return " + jsonContent);
          const result = relaxedParse();
          console.log("Parsed JSON using relaxed method");
          return result;
        } catch (relaxedError: any) {
          throw new Error(
            "Failed to parse JSON with relaxed method: " +
              (relaxedError.message || "Unknown error")
          );
        }
      }
    } catch (error) {
      console.error("Error processing AI response:", error);
      console.error("Raw content:", content);

      // 8. 如果所有方法都失败，创建一个基本的学习路径
      console.log("Creating fallback learning path");
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
                keyPoints: ["基础知识", "核心概念", "实践应用"],
              },
            ],
          },
        ],
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
    ${keyPoints.map((point) => `- ${point}`).join("\\n")}

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
      await new Promise((resolve) => setTimeout(resolve, 500));
      onChunk(`已确定章节结构，开始生成章节概述...`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      onChunk(`正在生成核心概念解释，处理知识点: ${keyPoints[0]}...`);
    }

    let content = "";
    try {
      content = await this.generateContent(prompt);

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
        console.log("Found JSON in Markdown code block, extracting...");
        jsonContent = match[1].trim();

        // 如果提取的内容不是以 { 开头，尝试在内容中查找 JSON
        if (!jsonContent.trim().startsWith("{")) {
          const innerJsonStart = jsonContent.indexOf("{");
          const innerJsonEnd = jsonContent.lastIndexOf("}");
          if (
            innerJsonStart !== -1 &&
            innerJsonEnd !== -1 &&
            innerJsonEnd > innerJsonStart
          ) {
            jsonContent = jsonContent.substring(
              innerJsonStart,
              innerJsonEnd + 1
            );
          }
        }
      } else {
        // 如果没有找到代码块，尝试直接在内容中查找JSON对象
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          console.log("Extracting JSON directly from content...");
          jsonContent = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      console.log(
        "Attempting to parse JSON:",
        jsonContent.substring(0, 100) + "..."
      );

      try {
        // 尝试解析JSON
        const chapterContent = JSON.parse(jsonContent);

        // 验证JSON结构
        if (
          !chapterContent.summary ||
          !Array.isArray(chapterContent.concepts)
        ) {
          console.error("Invalid chapter content structure:", chapterContent);
          throw new Error("章节内容结构无效");
        }

        // 确保每个概念都有必要的字段
        if (chapterContent.concepts) {
          chapterContent.concepts = chapterContent.concepts.map(
            (concept: any) => {
              if (!concept.diagramType) {
                concept.diagramType = "concept"; // 默认图表类型
              }
              if (!Array.isArray(concept.examples)) {
                concept.examples = [];
              }
              return concept;
            }
          );
        }

        // 确保其他字段存在
        if (!Array.isArray(chapterContent.codeExamples)) {
          chapterContent.codeExamples = [];
        }

        if (!Array.isArray(chapterContent.exercises)) {
          chapterContent.exercises = [];
        }

        if (!Array.isArray(chapterContent.faq)) {
          chapterContent.faq = [];
        }

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
      } catch (parseError) {
        console.error("Error parsing AI response as JSON:", parseError);

        // 尝试修复常见的JSON格式问题
        let fixedJson = jsonContent;
        // 替换不正确的引号
        fixedJson = fixedJson.replace(/[']/g, '"');
        // 替换多余的逗号（如数组或对象末尾的逗号）
        fixedJson = fixedJson.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

        try {
          const chapterContent = JSON.parse(fixedJson);
          console.log("Successfully parsed JSON after fixing format issues");

          // 如果提供了onChunk回调，发送进度更新
          if (onChunk) {
            onChunk(`JSON格式修复成功，正在生成可视化内容...`);
          }

          // 如果需要包含可视化内容，为每个概念生成可视化
          if (includeVisuals) {
            await this.enrichWithVisualizations(chapterContent);
          }

          return chapterContent;
        } catch (fixError) {
          console.error("Failed to fix and parse JSON:", fixError);
          console.error("Raw content:", content);

          // 如果提供了onChunk回调，发送错误消息
          if (onChunk) {
            onChunk(
              `生成内容时出错: ${
                parseError instanceof Error ? parseError.message : "未知错误"
              }`
            );
          }

          // 创建一个基本的章节内容作为后备方案
          const fallbackContent = {
            summary: `本章节"${chapterTitle}"将介绍以下知识点：${keyPoints.join(
              "、"
            )}`,
            concepts: keyPoints.map((point) => ({
              title: point,
              explanation: `关于"${point}"的详细解释将在这里展开。`,
              examples: [],
              diagramType: "concept",
            })),
            codeExamples: [],
            exercises: [],
            faq: [],
          };

          return fallbackContent;
        }
      }
    } catch (error) {
      console.error("Error generating chapter content:", error);
      console.error("Raw content:", content);

      // 如果提供了onChunk回调，发送错误消息
      if (onChunk) {
        onChunk(
          `生成内容时出错: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
      }

      // 返回一个更结构化的错误响应
      return {
        summary: `无法生成章节概述（错误：${
          error instanceof Error ? error.message : "未知错误"
        }）`,
        concepts: keyPoints.map((point, index) => ({
          title: `概念 ${index + 1}: ${point}`,
          explanation: `无法生成关于"${point}"的概念解释`,
          examples: [],
          diagramType: "concept",
        })),
        codeExamples: [],
        exercises: [],
        faq: [],
      };
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
              conceptTitle: concept.title,
            });

            // 在概念中添加图表引用
            concept.diagramRef = diagram.type;
          } catch (error) {
            console.error(
              `Error generating diagram for concept "${concept.title}":`,
              error
            );
            // 继续处理其他概念，不中断流程
          }
        }
      }
    }

    // 为章节概述生成一个总体思维导图
    try {
      const summaryDiagram = await mermaidService.generateDiagramForContent(
        "章节概述",
        chapterContent,
        "concept"
      );

      chapterContent.diagrams.unshift({
        ...summaryDiagram,
        conceptTitle: "章节概述",
      });
    } catch (error) {
      console.error("Error generating summary diagram:", error);
    }
  }

  /**
   * 回答问题，支持上下文
   * @param question 问题
   * @param context 上下文信息
   * @returns 回答
   */
  async answerQuestion(question: string, context: any): Promise<string> {
    // 构建提示词
    const prompt = this.buildTutorPrompt(question, context);

    // 调用AI生成内容
    const answer = await this.generateContent(prompt, {
      temperature: 0.7,
      max_tokens: 1500,
    });

    return answer;
  }

  /**
   * 流式回答问题，支持上下文
   * @param question 问题
   * @param context 上下文信息
   * @param onChunk 处理流式响应块的回调函数
   * @returns Promise<void>
   */
  async answerQuestionStream(
    question: string,
    context: any,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // 构建提示词
    const prompt = this.buildTutorPrompt(question, context);

    // 调用AI生成流式内容
    await this.generateContentStream(prompt, onChunk, {
      temperature: 0.7,
      max_tokens: 1500,
    });
  }

  /**
   * 构建辅导提示词
   * @param question 问题
   * @param context 上下文信息
   * @returns 完整的提示词
   */
  private buildTutorPrompt(question: string, context: any): string {
    // 提取上下文信息
    const { chapterTitle, chapterContent, learningPath, previousMessages } =
      context;

    // 构建提示词
    let prompt = `你是一位AI学习辅导助手，正在帮助学生学习"${
      learningPath?.title || "未知学习路径"
    }"中的"${chapterTitle || "未知章节"}"内容。
请根据以下章节内容和学生的问题，提供专业、准确、有帮助的回答。

章节内容概要：
${chapterContent?.summary || "无章节概要"}

`;

    // 添加核心概念
    if (chapterContent?.concepts && chapterContent.concepts.length > 0) {
      prompt += "核心概念：\n";
      chapterContent.concepts.forEach((concept: any, index: number) => {
        prompt += `${index + 1}. ${
          concept.title
        }: ${concept.explanation.substring(0, 200)}${
          concept.explanation.length > 200 ? "..." : ""
        }\n`;
      });
      prompt += "\n";
    }

    // 添加代码示例
    if (
      chapterContent?.codeExamples &&
      chapterContent.codeExamples.length > 0
    ) {
      prompt += "代码示例参考：\n";
      chapterContent.codeExamples.forEach((example: any, index: number) => {
        prompt += `示例${index + 1}: ${example.title}\n`;
      });
      prompt += "\n";
    }

    // 添加之前的对话历史
    if (previousMessages && previousMessages.length > 0) {
      prompt += "之前的对话：\n";
      previousMessages.slice(-5).forEach((msg: any) => {
        prompt += `${msg.role === "user" ? "学生" : "助手"}: ${msg.content}\n`;
      });
      prompt += "\n";
    }

    // 添加学生的问题
    prompt += `学生的问题：${question}\n\n`;

    // 添加回答指导
    prompt += `请提供详细、准确的回答，必要时可以包含代码示例、类比或图表描述。如果问题超出章节范围，可以提供相关知识，但请说明这部分内容不在当前章节中。
回答应该清晰、结构化，使用Markdown格式提高可读性。`;

    return prompt;
  }

  /**
   * 生成流式内容
   * @param prompt 提示词
   * @param onChunk 处理流式响应块的回调函数
   * @param options 选项
   * @returns Promise<void>
   */
  async generateContentStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options: any = {}
  ): Promise<void> {
    const requestId = LLMLogger.startRequest({
      apiUrl: this.apiUrl,
      model: this.modelName,
      options: { ...options, stream: true },
    });

    console.log(`[${requestId}] ===== AI STREAM API REQUEST START =====`);
    try {
      console.log(`[${requestId}] API URL:`, this.apiUrl);
      console.log(`[${requestId}] Model:`, this.modelName);
      console.log(
        `[${requestId}] Request Timestamp:`,
        new Date().toISOString()
      );

      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant for an educational platform.",
          },
          { role: "user", content: prompt },
        ],
        stream: true,
        ...options,
      };

      // 记录请求内容
      LLMLogger.logPrompt(requestId, prompt, {
        model: this.modelName,
        temperature: options.temperature,
        maxTokens: options.max_tokens,
        stream: true,
      });

      // 记录请求开始时间
      const startTime = Date.now();

      // 发起流式请求
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${requestId}] Stream API Error:`,
          response.status,
          errorText
        );

        LLMLogger.logError(
          requestId,
          new Error(`HTTP Error: ${response.status}`),
          {
            responseStatus: response.status,
            responseText: errorText,
          }
        );

        LLMLogger.endRequest(requestId, {
          status: "error",
          statusCode: response.status,
          errorType: "http_error",
        });

        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      // 确保响应是可读流
      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalContent = "";

      // 读取流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码二进制数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理SSE格式的数据
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            // 处理结束标记
            if (data === "[DONE]") {
              console.log(`[${requestId}] Stream completed`);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (
                parsed.choices &&
                parsed.choices[0] &&
                parsed.choices[0].delta &&
                parsed.choices[0].delta.content
              ) {
                const contentChunk = parsed.choices[0].delta.content;
                totalContent += contentChunk;

                // 调用回调函数处理内容块
                onChunk(contentChunk);

                // 记录流式响应块
                LLMLogger.logResponse(requestId, {
                  type: "stream_chunk",
                  content: contentChunk,
                  timestamp: new Date().toISOString(),
                });
              }
            } catch (e) {
              console.error(`[${requestId}] Error parsing stream data:`, e);
              LLMLogger.logError(requestId, e, {
                phase: "stream_parsing",
                data: data,
              });
            }
          }
        }
      }

      // 记录请求结束时间和总耗时
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[${requestId}] ===== AI STREAM API COMPLETE =====`);
      console.log(`[${requestId}] Total duration: ${duration}ms`);
      console.log(
        `[${requestId}] Total content length: ${totalContent.length}`
      );

      // 记录完整的生成内容
      LLMLogger.logProcessedContent(requestId, totalContent, {
        processingMethod: "stream aggregation",
        duration: duration,
        contentLength: totalContent.length,
      });

      // 结束请求记录
      LLMLogger.endRequest(requestId, {
        status: "success",
        duration: duration,
        contentLength: totalContent.length,
        streamMode: true,
      });
    } catch (error: any) {
      console.error(`[${requestId}] ===== AI STREAM API ERROR =====`);
      console.error(`[${requestId}] Error:`, error);

      // 记录错误
      LLMLogger.logError(requestId, error, {
        phase: "stream_processing",
      });

      // 结束请求记录
      LLMLogger.endRequest(requestId, {
        status: "error",
        errorType: "stream_error",
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Generate exercises for a chapter
   * @param chapterContent The chapter content
   * @param difficulty The difficulty level (easy, medium, hard)
   * @param count The number of exercises to generate
   * @returns The generated exercises
   */
  async generateExercises(
    chapterContent: any,
    difficulty: string = "medium",
    count: number = 5
  ): Promise<any> {
    const prompt = `
    请为章节"${chapterContent.title}"创建${count}道练习题。
    
    章节内容概述：
    ${chapterContent.content.summary}
    
    核心概念：
    ${chapterContent.content.concepts
      .map((c: any) => `- ${c.title}: ${c.explanation.substring(0, 100)}...`)
      .join("\n")}
    
    难度级别：${difficulty}（easy=简单, medium=中等, hard=困难）
    
    请生成多选题，每道题应包含：
    1. 问题描述
    2. 4个选项
    3. 正确答案
    4. 解析说明
    
    请以JSON格式返回，结构如下：
    {
      "exercises": [
        {
          "id": 1,
          "question": "问题描述",
          "type": "multiple_choice",
          "options": ["选项1", "选项2", "选项3", "选项4"],
          "answer": "正确选项的文本",
          "explanation": "答案解析"
        }
      ]
    }
    
    非常重要：
    1. 请直接返回有效的JSON格式，不要添加任何其他格式化，如Markdown代码块、前导文本或结尾说明
    2. 确保返回的是一个可以直接被JSON.parse()解析的字符串
    3. 确保生成的练习题与章节内容直接相关，能够测试对核心概念的理解
    4. 根据指定的难度调整问题的复杂度
    `;

    let content = "";
    try {
      content = await this.generateContent(prompt);

      // 尝试提取JSON内容（处理可能的Markdown代码块）
      let jsonContent = content;

      // 检查是否包含Markdown代码块
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/;
      const match = content.match(jsonBlockRegex);

      if (match && match[1]) {
        console.log("Found JSON in Markdown code block, extracting...");
        jsonContent = match[1].trim();
      } else {
        // 如果没有找到代码块，尝试直接在内容中查找JSON对象
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          console.log("Extracting JSON directly from content...");
          jsonContent = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      try {
        // 尝试解析JSON
        const exercisesData = JSON.parse(jsonContent);

        // 验证JSON结构
        if (!Array.isArray(exercisesData.exercises)) {
          throw new Error("练习题数据结构无效");
        }

        // 确保每个练习题都有必要的字段
        const validatedExercises = exercisesData.exercises.map(
          (exercise: any, index: number) => {
            return {
              id: exercise.id || index + 1,
              question: exercise.question || `问题 ${index + 1}`,
              type: exercise.type || "multiple_choice",
              options: Array.isArray(exercise.options)
                ? exercise.options
                : ["选项A", "选项B", "选项C", "选项D"],
              answer: exercise.answer || exercise.options[0],
              explanation: exercise.explanation || "暂无解析",
            };
          }
        );

        return {
          exercises: validatedExercises,
        };
      } catch (parseError) {
        console.error("Error parsing exercises JSON:", parseError);
        throw new Error("解析练习题数据失败");
      }
    } catch (error) {
      console.error("Error generating exercises:", error);

      // 创建基本的练习题作为后备方案
      const fallbackExercises = [];
      for (let i = 0; i < count; i++) {
        fallbackExercises.push({
          id: i + 1,
          question: `关于"${chapterContent.title}"的问题 ${i + 1}`,
          type: "multiple_choice",
          options: ["选项A", "选项B", "选项C", "选项D"],
          answer: "选项A",
          explanation: "由于生成失败，这是一个占位练习题。",
        });
      }

      return {
        exercises: fallbackExercises,
      };
    }
  }
}

export default new AIService();
