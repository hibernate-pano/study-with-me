import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import LLMLogger from './utils/LLMLogger';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Basic route
app.get('/', (req, res) => {
  res.send('Study With Me API is running');
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/learning-paths', require('./routes/learningPaths'));
app.use('/api/popular-learning-paths', require('./routes/popularLearningPaths'));
app.use('/api/content', require('./routes/content'));
app.use('/api/tutor', require('./routes/tutor'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/streaks', require('./routes/streaks'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/diagrams', require('./routes/diagrams'));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize LLMLogger
console.log(`Initializing LLMLogger with log directory: ${LLMLogger['logDir']}`);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Log server start with LLMLogger
  const startRequestId = LLMLogger.startRequest({
    type: 'server_start',
    port,
    timestamp: new Date().toISOString()
  });

  LLMLogger.logProcessedContent(startRequestId, 'Server started successfully', {
    port,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });

  LLMLogger.endRequest(startRequestId, {
    status: 'success',
    message: 'Server started successfully'
  });
});

export { supabase };
