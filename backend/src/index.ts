import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import LLMLogger from "./utils/LLMLogger";

// 导入所有路由
import authRouter from "./routes/auth";
import learningPathsRouter from "./routes/learningPaths";
import popularLearningPathsRouter from "./routes/popularLearningPaths";
import contentRouter from "./routes/content";
import tutorRouter from "./routes/tutor";
import progressRouter from "./routes/progress";
import exercisesRouter from "./routes/exercises";
import achievementsRouter from "./routes/achievements";
import streaksRouter from "./routes/streaks";
import leaderboardRouter from "./routes/leaderboard";
import diagramsRouter from "./routes/diagrams";
import logsRouter from "./routes/logs";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Content-Length"],
  })
);
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Basic route
app.get("/", (req, res) => {
  res.send("Study With Me API is running");
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/learning-paths", learningPathsRouter);
app.use("/api/popular-learning-paths", popularLearningPathsRouter);
app.use("/api/content", contentRouter);
app.use("/api/tutor", tutorRouter);
app.use("/api/progress", progressRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/streaks", streaksRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/diagrams", diagramsRouter);
app.use("/api/logs", logsRouter);

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      message: "Something went wrong!",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

// Initialize LLMLogger
console.log(
  `Initializing LLMLogger with log directory: ${LLMLogger["logDir"]}`
);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Log server start with LLMLogger
  const startRequestId = LLMLogger.startRequest({
    type: "server_start",
    port,
    timestamp: new Date().toISOString(),
  });

  LLMLogger.logProcessedContent(startRequestId, "Server started successfully", {
    port,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });

  LLMLogger.endRequest(startRequestId, {
    status: "success",
    message: "Server started successfully",
  });
});

export { supabase };
