import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import supabaseService from './supabaseService';
import config from '../config';

/**
 * 多模态内容生成服务
 * 负责生成图表、图像和其他可视化内容
 */
class MultimodalService {
  private apiKey: string;
  private chartApiUrl: string;
  private imageApiUrl: string;
  private diagramApiUrl: string;

  constructor() {
    this.apiKey = config.openaiApiKey;
    this.chartApiUrl = config.chartApiUrl || 'https://quickchart.io/chart';
    this.imageApiUrl = config.imageApiUrl || 'https://api.openai.com/v1/images/generations';
    this.diagramApiUrl = config.diagramApiUrl || 'https://kroki.io';
  }

  /**
   * 生成图表
   * @param chartType 图表类型 (bar, line, pie, radar, etc.)
   * @param title 图表标题
   * @param data 图表数据
   * @param options 图表选项
   * @returns 图表URL或Base64编码
   */
  async generateChart(chartType: string, title: string, data: any, options: any = {}): Promise<string> {
    try {
      // 构建图表配置
      const chartConfig = {
        type: chartType,
        data: data,
        options: {
          title: {
            display: true,
            text: title
          },
          ...options
        }
      };

      // 调用QuickChart API生成图表
      const response = await axios.post(this.chartApiUrl, {
        chart: JSON.stringify(chartConfig),
        width: options.width || 500,
        height: options.height || 300,
        backgroundColor: options.backgroundColor || 'white'
      });

      // 返回图表URL或直接返回图表数据
      return response.data.url || response.data;
    } catch (error) {
      console.error('图表生成失败:', error);
      throw new Error('图表生成失败');
    }
  }

