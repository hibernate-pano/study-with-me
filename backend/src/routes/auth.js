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
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const data = yield supabaseService_1.default.createUser(email, password);
        res.status(201).json({
            message: 'User registered successfully',
            user: data.user
        });
    }
    catch (error) {
        res.status(400).json({
            message: 'Registration failed',
            error: error.message
        });
    }
}));
/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const data = yield supabaseService_1.default.signInUser(email, password);
        res.status(200).json({
            message: 'Login successful',
            user: data.user,
            session: data.session
        });
    }
    catch (error) {
        res.status(401).json({
            message: 'Login failed',
            error: error.message
        });
    }
}));
/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Private
 */
router.post('/logout', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield supabaseService_1.default.signOutUser();
        res.status(200).json({
            message: 'Logout successful'
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Logout failed',
            error: error.message
        });
    }
}));
/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield supabaseService_1.default.getCurrentUser();
        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        res.status(200).json({
            user
        });
    }
    catch (error) {
        res.status(401).json({
            message: 'Authentication failed',
            error: error.message
        });
    }
}));
module.exports = router;
