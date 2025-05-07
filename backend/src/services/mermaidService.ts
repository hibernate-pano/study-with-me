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

    // 为每个概念添加节点，使用不同的形状和样式
    const nodeShapes = ['[', '(', '((', '{', '{{'];

    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      // 使用不同的节点形状，循环使用
      const shapeIndex = i % nodeShapes.length;
      const shape = nodeShapes[shapeIndex];
      const endShape = this.getEndShape(shape);

      // 添加概念节点，使用不同的形状
      mindMapCode += `    ${shape}${this.escapeText(concept.title)}${endShape}\n`;

      // 如果有子概念或示例，添加子节点
      if (concept.examples && concept.examples.length > 0) {
        mindMapCode += `      ::icon(fa fa-lightbulb)\n`; // 添加图标
        for (const example of concept.examples) {
          mindMapCode += `      ${this.escapeText(example)}\n`;
        }
      }

      // 从解释中提取关键点
      const keyPoints = this.extractKeyPoints(concept.explanation);
      if (keyPoints.length > 0) {
        // 添加关键点分组
        mindMapCode += `      关键点\n`;
        mindMapCode += `        ::icon(fa fa-key)\n`; // 添加图标

        for (const point of keyPoints) {
          mindMapCode += `        ${this.escapeText(point)}\n`;
        }
      }

      // 添加样式
      const colors = ['#f9a825', '#1e88e5', '#43a047', '#8e24aa', '#d81b60', '#00acc1'];
      mindMapCode += `      ::style{fill:${colors[i % colors.length]}, stroke:#333, stroke-width:1px}\n`;
    }

    return mindMapCode;
  }

  /**
   * 获取结束形状
   * @param startShape 开始形状
   * @returns 结束形状
   */
  private getEndShape(startShape: string): string {
    switch (startShape) {
      case '[': return ']';
      case '(': return ')';
      case '((': return '))';
      case '{': return '}';
      case '{{': return '}}';
      default: return startShape;
    }
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

    // 添加样式
    flowchartCode += '  %% 样式定义\n';
    flowchartCode += '  classDef start fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:white;\n';
    flowchartCode += '  classDef end fill:#F44336,stroke:#D32F2F,stroke-width:2px,color:white;\n';
    flowchartCode += '  classDef step fill:#2196F3,stroke:#1976D2,stroke-width:1px,color:white,rounded:true;\n';
    flowchartCode += '  classDef decision fill:#FFC107,stroke:#FFA000,stroke-width:1px,color:black,shape:diamond;\n';
    flowchartCode += '  classDef note fill:#FFECB3,stroke:#FFD54F,stroke-width:1px,color:black,shape:note;\n';

    // 添加起始节点
    flowchartCode += '  start([开始]) --> step1\n';
    flowchartCode += '  class start start;\n';

    // 检查步骤中是否有决策点（包含"如果"、"判断"等关键词）
    const decisionKeywords = ['如果', '判断', '决定', '选择', '是否'];

    // 添加步骤节点
    for (let i = 0; i < steps.length; i++) {
      const currentStep = `step${i + 1}`;
      const step = steps[i];

      // 检查是否是决策点
      const isDecision = decisionKeywords.some(keyword => step.includes(keyword));

      if (isDecision) {
        // 决策点使用菱形
        flowchartCode += `  ${currentStep}{${this.escapeText(step)}}\n`;
        flowchartCode += `  class ${currentStep} decision;\n`;

        // 决策点通常有两个分支
        if (i < steps.length - 2) {
          const nextStep1 = `step${i + 2}`;
          const nextStep2 = `step${i + 2}_alt`;

          // 添加两个分支
          flowchartCode += `  ${currentStep} -->|是| ${nextStep1}\n`;
          flowchartCode += `  ${currentStep} -->|否| ${nextStep2}\n`;

          // 添加备选路径节点
          flowchartCode += `  ${nextStep2}[备选路径]\n`;
          flowchartCode += `  class ${nextStep2} note;\n`;

          // 备选路径最终会合并回主路径
          if (i < steps.length - 3) {
            flowchartCode += `  ${nextStep2} --> step${i + 3}\n`;
          } else {
            flowchartCode += `  ${nextStep2} --> end\n`;
          }

          // 跳过下一步，因为我们已经处理了
          i++;
        } else {
          // 如果决策点是倒数第二个节点
          flowchartCode += `  ${currentStep} -->|是| end\n`;
          flowchartCode += `  ${currentStep} -->|否| end\n`;
        }
      } else {
        // 普通步骤使用圆角矩形
        flowchartCode += `  ${currentStep}[${this.escapeText(step)}]\n`;
        flowchartCode += `  class ${currentStep} step;\n`;

        // 如果不是最后一个步骤，添加连接到下一步
        if (i < steps.length - 1) {
          const nextStep = `step${i + 2}`;
          flowchartCode += `  ${currentStep} --> ${nextStep}\n`;
        } else {
          // 最后一个步骤连接到结束节点
          flowchartCode += `  ${currentStep} --> end\n`;
        }
      }
    }

    // 添加结束节点
    flowchartCode += '  end([结束])\n';
    flowchartCode += '  class end end;\n';

    // 添加注释
    flowchartCode += '  %% 添加注释节点\n';
    flowchartCode += '  note[流程图说明<br/>展示了主要步骤和决策点]\n';
    flowchartCode += '  class note note;\n';

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

    // 添加参与者，使用不同的类型
    const actorTypes = ['participant', 'actor', 'boundary', 'control', 'entity', 'database'];

    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i];
      // 根据参与者名称选择合适的类型
      let actorType = actorTypes[0]; // 默认为participant

      if (actor.toLowerCase().includes('用户') || actor.toLowerCase().includes('客户')) {
        actorType = 'actor';
      } else if (actor.toLowerCase().includes('数据库') || actor.toLowerCase().includes('存储')) {
        actorType = 'database';
      } else if (actor.toLowerCase().includes('服务') || actor.toLowerCase().includes('系统')) {
        actorType = 'boundary';
      } else if (actor.toLowerCase().includes('控制') || actor.toLowerCase().includes('管理')) {
        actorType = 'control';
      } else if (actor.toLowerCase().includes('实体') || actor.toLowerCase().includes('对象')) {
        actorType = 'entity';
      }

      sequenceCode += `  ${actorType} ${this.escapeText(actor)}\n`;
    }

    // 添加注释
    sequenceCode += '  Note over ' + this.escapeText(actors[0]) + ': 交互开始\n';

    // 添加交互
    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];

      // 使用不同的箭头类型表示不同的交互
      let arrowType = '->>';  // 默认箭头

      // 根据消息内容选择箭头类型
      if (interaction.message.toLowerCase().includes('请求') ||
        interaction.message.toLowerCase().includes('查询')) {
        arrowType = '->>';  // 实线箭头，表示同步请求
      } else if (interaction.message.toLowerCase().includes('通知') ||
        interaction.message.toLowerCase().includes('事件')) {
        arrowType = '--)';  // 虚线箭头，表示异步通知
      } else if (interaction.message.toLowerCase().includes('创建') ||
        interaction.message.toLowerCase().includes('初始化')) {
        arrowType = '-->>';  // 粗箭头，表示创建
      }

      // 添加交互
      sequenceCode += `  ${this.escapeText(interaction.from)} ${arrowType} ${this.escapeText(interaction.to)}: ${this.escapeText(interaction.message)}\n`;

      // 如果是重要交互，添加激活状态
      if (i === 0 || i === interactions.length - 1 ||
        interaction.message.toLowerCase().includes('重要') ||
        interaction.message.toLowerCase().includes('关键')) {
        sequenceCode += `  activate ${this.escapeText(interaction.to)}\n`;
      }

      // 如果有回复，添加回复
      if (interaction.reply) {
        // 根据回复内容选择箭头类型
        let replyArrowType = '-->';  // 默认回复箭头

        if (interaction.reply.toLowerCase().includes('成功') ||
          interaction.reply.toLowerCase().includes('确认')) {
          replyArrowType = '-->>';  // 粗箭头，表示成功响应
        } else if (interaction.reply.toLowerCase().includes('错误') ||
          interaction.reply.toLowerCase().includes('失败')) {
          replyArrowType = '--x';  // 错误箭头，表示失败响应
        }

        sequenceCode += `  ${this.escapeText(interaction.to)} ${replyArrowType} ${this.escapeText(interaction.from)}: ${this.escapeText(interaction.reply)}\n`;
      }

      // 如果之前激活了，现在停用
      if (i === 0 || i === interactions.length - 1 ||
        interaction.message.toLowerCase().includes('重要') ||
        interaction.message.toLowerCase().includes('关键')) {
        sequenceCode += `  deactivate ${this.escapeText(interaction.to)}\n`;
      }

      // 在关键步骤添加注释
      if (i === Math.floor(interactions.length / 2)) {
        sequenceCode += `  Note over ${this.escapeText(interaction.from)},${this.escapeText(interaction.to)}: 关键交互步骤\n`;
      }
    }

    // 添加循环或条件逻辑（如果交互数量足够）
    if (interactions.length >= 3) {
      const loopStart = Math.floor(interactions.length / 3);
      const loopEnd = Math.min(loopStart + 2, interactions.length - 1);

      // 在交互前插入循环开始
      sequenceCode = sequenceCode.split('\n').map((line, index) => {
        if (index === loopStart + actors.length + 2) {  // +2 是因为标题和注释
          return `  loop 可能重复的操作\n${line}`;
        }
        return line;
      }).join('\n');

      // 在交互后插入循环结束
      sequenceCode = sequenceCode.split('\n').map((line, index) => {
        if (index === loopEnd + actors.length + 6) {  // +6 是因为标题、注释、激活/停用等额外行
          return `${line}\n  end`;
        }
        return line;
      }).join('\n');
    }

    // 添加结束注释
    sequenceCode += '\n  Note over ' + this.escapeText(actors[actors.length - 1]) + ': 交互结束\n';

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

    // 添加注释
    classCode += '  %% 类图展示了系统中的主要类及其关系\n';

    // 添加类
    for (const cls of classes) {
      classCode += `  class ${this.escapeText(cls.name)} {\n`;

      // 添加属性，使用适当的访问修饰符和类型
      if (cls.attributes && cls.attributes.length > 0) {
        for (const attr of cls.attributes) {
          // 检查属性是否已经有访问修饰符
          if (attr.startsWith('+') || attr.startsWith('-') || attr.startsWith('#') || attr.startsWith('~')) {
            classCode += `    ${this.escapeText(attr)}\n`;
          } else {
            // 默认添加私有修饰符
            classCode += `    -${this.escapeText(attr)}\n`;
          }
        }
      }

      // 添加方法，使用适当的访问修饰符和返回类型
      if (cls.methods && cls.methods.length > 0) {
        for (const method of cls.methods) {
          // 检查方法是否已经有访问修饰符
          if (method.startsWith('+') || method.startsWith('-') || method.startsWith('#') || method.startsWith('~')) {
            classCode += `    ${this.escapeText(method)}\n`;
          } else {
            // 默认添加公共修饰符
            classCode += `    +${this.escapeText(method)}\n`;
          }
        }
      }

      classCode += '  }\n';

      // 添加类的注释或描述（如果有）
      if (cls.description) {
        classCode += `  %% ${this.escapeText(cls.name)}: ${this.escapeText(cls.description)}\n`;
      }
    }

    // 添加关系，使用更丰富的关系类型和描述
    for (const rel of relationships) {
      // 确保关系类型有效
      let relationType = rel.type;
      if (!['<|--', '<|..', '<--', '<..', '-->', '..>', '--', '..', '|--|', '|..|', '*--', 'o--', '<--*', '<--o'].includes(relationType)) {
        // 根据关系标签推断关系类型
        if (rel.label) {
          const label = rel.label.toLowerCase();
          if (label.includes('继承') || label.includes('扩展')) {
            relationType = '<|--';  // 继承
          } else if (label.includes('实现') || label.includes('接口')) {
            relationType = '<|..';  // 实现
          } else if (label.includes('组合') || label.includes('包含')) {
            relationType = '*--';   // 组合
          } else if (label.includes('聚合') || label.includes('拥有')) {
            relationType = 'o--';   // 聚合
          } else if (label.includes('依赖') || label.includes('使用')) {
            relationType = '..>';   // 依赖
          } else if (label.includes('关联')) {
            relationType = '-->';   // 关联
          }
        } else {
          relationType = '-->';     // 默认为关联关系
        }
      }

      // 添加关系
      classCode += `  ${this.escapeText(rel.from)} ${relationType} ${this.escapeText(rel.to)}`;

      // 如果有标签，添加标签
      if (rel.label) {
        classCode += `: ${this.escapeText(rel.label)}`;
      }

      classCode += '\n';
    }

    // 添加样式和分组
    if (classes.length > 0) {
      // 添加一些样式
      classCode += '\n  %% 添加样式\n';

      // 为不同类型的类添加不同的样式
      const entityClasses = classes.filter(c =>
        c.name.toLowerCase().includes('entity') ||
        c.name.toLowerCase().includes('model') ||
        c.name.toLowerCase().endsWith('po') ||
        c.name.toLowerCase().endsWith('do')
      ).map(c => c.name);

      const serviceClasses = classes.filter(c =>
        c.name.toLowerCase().includes('service') ||
        c.name.toLowerCase().includes('manager')
      ).map(c => c.name);

      const controllerClasses = classes.filter(c =>
        c.name.toLowerCase().includes('controller') ||
        c.name.toLowerCase().includes('resource') ||
        c.name.toLowerCase().includes('api')
      ).map(c => c.name);

      // 添加样式
      if (entityClasses.length > 0) {
        classCode += `  classDef entity fill:#f9f9f9,stroke:#999,stroke-width:1px\n`;
        classCode += `  class ${entityClasses.join(',')} entity\n`;
      }

      if (serviceClasses.length > 0) {
        classCode += `  classDef service fill:#e1f5fe,stroke:#4fc3f7,stroke-width:1px\n`;
        classCode += `  class ${serviceClasses.join(',')} service\n`;
      }

      if (controllerClasses.length > 0) {
        classCode += `  classDef controller fill:#e8f5e9,stroke:#66bb6a,stroke-width:1px\n`;
        classCode += `  class ${controllerClasses.join(',')} controller\n`;
      }

      // 添加接口样式
      const interfaceClasses = classes.filter(c =>
        c.name.startsWith('I') ||
        c.name.toLowerCase().includes('interface')
      ).map(c => c.name);

      if (interfaceClasses.length > 0) {
        classCode += `  classDef interface fill:#fffde7,stroke:#ffd54f,stroke-width:1px,stroke-dasharray: 5 5\n`;
        classCode += `  class ${interfaceClasses.join(',')} interface\n`;
      }
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

    // 添加显示配置
    pieCode += '  showData\n';  // 显示数据值

    // 计算总和，用于添加百分比
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

    // 添加数据，并计算百分比
    for (const item of data) {
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
      pieCode += `  "${this.escapeText(item.label)} (${percentage}%)" : ${item.value}\n`;
    }

    return pieCode;
  }

  /**
   * 生成条形图
   * @param title 标题
   * @param data 数据列表
   * @returns Mermaid代码
   */
  generateBarChart(title: string, data: any[]): string {
    // 使用Mermaid的新图表语法
    let barCode = 'graph TD\n';
    barCode += `  title ${this.escapeText(title)}\n`;

    // 添加样式
    barCode += '  %% 样式定义\n';
    barCode += '  classDef bar fill:#2196F3,stroke:#1976D2,stroke-width:1px,color:white;\n';
    barCode += '  classDef label fill:none,stroke:none,color:black;\n';

    // 找出最大值，用于计算比例
    const maxValue = Math.max(...data.map(item => item.value || 0));
    const scale = maxValue > 0 ? 100 / maxValue : 1; // 缩放到最大100单位

    // 添加数据
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const barLength = Math.max(1, Math.round((item.value || 0) * scale)); // 至少1个单位长

      // 添加标签节点
      barCode += `  label${i}["${this.escapeText(item.label)}"] --> bar${i}\n`;
      barCode += `  class label${i} label\n`;

      // 添加条形节点
      barCode += `  bar${i}["${item.value}"] --> value${i}\n`;
      barCode += `  class bar${i} bar\n`;

      // 添加值节点（隐藏）
      barCode += `  value${i}["${' '.repeat(barLength)}"] --> next${i}\n`;
      barCode += `  style value${i} fill:none,stroke:none\n`;

      // 添加下一个节点（用于布局）
      if (i < data.length - 1) {
        barCode += `  next${i}[""] --> label${i + 1}\n`;
        barCode += `  style next${i} fill:none,stroke:none\n`;
      } else {
        barCode += `  next${i}[""] \n`;
        barCode += `  style next${i} fill:none,stroke:none\n`;
      }
    }

    return barCode;
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
    let description = '';

    // 提取内容文本，用于生成图表和描述
    const contentText = content.explanation || content.summary || '';

    // 根据内容类型选择合适的图表类型
    switch (contentType) {
      case 'concept':
        // 生成思维导图
        description = '思维导图展示了核心概念及其关联知识点，帮助您理解概念之间的关系。';
        mermaidCode = this.generateMindMap(title, content.concepts || []);
        break;

      case 'process':
        // 生成流程图
        description = '流程图展示了步骤的顺序和逻辑关系，帮助您理解整个过程。';
        const steps = this.extractProcessSteps(contentText);
        mermaidCode = this.generateFlowchart(title, steps);
        break;

      case 'comparison':
        // 根据数据特点选择饼图或条形图
        const comparisonData = this.extractComparisonData(contentText);

        // 如果数据项超过5个，使用条形图，否则使用饼图
        if (comparisonData.length > 5) {
          description = '条形图展示了各项的数值比较，适合展示多个数据项的对比。';
          mermaidCode = this.generateBarChart(title, comparisonData);
        } else {
          description = '饼图展示了各部分在整体中的占比，帮助您理解比例关系。';
          mermaidCode = this.generatePieChart(title, comparisonData);
        }
        break;

      case 'sequence':
        // 生成时序图
        description = '时序图展示了对象之间的交互顺序，帮助您理解系统的行为和通信过程。';
        const actors = this.extractActors(contentText);
        const interactions = this.extractInteractions(contentText, actors);
        mermaidCode = this.generateSequenceDiagram(title, actors, interactions);
        break;

      case 'class':
        // 生成类图
        description = '类图展示了类的结构和类之间的关系，帮助您理解系统的静态结构。';
        const classes = this.extractClasses(contentText);
        const relationships = this.extractRelationships(contentText, classes);
        mermaidCode = this.generateClassDiagram(title, classes, relationships);
        break;

      case 'bar':
        // 直接生成条形图
        description = '条形图展示了各项的数值比较，适合展示数据的排序和大小关系。';
        const barData = this.extractComparisonData(contentText);
        mermaidCode = this.generateBarChart(title, barData);
        break;

      case 'pie':
        // 直接生成饼图
        description = '饼图展示了各部分在整体中的占比，帮助您理解比例关系。';
        const pieData = this.extractComparisonData(contentText);
        mermaidCode = this.generatePieChart(title, pieData);
        break;

      default:
        // 根据内容特点自动选择合适的图表类型
        if (contentText.toLowerCase().includes('步骤') ||
          contentText.toLowerCase().includes('流程') ||
          contentText.toLowerCase().includes('过程')) {
          description = '流程图展示了步骤的顺序和逻辑关系，帮助您理解整个过程。';
          const autoSteps = this.extractProcessSteps(contentText);
          mermaidCode = this.generateFlowchart(title, autoSteps);
          contentType = 'process';
        } else if (contentText.toLowerCase().includes('比较') ||
          contentText.toLowerCase().includes('对比') ||
          contentText.toLowerCase().includes('百分比')) {
          description = '比较图展示了各项的数值对比，帮助您理解数据之间的关系。';
          const autoCompData = this.extractComparisonData(contentText);
          mermaidCode = autoCompData.length > 5 ?
            this.generateBarChart(title, autoCompData) :
            this.generatePieChart(title, autoCompData);
          contentType = 'comparison';
        } else if (contentText.toLowerCase().includes('交互') ||
          contentText.toLowerCase().includes('通信') ||
          contentText.toLowerCase().includes('请求')) {
          description = '时序图展示了对象之间的交互顺序，帮助您理解系统的行为和通信过程。';
          const autoActors = this.extractActors(contentText);
          const autoInteractions = this.extractInteractions(contentText, autoActors);
          mermaidCode = this.generateSequenceDiagram(title, autoActors, autoInteractions);
          contentType = 'sequence';
        } else if (contentText.toLowerCase().includes('类') ||
          contentText.toLowerCase().includes('接口') ||
          contentText.toLowerCase().includes('继承')) {
          description = '类图展示了类的结构和类之间的关系，帮助您理解系统的静态结构。';
          const autoClasses = this.extractClasses(contentText);
          const autoRelationships = this.extractRelationships(contentText, autoClasses);
          mermaidCode = this.generateClassDiagram(title, autoClasses, autoRelationships);
          contentType = 'class';
        } else {
          // 默认生成思维导图
          description = '思维导图展示了核心概念及其关联知识点，帮助您理解概念之间的关系。';
          mermaidCode = this.generateMindMap(title, content.concepts || []);
          contentType = 'concept';
        }
    }

    // 生成图表URL
    const diagramUrl = await this.generateMermaidUrl(mermaidCode);

    return {
      type: contentType,
      title,
      description,
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
