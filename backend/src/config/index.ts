import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    modelName: process.env.AI_MODEL_NAME || 'Qwen/Qwen3-235B-A22B',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: '24h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  mermaidApiUrl: process.env.MERMAID_API_URL || 'https://mermaid.ink/svg',
};

export default config;
