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
 * @route POST /api/exercises/generate
 * @desc Generate exercises for a chapter
 * @access Private
 */
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { chapterId, difficulty, count } = req.body;
        if (!chapterId) {
            return res.status(400).json({ message: 'Chapter ID is required' });
        }
        // Get chapter content
        const chapterContent = yield supabaseService_1.default.getChapterContent(chapterId);
        if (!chapterContent) {
            return res.status(404).json({ message: 'Chapter content not found' });
        }
        // Generate exercises using AI
        const exercisesData = yield aiService_1.default.generateExercises(chapterContent, difficulty || 'medium', count || 5);
        // Save to database
        const savedExercises = yield supabaseService_1.default.createExercises(chapterId, exercisesData.exercises);
        res.status(201).json({
            message: 'Exercises generated successfully',
            exercises: savedExercises
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to generate exercises',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/exercises/chapter/:chapterId
 * @desc Get exercises for a chapter
 * @access Private
 */
router.get('/chapter/:chapterId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chapterId = req.params.chapterId;
        const exercises = yield supabaseService_1.default.getChapterExercises(chapterId);
        res.status(200).json({
            exercises
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to get exercises',
            error: error.message
        });
    }
}));
module.exports = router;
