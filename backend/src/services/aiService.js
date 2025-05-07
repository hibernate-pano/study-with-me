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
    `;
      const content = yield this.generateContent(prompt);
      try {
        // Parse the JSON response
        return JSON.parse(content);
      }
      catch (error) {
        console.error('Error parsing AI response as JSON:', error);
        throw new Error('AI response is not in valid JSON format');
      }
    });
  }
  /**
   * Generate chapter content based on a chapter title and key points
   * @param chapterTitle The chapter title
   * @param keyPoints The key points to cover
   * @returns The generated chapter content
   */
  generateChapterContent(chapterTitle, keyPoints) {
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
          "examples": ["示例1", "示例2"]
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
    `;
      const content = yield this.generateContent(prompt);
      try {
        // Parse the JSON response
        return JSON.parse(content);
      }
      catch (error) {
        console.error('Error parsing AI response as JSON:', error);
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
    `;
      const content = yield this.generateContent(prompt);
      try {
        // Parse the JSON response
        return JSON.parse(content);
      }
      catch (error) {
        console.error('Error parsing AI response as JSON:', error);
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