  /**
   * 生成图像
   * @param prompt 图像描述提示词
   * @param options 图像生成选项
   * @returns 图像URL
   */
  async generateImage(prompt: string, options: any = {}): Promise<string> {
    try {
      // 调用OpenAI DALL-E API生成图像
      const response = await axios.post(
        this.imageApiUrl,
        {
          prompt: prompt,
          n: options.n || 1,
          size: options.size || '512x512',
          response_format: 'url'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // 返回生成的图像URL
      return response.data.data[0].url;
    } catch (error) {
      console.error('图像生成失败:', error);
      throw new Error('图像生成失败');
    }
  }

  /**
   * 生成流程图或图解
   * @param diagramType 图解类型 (flowchart, sequence, class, etc.)
   * @param content 图解内容
   * @param options 图解选项
   * @returns 图解URL或Base64编码
   */
  async generateDiagram(diagramType: string, content: string, options: any = {}): Promise<string> {
    try {
      // 编码图解内容
      const encodedContent = Buffer.from(content).toString('base64');
      
      // 构建Kroki API URL
      const format = options.format || 'svg';
      const url = `${this.diagramApiUrl}/${diagramType}/${format}/${encodedContent}`;
      
      // 获取图解
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      
      // 将图解转换为Base64
      const base64 = Buffer.from(response.data).toString('base64');
      return `data:image/${format};base64,${base64}`;
    } catch (error) {
      console.error('图解生成失败:', error);
      throw new Error('图解生成失败');
    }
  }

  /**
   * 为文本内容生成合适的可视化
   * @param content 文本内容
   * @param contentType 内容类型
   * @returns 可视化内容对象
   */
  async generateVisualization(content: string, contentType: string): Promise<any> {
    try {
      // 根据内容类型选择合适的可视化方式
      switch (contentType) {
        case 'concept':
          return await this.generateConceptVisualization(content);
        case 'process':
          return await this.generateProcessVisualization(content);
        case 'comparison':
          return await this.generateComparisonVisualization(content);
        case 'data':
          return await this.generateDataVisualization(content);
        case 'code':
          return await this.generateCodeVisualization(content);
        default:
          return await this.generateGenericVisualization(content);
      }
    } catch (error) {
      console.error('可视化生成失败:', error);
      throw new Error('可视化生成失败');
    }
  }

  /**
   * 生成概念可视化
   * @param content 概念内容
   * @returns 概念可视化
   */
  private async generateConceptVisualization(content: string): Promise<any> {
    // 为概念生成思维导图或图解
    const prompt = `为以下概念创建一个清晰的图解或思维导图：\n${content}`;
    const imageUrl = await this.generateImage(prompt, { size: '512x512' });
    
    return {
      type: 'concept_visualization',
      imageUrl,
      alt: `${content.substring(0, 30)}...的概念图解`
    };
  }

  /**
   * 生成流程可视化
   * @param content 流程内容
   * @returns 流程可视化
   */
  private async generateProcessVisualization(content: string): Promise<any> {
    // 尝试从内容中提取流程步骤
    const steps = this.extractProcessSteps(content);
    
    // 生成流程图
    const flowchartContent = this.generateFlowchartFromSteps(steps);
    const diagramUrl = await this.generateDiagram('plantuml', flowchartContent, { format: 'svg' });
    
    return {
      type: 'process_visualization',
      diagramUrl,
      alt: '流程图'
    };
  }

  /**
   * 生成比较可视化
   * @param content 比较内容
   * @returns 比较可视化
   */
  private async generateComparisonVisualization(content: string): Promise<any> {
    // 提取比较项目
    const comparisonItems = this.extractComparisonItems(content);
    
    // 生成比较图表
    const chartData = {
      labels: comparisonItems.map(item => item.name),
      datasets: [
        {
          label: '比较',
          data: comparisonItems.map(item => item.value),
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    const chartUrl = await this.generateChart('bar', '比较图表', chartData);
    
    return {
      type: 'comparison_visualization',
      chartUrl,
      alt: '比较图表'
    };
  }

  /**
   * 生成数据可视化
   * @param content 数据内容
   * @returns 数据可视化
   */
  private async generateDataVisualization(content: string): Promise<any> {
    // 提取数据点
    const dataPoints = this.extractDataPoints(content);
    
    // 生成数据图表
    const chartData = {
      labels: dataPoints.map(point => point.label),
      datasets: [
        {
          label: '数据',
          data: dataPoints.map(point => point.value),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }
      ]
    };
    
    const chartUrl = await this.generateChart('line', '数据图表', chartData);
    
    return {
      type: 'data_visualization',
      chartUrl,
      alt: '数据图表'
    };
  }

  /**
   * 生成代码可视化
   * @param content 代码内容
   * @returns 代码可视化
   */
  private async generateCodeVisualization(content: string): Promise<any> {
    // 为代码生成流程图或类图
    const prompt = `为以下代码创建一个流程图或类图：\n${content}`;
    const imageUrl = await this.generateImage(prompt, { size: '512x512' });
    
    return {
      type: 'code_visualization',
      imageUrl,
      alt: '代码可视化'
    };
  }

  /**
   * 生成通用可视化
   * @param content 内容
   * @returns 通用可视化
   */
  private async generateGenericVisualization(content: string): Promise<any> {
    // 生成通用图像
    const prompt = `为以下内容创建一个教育性的图解：\n${content}`;
    const imageUrl = await this.generateImage(prompt, { size: '512x512' });
    
    return {
      type: 'generic_visualization',
      imageUrl,
      alt: '内容图解'
    };
  }

  /**
   * 从内容中提取流程步骤
   * @param content 内容
   * @returns 流程步骤
   */
  private extractProcessSteps(content: string): string[] {
    // 简单实现：按行分割，查找数字开头的行
    const lines = content.split('\n');
    const steps = lines.filter(line => /^\d+\./.test(line.trim()));
    
    return steps.length > 0 ? steps : lines.slice(0, 5); // 如果没有找到步骤，取前5行
  }

  /**
   * 从步骤生成流程图
   * @param steps 步骤
   * @returns 流程图内容
   */
  private generateFlowchartFromSteps(steps: string[]): string {
    let flowchart = '@startuml\n';
    flowchart += 'start\n';
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i].replace(/^\d+\./, '').trim();
      flowchart += `:${step};\n`;
      
      if (i < steps.length - 1) {
        flowchart += '->\n';
      }
    }
    
    flowchart += 'end\n';
    flowchart += '@enduml';
    
    return flowchart;
  }

  /**
   * 从内容中提取比较项目
   * @param content 内容
   * @returns 比较项目
   */
  private extractComparisonItems(content: string): Array<{name: string, value: number}> {
    // 简单实现：查找可能的比较项和数值
    const items: Array<{name: string, value: number}> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/([^:]+):\s*(\d+)/);
      if (match) {
        items.push({
          name: match[1].trim(),
          value: parseInt(match[2])
        });
      }
    }
    
    // 如果没有找到项目，创建一些示例项目
    if (items.length === 0) {
      return [
        { name: '项目A', value: 30 },
        { name: '项目B', value: 50 },
        { name: '项目C', value: 20 }
      ];
    }
    
    return items;
  }

  /**
   * 从内容中提取数据点
   * @param content 内容
   * @returns 数据点
   */
  private extractDataPoints(content: string): Array<{label: string, value: number}> {
    // 简单实现：查找可能的数据点
    const dataPoints: Array<{label: string, value: number}> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/([^:]+):\s*(\d+)/);
      if (match) {
        dataPoints.push({
          label: match[1].trim(),
          value: parseInt(match[2])
        });
      }
    }
    
    // 如果没有找到数据点，创建一些示例数据点
    if (dataPoints.length === 0) {
      return [
        { label: '点1', value: 10 },
        { label: '点2', value: 20 },
        { label: '点3', value: 15 },
        { label: '点4', value: 25 },
        { label: '点5', value: 30 }
      ];
    }
    
    return dataPoints;
  }

  /**
   * 保存多模态内容到数据库
   * @param chapterId 章节ID
   * @param content 多模态内容
   * @returns 保存的内容
   */
  async saveMultimodalContent(chapterId: string, content: any): Promise<any> {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('multimodal_contents')
        .insert([
          {
            id: uuidv4(),
            chapter_id: chapterId,
            content_type: content.type,
            content_data: content,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('保存多模态内容失败:', error);
      throw new Error('保存多模态内容失败');
    }
  }

  /**
   * 获取章节的多模态内容
   * @param chapterId 章节ID
   * @returns 多模态内容列表
   */
  async getChapterMultimodalContents(chapterId: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('multimodal_contents')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('获取多模态内容失败:', error);
      throw new Error('获取多模态内容失败');
    }
  }
}

export default new MultimodalService();
