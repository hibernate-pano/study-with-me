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
const supabaseService_1 = __importDefault(require("../services/supabaseService"));
const router = express_1.default.Router();
/**
 * @route POST /api/progress/update
 * @desc Update user progress
 * @access Private
 */
router.post('/update', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, pathId, chapterId, progress } = req.body;
        if (!userId || !pathId || !chapterId || !progress) {
            return res.status(400).json({ message: 'User ID, path ID, chapter ID, and progress data are required' });
        }
        // Update progress
        const updatedProgress = yield supabaseService_1.default.updateUserProgress(userId, pathId, chapterId, progress);
        res.status(200).json({
            message: 'Progress updated successfully',
            progress: updatedProgress
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to update progress',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/progress/:userId/:pathId
 * @desc Get user progress for a learning path
 * @access Private
 */
router.get('/:userId/:pathId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        const pathId = req.params.pathId;
        const progress = yield supabaseService_1.default.getUserProgress(userId, pathId);
        res.status(200).json({
            progress
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to get progress',
            error: error.message
        });
    }
}));
module.exports = router;
