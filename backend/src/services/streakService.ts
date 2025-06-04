import supabaseService from "./supabaseService";

/**
 * 学习连续性服务
 * 用于跟踪用户的连续学习天数和提供相应的奖励
 */
class StreakService {
  /**
   * 获取用户的学习连续性数据
   * @param userId 用户ID
   * @returns 用户的学习连续性数据
   */
  async getUserStreak(userId: string): Promise<any> {
    // 检查用户是否有学习连续性记录
    const { data: streakData, error: streakError } = await supabaseService
      .getClient()
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (streakError) {
      throw streakError;
    }

    if (!streakData) {
      // 如果没有记录，创建一个新记录
      const { data: newStreakData, error: newStreakError } =
        await supabaseService
          .getClient()
          .from("user_streaks")
          .insert([
            {
              user_id: userId,
              current_streak: 0,
              longest_streak: 0,
              last_activity_date: null,
              streak_start_date: null,
            },
          ])
          .select()
          .single();

      if (newStreakError) {
        throw newStreakError;
      }

      return newStreakData;
    }

    // 检查是否需要重置连续天数
    return await this.checkAndResetStreak(streakData);
  }

  /**
   * 检查并重置连续天数（如果需要）
   * 如果用户超过一天没有学习活动，则重置连续天数
   * @param streakData 用户的连续天数数据
   * @returns 更新后的连续天数数据
   */
  private async checkAndResetStreak(streakData: any): Promise<any> {
    if (!streakData.last_activity_date) {
      return streakData; // 没有上次活动日期，不需要重置
    }

    const lastActivityDate = new Date(streakData.last_activity_date);
    lastActivityDate.setHours(0, 0, 0, 0); // 设置为上次活动日的开始时间

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 设置为今天的开始时间

    // 计算上次活动到今天的天数差
    const diffTime = Math.abs(today.getTime() - lastActivityDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 如果超过一天没有活动（不是昨天也不是今天），则重置连续天数
    if (diffDays > 1) {
      console.log(
        `用户 ${streakData.user_id} 已经 ${diffDays} 天没有学习活动，重置连续天数`
      );

      // 更新数据库，重置连续天数
      const { data: updatedStreakData, error: updateError } =
        await supabaseService
          .getClient()
          .from("user_streaks")
          .update({
            current_streak: 0,
            streak_start_date: null,
          })
          .eq("id", streakData.id)
          .select()
          .single();

      if (updateError) {
        throw updateError;
      }

      return updatedStreakData;
    }

    return streakData;
  }

  /**
   * 更新用户的学习连续性数据
   * @param userId 用户ID
   * @returns 更新后的学习连续性数据
   */
  async updateUserStreak(userId: string): Promise<any> {
    // 获取用户当前的连续性数据
    const streakData = await this.getUserStreak(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 设置为今天的开始时间

    const lastActivityDate = streakData.last_activity_date
      ? new Date(streakData.last_activity_date)
      : null;

    if (lastActivityDate) {
      lastActivityDate.setHours(0, 0, 0, 0); // 设置为上次活动日的开始时间
    }

    let newStreak = streakData.current_streak;
    let streakStartDate = streakData.streak_start_date;

    // 如果今天已经记录过，不再增加连续天数
    if (lastActivityDate && lastActivityDate.getTime() === today.getTime()) {
      // 今天已经记录过，不做任何更改
      return streakData;
    }

    // 如果是第一次记录活动或者连续天数为0
    if (!lastActivityDate || streakData.current_streak === 0) {
      newStreak = 1;
      streakStartDate = today.toISOString();
    }
    // 如果昨天有活动，增加连续天数
    else if (this.isYesterday(lastActivityDate, today)) {
      newStreak += 1;
    }
    // 如果超过一天没有活动，重置连续天数
    else {
      newStreak = 1;
      streakStartDate = today.toISOString();
    }

    // 更新最长连续天数
    const longestStreak = Math.max(newStreak, streakData.longest_streak);

    // 更新数据库
    const { data: updatedStreakData, error: updateError } =
      await supabaseService
        .getClient()
        .from("user_streaks")
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_activity_date: today.toISOString(),
          streak_start_date: streakStartDate,
        })
        .eq("user_id", userId)
        .select()
        .single();

    if (updateError) {
      throw updateError;
    }

    // 检查是否达到新的奖励里程碑
    await this.checkForNewRewards(userId, newStreak);

    return updatedStreakData;
  }

