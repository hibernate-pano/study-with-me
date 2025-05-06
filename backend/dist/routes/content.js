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
const express_1 = __importDefault(require("express"));
const aiService_1 = __importDefault(require("../services/aiService"));
const supabaseService_1 = __importDefault(require("../services/supabaseService"));
const router = express_1.default.Router();
/**
 * @route POST /api/content/generate
 * @desc Generate chapter content
 * @access Private
 */
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pathId, chapterTitle, keyPoints } = req.body;
        if (!pathId || !chapterTitle || !keyPoints) {
            return res.status(400).json({ message: 'Path ID, chapter title, and key points are required' });
        }
        // Generate chapter content using AI
        const contentData = yield aiService_1.default.generateChapterContent(chapterTitle, keyPoints);
        // Save to database
        const savedContent = yield supabaseService_1.default.createChapterContent(pathId, {
            title: chapterTitle,
            content: contentData
        });
        res.status(201).json({
            message: 'Chapter content generated successfully',
            content: savedContent
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to generate chapter content',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/content/:id
 * @desc Get chapter content by ID
 * @access Private
 */
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chapterId = req.params.id;
        const content = yield supabaseService_1.default.getChapterContent(chapterId);
        if (!content) {
            return res.status(404).json({ message: 'Chapter content not found' });
        }
        res.status(200).json({
            content
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to get chapter content',
            error: error.message
        });
    }
}));
module.exports = router;
