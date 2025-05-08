"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
  return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
/**
 * Service for interacting with the AI model (deepseek-ai/DeepSeek-V3)
 */
class AIService {
  constructor() {
    this.apiUrl = config_1.default.ai.apiUrl;
    this.apiKey = config_1.default.ai.apiKey;
    this.modelName = config_1.default.ai.modelName;
  }
  /**
   * Generate content using the AI model
   * @param prompt The prompt to send to the AI model
   * @param options Additional options for the API call
   * @returns The generated content
   */
  generateContent(prompt_1) {
    return __awaiter(this, arguments, void 0, function* (prompt, options = {}) {
      try {
        // This is a placeholder implementation
        // You'll need to adjust this based on the actual API of 硅基流动
        const response = yield axios_1.default.post(this.apiUrl, Object.assign({
          model: this.modelName, messages: [
            { role: 'system', content: 'You are a helpful AI assistant for an educational platform.' },
            { role: 'user', content: prompt }
          ]
        }, options), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
        // Extract the response content based on the API's response format
        // This might need adjustment based on the actual API response structure
        return response.data.choices[0].message.content;
      }
      catch (error) {
        console.error('Error generating AI content:', error);
        throw new Error('Failed to generate content from AI model');
      }
    });
  }
  /**
   * Generate a learning path based on a learning goal
   * @param goal The learning goal
   * @param userLevel The user's current knowledge level
   * @returns The generated learning path
   */
  generateLearningPath(goal_1) {
    return __awaiter(this, arguments, void 0, function* (goal, userLevel = 'beginner') {
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
      const content = yield this.generateContent(prompt);
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
          } catch (relaxedError) {
            throw new Error('Failed to parse JSON with relaxed method: ' + (relaxedError.message || 'Unknown error'));
          }
        }
      }
      catch (error) {
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
    });
  }
  /**
   * Generate chapter content based on a chapter title and key points
   * @param chapterTitle The chapter title
   * @param keyPoints The key points to cover
   * @returns The generated chapter content
   */
  generateChapterContent(chapterTitle, keyPoints, includeVisuals = true) {
    return __awaiter(this, void 0, void 0, function* () {
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
      const content = yield this.generateContent(prompt);
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
        } else {
          // 尝试查找JSON的开始和结束位置
          const jsonStartIndex = content.indexOf('{');
          const jsonEndIndex = content.lastIndexOf('}');

          if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            console.log('Found JSON by brackets, extracting...');
            jsonContent = content.substring(jsonStartIndex, jsonEndIndex + 1);
          }
        }

        // 清理可能的非JSON字符
        jsonContent = jsonContent.trim();

        // 尝试修复常见的JSON格式问题
        // 替换单引号为双引号
        jsonContent = jsonContent.replace(/'/g, '"');

        // 移除可能的尾随逗号
        jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        console.log('Attempting to parse JSON:', jsonContent.substring(0, 100) + '...');

        // Parse the JSON response
        const chapterContent = JSON.parse(jsonContent);

        return chapterContent;
      }
      catch (error) {
        console.error('Error parsing AI response as JSON:', error);
        console.error('Raw content:', content);
        throw new Error('AI response is not in valid JSON format');
      }
    });
  }
  /**
   * Generate exercises based on chapter content
   * @param chapterContent The chapter content
   * @param difficulty The difficulty level
   * @param count The number of exercises to generate
   * @returns The generated exercises
   */
  generateExercises(chapterContent_1) {
    return __awaiter(this, arguments, void 0, function* (chapterContent, difficulty = 'medium', count = 5) {
      const prompt = `
    作为教育专家，请基于以下学习内容生成${count}道练习题，难度级别为"${difficulty}"。

    章节标题：${chapterContent.title}
    章节概述：${chapterContent.summary}
    核心概念：
    ${chapterContent.concepts.map((concept) => `- ${concept.title}: ${concept.explanation.substring(0, 100)}...`).join('\n')}

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
      const content = yield this.generateContent(prompt);
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
        } else {
          // 尝试查找JSON的开始和结束位置
          const jsonStartIndex = content.indexOf('{');
          const jsonEndIndex = content.lastIndexOf('}');

          if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            console.log('Found JSON by brackets, extracting...');
            jsonContent = content.substring(jsonStartIndex, jsonEndIndex + 1);
          }
        }

        // 清理可能的非JSON字符
        jsonContent = jsonContent.trim();

        // 尝试修复常见的JSON格式问题
        // 替换单引号为双引号
        jsonContent = jsonContent.replace(/'/g, '"');

        // 移除可能的尾随逗号
        jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        console.log('Attempting to parse JSON:', jsonContent.substring(0, 100) + '...');

        // Parse the JSON response
        return JSON.parse(jsonContent);
      }
      catch (error) {
        console.error('Error parsing AI response as JSON:', error);
        console.error('Raw content:', content);
        throw new Error('AI response is not in valid JSON format');
      }
    });
  }
  /**
   * Answer a question based on the learning context
   * @param question The user's question
   * @param context The learning context
   * @returns The AI's answer
   */
  answerQuestion(question, context) {
    return __awaiter(this, void 0, void 0, function* () {
      const prompt = `
    作为AI学习助手，请回答用户关于"${context.chapterTitle}"的问题。

    用户问题：${question}

    当前学习上下文：
    - 学习路径：${context.pathTitle}
    - 当前章节：${context.chapterTitle}
    - 相关知识点：${context.conceptTitle || '未指定'}

    请基于以下相关知识提供准确、清晰的回答：
    ${context.conceptContent || ''}

    回答应该：
    1. 直接解答问题
    2. 提供具体例子
    3. 如有必要，解释相关概念
    4. 建议下一步学习方向
    `;
      return yield this.generateContent(prompt);
    });
  }
}
exports.default = new AIService();
