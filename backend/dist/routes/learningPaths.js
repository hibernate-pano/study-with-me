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
 * @route POST /api/learning-paths/generate
 * @desc Generate a learning path
 * @access Private
 */
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { goal, userLevel } = req.body;
        const userId = req.body.userId; // In a real app, get this from auth middleware
        if (!goal) {
            return res.status(400).json({ message: 'Learning goal is required' });
        }
        // Generate learning path using AI
        const pathData = yield aiService_1.default.generateLearningPath(goal, userLevel || 'beginner');
        // Save to database
        const savedPath = yield supabaseService_1.default.createLearningPath(userId, pathData);
        res.status(201).json({
            message: 'Learning path generated successfully',
            path: savedPath
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to generate learning path',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/learning-paths/:id
 * @desc Get a learning path by ID
 * @access Private
 */
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pathId = req.params.id;
        const path = yield supabaseService_1.default.getLearningPath(pathId);
        if (!path) {
            return res.status(404).json({ message: 'Learning path not found' });
        }
        res.status(200).json({
            path
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to get learning path',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/learning-paths/user/:userId
 * @desc Get all learning paths for a user
 * @access Private
 */
router.get('/user/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        const paths = yield supabaseService_1.default.getUserLearningPaths(userId);
        res.status(200).json({
            paths
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to get learning paths',
            error: error.message
        });
    }
}));
module.exports = router;
