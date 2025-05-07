import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import supabaseService from './supabaseService';
import config from '../config';

/**
 * Mermaid图表生成服务
 * 负责生成各种类型的Mermaid图表
 */
class MermaidService {
  private mermaidApiUrl: string;

  constructor() {
    // 可以使用公共的Mermaid渲染服务，如mermaid.ink或自建服务
    this.mermaidApiUrl = config.mermaidApiUrl || 'https://mermaid.ink/svg';
  }

  /**
   * 生成Mermaid图表的SVG URL
   * @param mermaidCode Mermaid代码
   * @returns 图表URL
   */
  async generateMermaidUrl(mermaidCode: string): Promise<string> {
    try {
      // 编码Mermaid代码
      const encodedMermaidCode = Buffer.from(mermaidCode).toString('base64');
      
      // 构建Mermaid.ink URL
      return `${this.mermaidApiUrl}/${encodedMermaidCode}`;
    } catch (error) {
      console.error('生成Mermaid URL失败:', error);
      throw new Error('生成Mermaid URL失败');
    }
  }

  /**
   * 生成思维导图
   * @param title 标题
   * @param concepts 概念列表
   * @returns Mermaid代码
   */
  generateMindMap(title: string, concepts: any[]): string {
    let mindMapCode = 'mindmap\n';
    mindMapCode += `  root((${this.escapeText(title)}))\n`;
    
    // 为每个概念添加节点
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      mindMapCode += `    ${this.escapeText(concept.title)}\n`;
      
      // 如果有子概念或示例，添加子节点
      if (concept.examples && concept.examples.length > 0) {
        for (const example of concept.examples) {
          mindMapCode += `      ${this.escapeText(example)}\n`;
        }
      }
      
      // 从解释中提取关键点
      const keyPoints = this.extractKeyPoints(concept.explanation);
      for (const point of keyPoints) {
        mindMapCode += `      ${this.escapeText(point)}\n`;
      }
    }
    
