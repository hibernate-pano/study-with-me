import express from 'express';
import mermaidService from '../services/mermaidService';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route POST /api/diagrams/generate
 * @desc 生成图表
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { chapterId, title, content, diagramType } = req.body;

    if (!chapterId || !title || !content || !diagramType) {
      return res.status(400).json({ message: '章节ID、标题、内容和图表类型是必需的' });
    }

    // 生成图表
    const diagram = await mermaidService.generateDiagramForContent(title, content, diagramType);
    
    // 保存到数据库
    const savedDiagram = await mermaidService.saveDiagram(chapterId, diagram);
    
    res.status(201).json({
      message: '图表生成成功',
      diagram: savedDiagram
    });
  } catch (error: any) {
    res.status(500).json({
      message: '图表生成失败',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagrams/chapter/:chapterId
 * @desc 获取章节的所有图表
 * @access Private
 */
router.get('/chapter/:chapterId', async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    
    const diagrams = await mermaidService.getChapterDiagrams(chapterId);
    
    res.status(200).json({
      diagrams
    });
  } catch (error: any) {
    res.status(500).json({
      message: '获取图表失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagrams/mindmap
 * @desc 生成思维导图
 * @access Private
 */
router.post('/mindmap', async (req, res) => {
  try {
    const { title, concepts } = req.body;

    if (!title || !concepts) {
      return res.status(400).json({ message: '标题和概念列表是必需的' });
    }

    // 生成思维导图代码
    const mermaidCode = mermaidService.generateMindMap(title, concepts);
    
    // 生成图表URL
    const diagramUrl = await mermaidService.generateMermaidUrl(mermaidCode);
    
    res.status(200).json({
      mermaidCode,
      diagramUrl
    });
  } catch (error: any) {
    res.status(500).json({
      message: '思维导图生成失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagrams/flowchart
 * @desc 生成流程图
 * @access Private
 */
router.post('/flowchart', async (req, res) => {
  try {
    const { title, steps } = req.body;

    if (!title || !steps) {
      return res.status(400).json({ message: '标题和步骤列表是必需的' });
    }

    // 生成流程图代码
    const mermaidCode = mermaidService.generateFlowchart(title, steps);
    
    // 生成图表URL
    const diagramUrl = await mermaidService.generateMermaidUrl(mermaidCode);
    
    res.status(200).json({
      mermaidCode,
      diagramUrl
    });
  } catch (error: any) {
    res.status(500).json({
      message: '流程图生成失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagrams/sequence
 * @desc 生成时序图
 * @access Private
 */
router.post('/sequence', async (req, res) => {
  try {
    const { title, actors, interactions } = req.body;

    if (!title || !actors || !interactions) {
      return res.status(400).json({ message: '标题、参与者列表和交互列表是必需的' });
    }

    // 生成时序图代码
    const mermaidCode = mermaidService.generateSequenceDiagram(title, actors, interactions);
    
    // 生成图表URL
    const diagramUrl = await mermaidService.generateMermaidUrl(mermaidCode);
    
    res.status(200).json({
      mermaidCode,
      diagramUrl
    });
  } catch (error: any) {
    res.status(500).json({
      message: '时序图生成失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagrams/class
 * @desc 生成类图
 * @access Private
 */
router.post('/class', async (req, res) => {
  try {
    const { title, classes, relationships } = req.body;

    if (!title || !classes) {
      return res.status(400).json({ message: '标题和类列表是必需的' });
    }

    // 生成类图代码
    const mermaidCode = mermaidService.generateClassDiagram(title, classes, relationships || []);
    
    // 生成图表URL
    const diagramUrl = await mermaidService.generateMermaidUrl(mermaidCode);
    
    res.status(200).json({
      mermaidCode,
      diagramUrl
    });
  } catch (error: any) {
    res.status(500).json({
      message: '类图生成失败',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagrams/pie
 * @desc 生成饼图
 * @access Private
 */
router.post('/pie', async (req, res) => {
  try {
    const { title, data } = req.body;

    if (!title || !data) {
      return res.status(400).json({ message: '标题和数据列表是必需的' });
    }

    // 生成饼图代码
    const mermaidCode = mermaidService.generatePieChart(title, data);
    
    // 生成图表URL
    const diagramUrl = await mermaidService.generateMermaidUrl(mermaidCode);
    
    res.status(200).json({
      mermaidCode,
      diagramUrl
    });
  } catch (error: any) {
    res.status(500).json({
      message: '饼图生成失败',
      error: error.message
    });
  }
});

export = router;