  /**
   * 检查是否达到新的奖励里程碑
   * @param userId 用户ID
   * @param currentStreak 当前连续天数
   */
  private async checkForNewRewards(
    userId: string,
    currentStreak: number
  ): Promise<void> {
    try {
      // 获取所有连续学习奖励
      const { data: allRewards, error: rewardsError } = await supabaseService
        .getClient()
        .from("streak_rewards")
        .select("*")
        .lte("days_required", currentStreak) // 只选择天数要求小于等于当前连续天数的奖励
        .order("days_required", { ascending: true });

      if (rewardsError) {
        throw rewardsError;
      }

      // 获取用户已获得的奖励
      const { data: userRewards, error: userRewardsError } =
        await supabaseService
          .getClient()
          .from("user_streak_rewards")
          .select("reward_id")
          .eq("user_id", userId);

      if (userRewardsError) {
        throw userRewardsError;
      }

      // 已获得的奖励ID集合
      const earnedRewardIds = new Set(userRewards.map((r) => r.reward_id));

      // 筛选出用户未获得但已达到条件的奖励
      const newRewards = allRewards.filter(
        (reward) => !earnedRewardIds.has(reward.id)
      );

      // 自动授予新奖励
      for (const reward of newRewards) {
        await this.grantStreakReward(userId, reward.id);
        console.log(`自动授予用户 ${userId} 奖励: ${reward.title}`);
      }
    } catch (error) {
      console.error("检查新奖励时出错:", error);
    }
  }

  /**
   * 检查是否是连续的两天
   * @param date1 第一个日期
   * @param date2 第二个日期
   * @returns 是否是连续的两天
   */
  private isYesterday(date1: Date, date2: Date): boolean {
    // 计算两个日期之间的天数差
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 1;
  }

  /**
   * 获取用户的连续学习奖励
   * @param userId 用户ID
   * @returns 用户可获得的奖励
   */
  async getStreakRewards(userId: string): Promise<any[]> {
    // 获取用户的连续性数据
    const streakData = await this.getUserStreak(userId);

    // 获取所有连续学习奖励
    const { data: allRewards, error: rewardsError } = await supabaseService
      .getClient()
      .from("streak_rewards")
      .select("*")
      .order("days_required", { ascending: true });

    if (rewardsError) {
      throw rewardsError;
    }

    // 获取用户已获得的奖励
    const { data: userRewards, error: userRewardsError } = await supabaseService
      .getClient()
      .from("user_streak_rewards")
      .select("reward_id")
      .eq("user_id", userId);

    if (userRewardsError) {
      throw userRewardsError;
    }

    // 已获得的奖励ID集合
    const earnedRewardIds = new Set(userRewards.map((r) => r.reward_id));

    // 筛选出用户可获得的奖励
    const availableRewards = allRewards.filter(
      (reward) =>
        !earnedRewardIds.has(reward.id) &&
        streakData.current_streak >= reward.days_required
    );

    return availableRewards;
  }

  /**
   * 授予用户连续学习奖励
   * @param userId 用户ID
   * @param rewardId 奖励ID
   * @returns 授予的奖励
   */
  async grantStreakReward(userId: string, rewardId: string): Promise<any> {
    // 检查奖励是否存在
    const { data: reward, error: rewardError } = await supabaseService
      .getClient()
      .from("streak_rewards")
      .select("*")
      .eq("id", rewardId)
      .single();

    if (rewardError) {
      throw rewardError;
    }

    // 检查用户是否已获得该奖励
    const { data: existingReward, error: existingRewardError } =
      await supabaseService
        .getClient()
        .from("user_streak_rewards")
        .select("*")
        .eq("user_id", userId)
        .eq("reward_id", rewardId)
        .maybeSingle();

    if (existingRewardError) {
      throw existingRewardError;
    }

    if (existingReward) {
      throw new Error("用户已获得该奖励");
    }

    // 获取用户的连续性数据
    const streakData = await this.getUserStreak(userId);

    // 检查用户是否满足获得奖励的条件
    if (streakData.current_streak < reward.days_required) {
      throw new Error("用户不满足获得该奖励的条件");
    }

    // 授予奖励
    const { data: grantedReward, error: grantError } = await supabaseService
      .getClient()
      .from("user_streak_rewards")
      .insert([
        {
          user_id: userId,
          reward_id: rewardId,
          granted_at: new Date().toISOString(),
        },
      ])
      .select(
        `
        id,
        granted_at,
        reward:reward_id (
          id,
          title,
          description,
          days_required,
          reward_type,
          reward_value
        )
      `
      )
      .single();

    if (grantError) {
      throw grantError;
    }

    return grantedReward;
  }
}

export default new StreakService();
