import supabaseService from './supabaseService';

/**
 * 成就服务
 */
class AchievementService {
  /**
   * 获取所有成就
   * @returns 所有成就
   */
  async getAllAchievements(): Promise<any[]> {
    const { data, error } = await supabaseService.getClient()
      .from('achievements')
      .select('*')
      .order('title');

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 获取用户已获得的成就
   * @param userId 用户ID
   * @returns 用户已获得的成就
   */
  async getUserAchievements(userId: string): Promise<any[]> {
    const { data, error } = await supabaseService.getClient()
      .from('user_achievements')
      .select(`
        id,
        earned_at,
        achievement:achievement_id (
          id,
          title,
          description,
          icon,
          type
        )
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 检查并授予成就
   * @param userId 用户ID
   */
  async checkAndGrantAchievements(userId: string): Promise<any[]> {
    // 获取所有成就
    const { data: achievements, error: achievementsError } = await supabaseService.getClient()
      .from('achievements')
      .select('*');

    if (achievementsError) {
      throw achievementsError;
    }

    // 获取用户已获得的成就
    const { data: userAchievements, error: userAchievementsError } = await supabaseService.getClient()
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (userAchievementsError) {
      throw userAchievementsError;
    }

    // 已获得的成就ID集合
    const earnedAchievementIds = new Set(userAchievements.map(ua => ua.achievement_id));

    // 获取用户统计数据
    const stats = await supabaseService.getUserLearningStats(userId);

    // 新获得的成就
    const newAchievements: any[] = [];

    // 检查每个成就
    for (const achievement of achievements) {
      // 如果已经获得，跳过
      if (earnedAchievementIds.has(achievement.id)) {
        continue;
      }

      // 根据成就类型和条件检查是否满足
      let isEarned = false;

      switch (achievement.type) {
        case 'chapter_completion':
          isEarned = stats.completedChapters >= achievement.criteria.completed_chapters;
          break;
        case 'path_completion':
          isEarned = stats.totalPaths >= achievement.criteria.completed_paths;
          break;
        case 'learning_time':
          isEarned = stats.totalTimeSpent >= achievement.criteria.time_spent;
          break;
        case 'exercise_completion':
          // 获取用户完成的练习题数量
          const { count, error: exerciseError } = await supabaseService.getClient()
            .from('exercise_results')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_correct', true);

          if (exerciseError) {
            throw exerciseError;
          }

          isEarned = count >= achievement.criteria.completed_exercises;
          break;
        case 'streak':
          // 这里需要实现连续学习天数的检查
          // 暂时跳过，需要额外的数据结构来跟踪用户的学习日期
          break;
      }

      // 如果满足条件，授予成就
      if (isEarned) {
        const { data, error } = await supabaseService.getClient()
          .from('user_achievements')
          .insert([
            {
              user_id: userId,
              achievement_id: achievement.id
            }
          ])
          .select(`
            id,
            earned_at,
            achievement:achievement_id (
              id,
              title,
              description,
              icon,
              type
            )
          `);

        if (error) {
          throw error;
        }

        newAchievements.push(data[0]);
      }
    }

    return newAchievements;
  }
}

export default new AchievementService();
