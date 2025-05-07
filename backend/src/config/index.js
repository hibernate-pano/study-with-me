"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const config = {
    server: {
        port: process.env.PORT || 4000,
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    supabase: {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_KEY || '',
        serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    },
    ai: {
        apiUrl: process.env.AI_API_URL || '',
        apiKey: process.env.AI_API_KEY || '',
        modelName: process.env.AI_MODEL_NAME || 'deepseek-ai/DeepSeek-V3',
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        jwtExpiration: '24h',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
};
exports.default = config;
