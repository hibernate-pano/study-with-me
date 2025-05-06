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
const router = express_1.default.Router();
/**
 * @route POST /api/tutor/chat
 * @desc Get AI response to a question
 * @access Private
 */
router.post('/chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { question, context } = req.body;
        if (!question || !context) {
            return res.status(400).json({ message: 'Question and context are required' });
        }
        // Get AI response
        const answer = yield aiService_1.default.answerQuestion(question, context);
        res.status(200).json({
            message: 'Response generated successfully',
            answer
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to generate response',
            error: error.message
        });
    }
}));
module.exports = router;
