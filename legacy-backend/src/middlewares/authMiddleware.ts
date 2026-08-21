import { Request, Response, NextFunction } from "express";
import supabaseService from "../services/supabaseService";

/**
 * 身份验证中间件
 * 验证请求中的JWT令牌，确保用户已登录
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从请求头中获取授权令牌
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authorization header missing or invalid format",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token is missing",
      });
      return;
    }

    // 验证令牌
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
      return;
    }

    // 将用户信息添加到请求对象中
    (req as any).user = data.user;

    // 继续处理请求
    next();
  } catch (error: any) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed: " + error.message,
    });
  }
};

/**
 * 可选身份验证中间件
 * 尝试验证令牌，但即使验证失败也允许请求继续
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从请求头中获取授权令牌
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      if (token) {
        // 验证令牌
        const supabase = supabaseService.getClient();
        const { data, error } = await supabase.auth.getUser(token);

        if (!error && data.user) {
          // 将用户信息添加到请求对象中
          (req as any).user = data.user;
        }
      }
    }

    // 无论验证成功与否，都继续处理请求
    next();
  } catch (error) {
    // 出错时也继续处理请求，但不设置用户信息
    next();
  }
};
