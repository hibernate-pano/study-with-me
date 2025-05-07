import supabaseService from './supabaseService';

/**
 * 排行榜服务
 */
class LeaderboardService {
  /**
   * 获取学习时间排行榜
   * @param limit 限制数量
   * @param period 时间段 ('week', 'month', 'all')
   * @returns 学习时间排行榜
   */
  async getLearningTimeLeaderboard(limit: number = 10, period: 'week' | 'month' | 'all' = 'week'): Promise<any[]> {
    let query = supabaseService.getClient()
      .from('user_progress')
      .select(`
        user_id,
        users:user_id (
          id,
          display_name,
          avatar_url
        ),
        total_time:time_spent(sum)
      `)
      .not('time_spent', 'is', null);

    // 根据时间段筛选
    if (period !== 'all') {
      const now = new Date();
      let startDate: Date;

      if (period === 'week') {
        // 过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        // 过去30天
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        // 默认为过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      query = query.gte('last_accessed', startDate.toISOString());
    }

    const { data, error } = await query
      .group('user_id, users')
      .order('total_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 获取完成章节数排行榜
   * @param limit 限制数量
   * @returns 完成章节数排行榜
   */
  async getCompletionLeaderboard(limit: number = 10): Promise<any[]> {
    const { data, error } = await supabaseService.getClient()
      .from('user_progress')
      .select(`
        user_id,
        users:user_id (
          id,
          display_name,
          avatar_url
        ),
        completed_count:id(count)
      `)
      .eq('completed', true)
      .group('user_id, users')
      .order('completed_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 获取连续学习天数排行榜
   * @param limit 限制数量
   * @returns 连续学习天数排行榜
   */
  async getStreakLeaderboard(limit: number = 10): Promise<any[]> {
    const { data, error } = await supabaseService.getClient()
      .from('user_streaks')
      .select(`
        user_id,
        users:user_id (
          id,
          display_name,
          avatar_url
        ),
        current_streak,
        longest_streak
      `)
      .order('current_streak', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 获取用户在排行榜中的排名
   * @param userId 用户ID
   * @param type 排行榜类型 ('time', 'completion', 'streak')
   * @param period 时间段 ('week', 'month', 'all')，仅对学习时间排行榜有效
   * @returns 用户排名信息
   */
  async getUserRanking(userId: string, type: 'time' | 'completion' | 'streak', period: 'week' | 'month' | 'all' = 'week'): Promise<any> {
    let ranking: number = 0;
    let userStats: any = null;

    if (type === 'time') {
      // 获取学习时间排行榜
      const leaderboard = await this.getLearningTimeLeaderboard(100, period);

      // 查找用户排名
      const userIndex = leaderboard.findIndex(item => item.user_id === userId);
      if (userIndex !== -1) {
        ranking = userIndex + 1;
        userStats = leaderboard[userIndex];
      } else {
        // 如果用户不在前100名，单独获取用户统计数据
        const { data, error } = await supabaseService.getClient()
          .from('user_progress')
          .select(`
            user_id,
            total_time:time_spent(sum)
          `)
          .eq('user_id', userId)
          .not('time_spent', 'is', null)
          .maybeSingle();

        if (error) {
          throw error;
        }

        userStats = data;

        // 获取用户排名
        if (userStats) {
          const { count, error: countError } = await supabaseService.getClient()
            .from('user_progress')
            .select('user_id', { count: 'exact', head: true })
            .not('time_spent', 'is', null)
            .gt('time_spent', userStats.total_time);

          if (countError) {
            throw countError;
          }

          ranking = count + 1;
        }
      }
    } else if (type === 'completion') {
      // 获取完成章节数排行榜
      const leaderboard = await this.getCompletionLeaderboard(100);

      // 查找用户排名
      const userIndex = leaderboard.findIndex(item => item.user_id === userId);
      if (userIndex !== -1) {
        ranking = userIndex + 1;
        userStats = leaderboard[userIndex];
      } else {
        // 如果用户不在前100名，单独获取用户统计数据
        const { data, error } = await supabaseService.getClient()
          .from('user_progress')
          .select(`
            user_id,
            completed_count:id(count)
          `)
          .eq('user_id', userId)
          .eq('completed', true)
          .group('user_id')
          .maybeSingle();

        if (error) {
          throw error;
        }

        userStats = data;

        // 获取用户排名
        if (userStats) {
          const { count, error: countError } = await supabaseService.getClient()
            .from('user_progress')
            .select('user_id', { count: 'exact', head: true })
            .eq('completed', true)
            .gt('completed_count', userStats.completed_count);

          if (countError) {
            throw countError;
          }

          ranking = count + 1;
        }
      }
    } else if (type === 'streak') {
      // 获取连续学习天数排行榜
      const leaderboard = await this.getStreakLeaderboard(100);

      // 查找用户排名
      const userIndex = leaderboard.findIndex(item => item.user_id === userId);
      if (userIndex !== -1) {
        ranking = userIndex + 1;
        userStats = leaderboard[userIndex];
      } else {
        // 如果用户不在前100名，单独获取用户统计数据
        const { data, error } = await supabaseService.getClient()
          .from('user_streaks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        userStats = data;

        // 获取用户排名
        if (userStats) {
          const { count, error: countError } = await supabaseService.getClient()
            .from('user_streaks')
            .select('user_id', { count: 'exact', head: true })
            .gt('current_streak', userStats.current_streak);

          if (countError) {
            throw countError;
          }

          ranking = count + 1;
        }
      }
    }

    return {
      ranking,
      stats: userStats
    };
  }
}

export default new LeaderboardService();