    return mindMapCode;
  }

  /**
   * 生成流程图
   * @param title 标题
   * @param steps 步骤列表
   * @returns Mermaid代码
   */
  generateFlowchart(title: string, steps: string[]): string {
    let flowchartCode = 'flowchart TD\n';
    flowchartCode += `  title[${this.escapeText(title)}]\n`;
    
    // 添加起始节点
    flowchartCode += '  start([开始]) --> step1\n';
    
    // 添加步骤节点
    for (let i = 0; i < steps.length; i++) {
      const currentStep = `step${i + 1}`;
      flowchartCode += `  ${currentStep}[${this.escapeText(steps[i])}]\n`;
      
      // 如果不是最后一个步骤，添加连接到下一步
      if (i < steps.length - 1) {
        const nextStep = `step${i + 2}`;
        flowchartCode += `  ${currentStep} --> ${nextStep}\n`;
      } else {
        // 最后一个步骤连接到结束节点
        flowchartCode += `  ${currentStep} --> end([结束])\n`;
      }
    }
    
    return flowchartCode;
  }

  /**
   * 生成时序图
   * @param title 标题
   * @param actors 参与者列表
   * @param interactions 交互列表
   * @returns Mermaid代码
   */
  generateSequenceDiagram(title: string, actors: string[], interactions: any[]): string {
    let sequenceCode = 'sequenceDiagram\n';
    sequenceCode += `  title: ${this.escapeText(title)}\n`;
    
    // 添加参与者
    for (const actor of actors) {
      sequenceCode += `  participant ${this.escapeText(actor)}\n`;
    }
    
    // 添加交互
    for (const interaction of interactions) {
      sequenceCode += `  ${this.escapeText(interaction.from)} ->> ${this.escapeText(interaction.to)}: ${this.escapeText(interaction.message)}\n`;
      
      // 如果有回复，添加回复
      if (interaction.reply) {
        sequenceCode += `  ${this.escapeText(interaction.to)} -->> ${this.escapeText(interaction.from)}: ${this.escapeText(interaction.reply)}\n`;
      }
    }
    
    return sequenceCode;
  }

  /**
   * 生成类图
   * @param title 标题
   * @param classes 类列表
   * @param relationships 关系列表
   * @returns Mermaid代码
   */
  generateClassDiagram(title: string, classes: any[], relationships: any[]): string {
    let classCode = 'classDiagram\n';
    classCode += `  title ${this.escapeText(title)}\n`;
    
    // 添加类
    for (const cls of classes) {
      classCode += `  class ${this.escapeText(cls.name)} {\n`;
      
      // 添加属性
      if (cls.attributes && cls.attributes.length > 0) {
        for (const attr of cls.attributes) {
          classCode += `    ${this.escapeText(attr)}\n`;
        }
      }
      
      // 添加方法
      if (cls.methods && cls.methods.length > 0) {
        for (const method of cls.methods) {
          classCode += `    ${this.escapeText(method)}\n`;
        }
      }
      
      classCode += '  }\n';
    }
    
    // 添加关系
    for (const rel of relationships) {
      classCode += `  ${this.escapeText(rel.from)} ${rel.type} ${this.escapeText(rel.to)}: ${this.escapeText(rel.label || '')}\n`;
    }
    
    return classCode;
  }

  /**
   * 生成甘特图
   * @param title 标题
   * @param tasks 任务列表
   * @returns Mermaid代码
   */
  generateGanttChart(title: string, tasks: any[]): string {
    let ganttCode = 'gantt\n';
    ganttCode += `  title ${this.escapeText(title)}\n`;
    ganttCode += '  dateFormat YYYY-MM-DD\n';
    ganttCode += '  axisFormat %m/%d\n';
    
    // 添加任务分段
    let currentSection = '';
    for (const task of tasks) {
      // 如果有新的分段，添加分段
      if (task.section && task.section !== currentSection) {
        currentSection = task.section;
        ganttCode += `  section ${this.escapeText(currentSection)}\n`;
      }
      
      // 添加任务
      ganttCode += `  ${this.escapeText(task.name)}: ${task.id}, ${task.start}, ${task.duration || task.end}\n`;
      
      // 如果有依赖，添加依赖
      if (task.dependencies && task.dependencies.length > 0) {
        ganttCode += `  ${this.escapeText(task.name)}: after ${task.dependencies.join(', ')}\n`;
      }
    }
    
    return ganttCode;
  }

  /**
   * 生成饼图
   * @param title 标题
   * @param data 数据列表
   * @returns Mermaid代码
   */
  generatePieChart(title: string, data: any[]): string {
    let pieCode = 'pie\n';
    pieCode += `  title ${this.escapeText(title)}\n`;
    
    // 添加数据
    for (const item of data) {
      pieCode += `  "${this.escapeText(item.label)}" : ${item.value}\n`;
    }
    
    return pieCode;
  }

  /**
   * 根据内容类型生成合适的图表
   * @param title 标题
   * @param content 内容
   * @param contentType 内容类型
   * @returns 图表代码和URL
   */
  async generateDiagramForContent(title: string, content: any, contentType: string): Promise<any> {
    let mermaidCode = '';
    
    // 根据内容类型选择合适的图表类型
    switch (contentType) {
      case 'concept':
        // 生成思维导图
        mermaidCode = this.generateMindMap(title, content.concepts || []);
        break;
      case 'process':
        // 生成流程图
        const steps = this.extractProcessSteps(content.explanation || content.summary || '');
        mermaidCode = this.generateFlowchart(title, steps);
        break;
      case 'comparison':
        // 生成比较图表（饼图）
        const comparisonData = this.extractComparisonData(content.explanation || content.summary || '');
        mermaidCode = this.generatePieChart(title, comparisonData);
        break;
      case 'sequence':
        // 生成时序图
        const actors = this.extractActors(content.explanation || content.summary || '');
        const interactions = this.extractInteractions(content.explanation || content.summary || '', actors);
        mermaidCode = this.generateSequenceDiagram(title, actors, interactions);
        break;
      case 'class':
        // 生成类图
        const classes = this.extractClasses(content.explanation || content.summary || '');
        const relationships = this.extractRelationships(content.explanation || content.summary || '', classes);
        mermaidCode = this.generateClassDiagram(title, classes, relationships);
        break;
      default:
        // 默认生成思维导图
        mermaidCode = this.generateMindMap(title, content.concepts || []);
    }
    
    // 生成图表URL
    const diagramUrl = await this.generateMermaidUrl(mermaidCode);
    
    return {
      type: contentType,
      title,
      mermaidCode,
      diagramUrl
    };
  }

  /**
   * 从文本中提取流程步骤
   * @param text 文本内容
   * @returns 步骤列表
   */
  private extractProcessSteps(text: string): string[] {
    // 尝试查找数字编号的步骤
    const stepRegex = /(\d+[\.\)、])\s*([^\n]+)/g;
    const matches = [...text.matchAll(stepRegex)];
    
    if (matches.length > 0) {
      return matches.map(match => match[2].trim());
    }
    
    // 如果没有找到明确的步骤，尝试按句子分割
    const sentences = text.split(/[。！？\.!?]/).filter(s => s.trim().length > 0);
    return sentences.slice(0, Math.min(5, sentences.length));
  }

  /**
   * 从文本中提取比较数据
   * @param text 文本内容
   * @returns 比较数据
   */
  private extractComparisonData(text: string): any[] {
    // 尝试查找比较项和数值
    const comparisonRegex = /([^:：]+)[：:]\s*(\d+)/g;
    const matches = [...text.matchAll(comparisonRegex)];
    
    if (matches.length > 0) {
      return matches.map(match => ({
        label: match[1].trim(),
        value: parseInt(match[2])
      }));
    }
    
    // 如果没有找到明确的比较数据，创建示例数据
    return [
      { label: '项目A', value: 30 },
      { label: '项目B', value: 50 },
      { label: '项目C', value: 20 }
    ];
  }

  /**
   * 从文本中提取参与者
   * @param text 文本内容
   * @returns 参与者列表
   */
  private extractActors(text: string): string[] {
    // 这里可以实现更复杂的逻辑来提取参与者
    // 简单实现：查找可能的名词短语
    const actors = new Set<string>();
    
    // 添加一些默认参与者
    actors.add('用户');
    actors.add('系统');
    
    // 尝试从文本中提取更多参与者
    const nounPhrases = text.match(/([A-Z][a-z]+|[A-Z]+|[a-z]+[A-Z][a-z]*)/g) || [];
    for (const phrase of nounPhrases) {
      if (phrase.length > 3) {
        actors.add(phrase);
      }
    }
    
    return Array.from(actors).slice(0, 5); // 限制参与者数量
  }

  /**
   * 从文本中提取交互
   * @param text 文本内容
   * @param actors 参与者列表
   * @returns 交互列表
   */
  private extractInteractions(text: string, actors: string[]): any[] {
    // 简单实现：创建一些示例交互
    const interactions = [];
    
    if (actors.length >= 2) {
      // 添加一些基本交互
      interactions.push({
        from: actors[0],
        to: actors[1],
        message: '请求数据',
        reply: '返回数据'
      });
      
      if (actors.length >= 3) {
        interactions.push({
          from: actors[1],
          to: actors[2],
          message: '处理请求',
          reply: '处理完成'
        });
        
        interactions.push({
          from: actors[0],
          to: actors[2],
          message: '确认结果'
        });
      }
    }
    
    return interactions;
  }

  /**
   * 从文本中提取类
   * @param text 文本内容
   * @returns 类列表
   */
  private extractClasses(text: string): any[] {
    // 简单实现：创建一些示例类
    return [
      {
        name: '类A',
        attributes: ['+属性1: 类型', '-属性2: 类型'],
        methods: ['+方法1(): 返回类型', '-方法2(参数): 返回类型']
      },
      {
        name: '类B',
        attributes: ['+属性3: 类型'],
        methods: ['+方法3(): 返回类型']
      }
    ];
  }

  /**
   * 从文本中提取关系
   * @param text 文本内容
   * @param classes 类列表
   * @returns 关系列表
   */
  private extractRelationships(text: string, classes: any[]): any[] {
    // 简单实现：创建一些示例关系
    const relationships = [];
    
    if (classes.length >= 2) {
      relationships.push({
        from: classes[0].name,
        to: classes[1].name,
        type: '<|--',
        label: '继承'
      });
    }
    
    if (classes.length >= 3) {
      relationships.push({
        from: classes[0].name,
        to: classes[2].name,
        type: 'o--',
        label: '关联'
      });
    }
    
    return relationships;
  }

  /**
   * 从文本中提取关键点
   * @param text 文本内容
   * @returns 关键点列表
   */
  private extractKeyPoints(text: string): string[] {
    // 按句子分割
    const sentences = text.split(/[。！？\.!?]/).filter(s => s.trim().length > 0);
    
    // 选择前3个句子作为关键点
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * 转义Mermaid文本
   * @param text 文本
   * @returns 转义后的文本
   */
  private escapeText(text: string): string {
    // 转义特殊字符
    return text
      .replace(/"/g, '\\"')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * 保存图表到数据库
   * @param chapterId 章节ID
   * @param diagram 图表数据
   * @returns 保存的图表
   */
  async saveDiagram(chapterId: string, diagram: any): Promise<any> {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('chapter_diagrams')
        .insert([
          {
            id: uuidv4(),
            chapter_id: chapterId,
            title: diagram.title,
            diagram_type: diagram.type,
            mermaid_code: diagram.mermaidCode,
            diagram_url: diagram.diagramUrl,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('保存图表失败:', error);
      throw new Error('保存图表失败');
    }
  }

  /**
   * 获取章节的图表
   * @param chapterId 章节ID
   * @returns 图表列表
   */
  async getChapterDiagrams(chapterId: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('chapter_diagrams')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('获取图表失败:', error);
      throw new Error('获取图表失败');
    }
  }
}

export default new MermaidService();
