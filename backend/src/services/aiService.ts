import axios from 'axios';
import config from '../config';
import mermaidService from './mermaidService';

/**
 * Service for interacting with the AI model (Qwen/Qwen3-235B-A22B)
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
    try {
      // This is a placeholder implementation
      // You'll need to adjust this based on the actual API of 硅基流动
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.modelName,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant for an educational platform.' },
            { role: 'user', content: prompt }
          ],
          ...options
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extract the response content based on the API's response format
      // This might need adjustment based on the actual API response structure
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating AI content:', error);
      throw new Error('Failed to generate content from AI model');
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
    `;

    const content = await this.generateContent(prompt);

    try {
      // Parse the JSON response
      return JSON.parse(content);
    } catch (error) {
      console.error('Error parsing AI response as JSON:', error);
      throw new Error('AI response is not in valid JSON format');
    }
  }

  /**
   * Generate chapter content based on a chapter title and key points
   * @param chapterTitle The chapter title
   * @param keyPoints The key points to cover
   * @param includeVisuals 是否包含可视化内容
   * @returns The generated chapter content
   */
  async generateChapterContent(chapterTitle: string, keyPoints: string[], includeVisuals: boolean = true): Promise<any> {
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
          "visualType": "concept|process|comparison|data|code" // 指明这个概念适合什么类型的可视化
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

    对于每个核心概念，请添加一个visualType字段，指明这个概念适合什么类型的可视化：
    - concept: 适合概念图、思维导图等
    - process: 适合流程图、步骤图等
    - comparison: 适合比较图表、对比图等
    - data: 适合数据图表、统计图等
    - code: 适合代码结构图、算法流程图等
    `;

    const content = await this.generateContent(prompt);

    try {
      // Parse the JSON response
      const chapterContent = JSON.parse(content);

      // 如果需要包含可视化内容，为每个概念生成可视化
      if (includeVisuals) {
        await this.enrichWithVisualizations(chapterContent);
      }

      return chapterContent;
    } catch (error) {
      console.error('Error parsing AI response as JSON:', error);
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

    // 为每个概念生成可视化
    if (chapterContent.concepts && Array.isArray(chapterContent.concepts)) {
      for (const concept of chapterContent.concepts) {
        if (concept.visualType) {
          try {
            // 将visualType映射到mermaid图表类型
            const diagramType = this.mapVisualTypeToDiagramType(concept.visualType);

            // 生成图表内容
            const diagram = await mermaidService.generateDiagramForContent(
              concept.title,
              concept,
              diagramType
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
   * 将visualType映射到mermaid图表类型
   * @param visualType 可视化类型
   * @returns 图表类型
   */
  private mapVisualTypeToDiagramType(visualType: string): string {
    switch (visualType) {
      case 'concept':
        return 'concept'; // 思维导图
      case 'process':
        return 'process'; // 流程图
      case 'comparison':
        return 'comparison'; // 比较图表
      case 'data':
        return 'comparison'; // 数据图表，使用比较图表实现
      case 'code':
        return 'class'; // 代码结构图，使用类图实现
      default:
        return 'concept'; // 默认使用思维导图
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
    `;

    const content = await this.generateContent(prompt);

    try {
      // Parse the JSON response
      return JSON.parse(content);
    } catch (error) {
      console.error('Error parsing AI response as JSON:', error);
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

    return await this.generateContent(prompt);
  }
}

export default new AIService();
