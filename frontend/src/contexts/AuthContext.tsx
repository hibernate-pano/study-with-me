'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, learningPathsApi } from '@/lib/api';

// 定义用户类型
interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

// 定义认证上下文类型
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证提供者组件
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // 检查用户是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.getCurrentUser();
        setUser(response.user);
      } catch (error) {
        console.error('获取用户信息失败:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 登录函数
  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await authApi.login({ email, password });

      localStorage.setItem('token', response.session.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);

      // 检查是否有重定向路径
      const redirectPath = sessionStorage.getItem('redirectPath');

      // 检查是否有学习目标
      const learningGoal = sessionStorage.getItem('learningGoal');

      if (redirectPath && redirectPath === '/learning-paths/new' && learningGoal) {
        // 如果重定向路径是学习路径生成页面，并且有学习目标，则先生成学习路径
        try {
          const pathResponse = await learningPathsApi.generate({
            goal: learningGoal,
            userLevel: 'beginner',
            userId: response.user.id
          });

          // 生成成功后，将学习路径ID存储在会话存储中
          sessionStorage.setItem('newPathId', pathResponse.path.id);

          // 清除会话存储中的学习目标
          sessionStorage.removeItem('learningGoal');
          sessionStorage.removeItem('redirectPath');

          // 重定向到学习路径页面
          router.push('/learning-paths/new');
        } catch (error) {
          console.error('生成学习路径失败:', error);
          // 如果生成失败，仍然重定向到学习路径页面，将使用模拟数据
          sessionStorage.removeItem('learningGoal');
          sessionStorage.removeItem('redirectPath');
          router.push('/learning-paths/new');
        }
      } else if (redirectPath) {
        // 如果只有重定向路径，则直接重定向
        sessionStorage.removeItem('redirectPath');
        router.push(redirectPath);
      } else {
        // 否则重定向到首页
        router.push('/');
      }
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 注册函数
  const register = async (email: string, password: string, displayName: string) => {
    setIsLoading(true);

    try {
      const response = await authApi.register({ email, password, displayName });

      localStorage.setItem('token', response.session.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);

      // 检查是否有重定向路径
      const redirectPath = sessionStorage.getItem('redirectPath');
      if (redirectPath) {
        sessionStorage.removeItem('redirectPath');
        router.push(redirectPath);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 登出函数
  const logout = async () => {
    setIsLoading(true);

    try {
      await authApi.logout();

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      setUser(null);

      // 如果当前页面需要认证，则重定向到登录页面
      if (pathname !== '/' && pathname !== '/login' && pathname !== '/register') {
        router.push('/login');
      }
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 提供上下文值
  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 自定义钩子，用于在组件中访问认证上下文
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// 受保护的路由组件
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login' && pathname !== '/register') {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}
