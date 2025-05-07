import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../config';

/**
 * Service for interacting with Supabase
 */
class SupabaseService {
  private supabase: SupabaseClient;
  private serviceClient: SupabaseClient;

  constructor() {
    // Regular client with anon key (limited permissions)
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.key
    );

    // Service client with service_role key (admin permissions)
    this.serviceClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey
    );
  }

  /**
   * Get the Supabase client
   * @returns The Supabase client
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the Supabase service client (with admin permissions)
   * @returns The Supabase service client
   */
  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  /**
   * Create a new user
   * @param email The user's email
   * @param password The user's password
   * @returns The created user and session
   */
  async createUser(email: string, password: string): Promise<any> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // 如果没有session，尝试立即登录用户
    if (!data.session) {
      try {
        const loginData = await this.signInUser(email, password);
        return loginData;
      } catch (loginError) {
        console.error('Auto login after signup failed:', loginError);
        // 如果登录失败，仍然返回原始数据
        return data;
      }
    }

    return data;
  }

  /**
   * Sign in a user
   * @param email The user's email
   * @param password The user's password
   * @returns The signed in user
   */
  async signInUser(email: string, password: string): Promise<any> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Sign out a user
   */
  async signOutUser(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  /**
   * Get the current user
   * @returns The current user
   */
  async getCurrentUser(): Promise<any> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user;
  }

  /**
   * Create a learning path
   * @param userId The user ID
   * @param pathData The learning path data
   * @returns The created learning path
   */
  async createLearningPath(userId: string, pathData: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('learning_paths')
      .insert([
        {
          user_id: userId,
          title: pathData.title,
          description: pathData.description,
          stages: pathData.stages,
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    return data[0];
  }

  /**
   * Get a learning path by ID
   * @param pathId The learning path ID
   * @returns The learning path
   */
  async getLearningPath(pathId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('learning_paths')
      .select('*')
      .eq('id', pathId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Get all learning paths for a user
   * @param userId The user ID
   * @returns The user's learning paths
   */
  async getUserLearningPaths(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('learning_paths')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create chapter content
   * @param pathId The learning path ID
   * @param chapterData The chapter data
   * @returns The created chapter
   */
  async createChapterContent(pathId: string, chapterData: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('chapter_contents')
      .insert([
        {
          path_id: pathId,
          title: chapterData.title,
          content: chapterData.content,
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    return data[0];
  }

  /**
   * Get chapter content by ID
   * @param chapterId The chapter ID
   * @returns The chapter content
   */
  async getChapterContent(chapterId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('chapter_contents')
      .select('*')
      .eq('id', chapterId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create exercises for a chapter
   * @param chapterId The chapter ID
   * @param exercises The exercises data
   * @returns The created exercises
   */
  async createExercises(chapterId: string, exercises: any[]): Promise<any[]> {
    const exercisesWithChapterId = exercises.map(exercise => ({
      ...exercise,
      chapter_id: chapterId,
    }));

    const { data, error } = await this.supabase
      .from('exercises')
      .insert(exercisesWithChapterId)
      .select();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Get exercises for a chapter
   * @param chapterId The chapter ID
   * @returns The chapter's exercises
   */
  async getChapterExercises(chapterId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('chapter_id', chapterId);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Update user progress
   * @param userId The user ID
   * @param pathId The learning path ID
   * @param chapterId The chapter ID
   * @param progress The progress data
   * @returns The updated progress
   */
  async updateUserProgress(userId: string, pathId: string, chapterId: string, progress: any): Promise<any> {
    // Check if progress record exists
    const { data: existingProgress } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('path_id', pathId)
      .eq('chapter_id', chapterId)
      .maybeSingle();

    if (existingProgress) {
      // Update existing progress
      const { data, error } = await this.supabase
        .from('user_progress')
        .update({
          completed: progress.completed,
          last_accessed: new Date().toISOString(),
          ...progress,
        })
        .eq('id', existingProgress.id)
        .select();

      if (error) {
        throw error;
      }

      return data[0];
    } else {
      // Create new progress record
      const { data, error } = await this.supabase
        .from('user_progress')
        .insert([
          {
            user_id: userId,
            path_id: pathId,
            chapter_id: chapterId,
            completed: progress.completed,
            last_accessed: new Date().toISOString(),
            ...progress,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      return data[0];
    }
  }

  /**
   * Get user progress
   * @param userId The user ID
   * @param pathId The learning path ID
   * @returns The user's progress
   */
  async getUserProgress(userId: string, pathId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('path_id', pathId);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Get user learning statistics
   * @param userId The user ID
   * @returns The user's learning statistics
   */
  async getUserLearningStats(userId: string): Promise<any> {
    // Get all user progress records
    const { data: progressData, error: progressError } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);

    if (progressError) {
      throw progressError;
    }

    // Get all learning paths the user has started
    const { data: pathsData, error: pathsError } = await this.supabase
      .from('learning_paths')
      .select('id, title')
      .in('id', progressData.map(p => p.path_id).filter((v, i, a) => a.indexOf(v) === i));

    if (pathsError) {
      throw pathsError;
    }

    // Calculate statistics
    const totalPaths = pathsData.length;
    const completedChapters = progressData.filter(p => p.completed).length;
    const totalChapters = progressData.length;
    const completionRate = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

    // Get average score if available
    const scores = progressData.filter(p => p.score !== null).map(p => p.score);
    const averageScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;

    // Calculate learning time (if time_spent is tracked)
    const totalTimeSpent = progressData
      .filter(p => p.time_spent)
      .reduce((sum, p) => sum + (p.time_spent || 0), 0);

    // Get last accessed date
    const lastAccessed = progressData.length > 0
      ? new Date(Math.max(...progressData.map(p => new Date(p.last_accessed).getTime())))
      : null;

    return {
      totalPaths,
      completedChapters,
      totalChapters,
      completionRate,
      averageScore,
      totalTimeSpent,
      lastAccessed,
      pathsStarted: pathsData
    };
  }

  /**
   * Get detailed progress statistics for a learning path
   * @param userId The user ID
   * @param pathId The learning path ID
   * @returns Detailed progress statistics
   */
  async getPathProgressStats(userId: string, pathId: string): Promise<any> {
    // Get the learning path
    const { data: path, error: pathError } = await this.supabase
      .from('learning_paths')
      .select('*')
      .eq('id', pathId)
      .single();

    if (pathError) {
      throw pathError;
    }

    // Get all chapters for the path
    const { data: chapters, error: chaptersError } = await this.supabase
      .from('chapter_contents')
      .select('*')
      .eq('path_id', pathId)
      .order('order_index', { ascending: true });

    if (chaptersError) {
      throw chaptersError;
    }

    // Get user progress for all chapters
    const { data: progressData, error: progressError } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('path_id', pathId);

    if (progressError) {
      throw progressError;
    }

    // Map progress to chapters
    const chaptersWithProgress = chapters.map(chapter => {
      const progress = progressData.find(p => p.chapter_id === chapter.id) || null;
      return {
        ...chapter,
        progress: progress ? {
          completed: progress.completed,
          score: progress.score,
          last_accessed: progress.last_accessed,
          completed_at: progress.completed_at,
          time_spent: progress.time_spent
        } : null
      };
    });

    // Calculate overall statistics
    const completedChapters = progressData.filter(p => p.completed).length;
    const totalChapters = chapters.length;
    const completionPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

    // Calculate time statistics
    const totalTimeSpent = progressData
      .filter(p => p.time_spent)
      .reduce((sum, p) => sum + (p.time_spent || 0), 0);

    // Find the last accessed chapter
    const lastAccessedProgress = progressData.length > 0
      ? progressData.reduce((latest, current) =>
        new Date(current.last_accessed) > new Date(latest.last_accessed) ? current : latest,
        progressData[0])
      : null;

    const lastAccessedChapter = lastAccessedProgress
      ? chapters.find(c => c.id === lastAccessedProgress.chapter_id)
      : null;

    return {
      path,
      statistics: {
        completedChapters,
        totalChapters,
        completionPercentage,
        totalTimeSpent,
        lastAccessedChapter: lastAccessedChapter ? {
          id: lastAccessedChapter.id,
          title: lastAccessedChapter.title,
          last_accessed: lastAccessedProgress.last_accessed
        } : null
      },
      chaptersWithProgress
    };
  }

  /**
   * Get user learning time history
   * @param userId The user ID
   * @param period The time period ('day', 'week', 'month')
   * @returns Learning time history data
   */
  async getLearningTimeHistory(userId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    // Get all user progress records with time_spent
    const { data: progressData, error: progressError } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .not('time_spent', 'is', null);

    if (progressError) {
      throw progressError;
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        // Last 24 hours
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'month':
        // Last 30 days
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'week':
      default:
        // Last 7 days
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Filter progress data by date
    const filteredProgressData = progressData.filter(p =>
      new Date(p.last_accessed) >= startDate
    );

    // Group by date
    const timeByDate = filteredProgressData.reduce((acc, curr) => {
      const date = new Date(curr.last_accessed).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += curr.time_spent || 0;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array format for charts
    const timeHistory = Object.entries(timeByDate).map(([date, time]) => ({
      date,
      time_spent: time
    }));

    // Sort by date
    timeHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      period,
      timeHistory
    };
  }
}

export default new SupabaseService();
