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
   * @returns The created user
   */
  async createUser(email: string, password: string): Promise<any> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
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
}

export default new SupabaseService();
