import supabaseService from "./supabaseService";
import aiService from "./aiService";

/**
 * 社交学习服务
 * 处理学习小组、协作学习和社交互动功能
 */
class SocialLearningService {
  /**
   * 创建学习小组
   * @param creatorId 创建者ID
   * @param groupData 小组数据
   * @returns 创建的学习小组
   */
  async createLearningGroup(
    creatorId: string,
    groupData: {
      name: string;
      description: string;
      pathId?: string;
      isPrivate: boolean;
      maxMembers?: number;
      tags?: string[];
    }
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 创建学习小组
      const { data: group, error: groupError } = await supabase
        .from("learning_groups")
        .insert({
          creator_id: creatorId,
          name: groupData.name,
          description: groupData.description,
          path_id: groupData.pathId || null,
          is_private: groupData.isPrivate,
          max_members: groupData.maxMembers || 10,
          tags: groupData.tags || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (groupError) {
        throw new Error(
          `Failed to create learning group: ${groupError.message}`
        );
      }

      // 将创建者添加为组长
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: creatorId,
          role: "admin",
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error("Failed to add creator as admin:", memberError);
        // 回滚小组创建
        await supabase.from("learning_groups").delete().eq("id", group.id);

        throw new Error(
          `Failed to add creator as admin: ${memberError.message}`
        );
      }

      return group;
    } catch (error: any) {
      console.error("Error creating learning group:", error);
      throw new Error(`Failed to create learning group: ${error.message}`);
    }
  }

  /**
   * 加入学习小组
   * @param userId 用户ID
   * @param groupId 小组ID
   * @returns 加入结果
   */
  async joinLearningGroup(userId: string, groupId: string): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 检查小组是否存在
      const { data: group, error: groupError } = await supabase
        .from("learning_groups")
        .select("*, group_members(*)")
        .eq("id", groupId)
        .single();

      if (groupError || !group) {
        throw new Error(
          `Group not found: ${groupError?.message || "Unknown error"}`
        );
      }

      // 检查用户是否已经是成员
      const isMember = group.group_members.some(
        (member: any) => member.user_id === userId
      );
      if (isMember) {
        return {
          success: false,
          message: "User is already a member of this group",
        };
      }

      // 检查小组是否已满
      if (group.group_members.length >= group.max_members) {
        return {
          success: false,
          message: "Group has reached maximum members limit",
        };
      }

      // 添加用户为成员
      const { data: membership, error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: userId,
          role: "member",
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (memberError) {
        throw new Error(`Failed to join group: ${memberError.message}`);
      }

      // 添加通知
      await supabase.from("notifications").insert({
        user_id: group.creator_id,
        type: "group_join",
        content: `New member joined your group "${group.name}"`,
        related_id: groupId,
        created_at: new Date().toISOString(),
        is_read: false,
      });

      return { success: true, membership };
    } catch (error: any) {
      console.error("Error joining learning group:", error);
      throw new Error(`Failed to join learning group: ${error.message}`);
    }
  }

  /**
   * 离开学习小组
   * @param userId 用户ID
   * @param groupId 小组ID
   * @returns 离开结果
   */
  async leaveLearningGroup(userId: string, groupId: string): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 检查用户是否是小组创建者
      const { data: group, error: groupError } = await supabase
        .from("learning_groups")
        .select("creator_id")
        .eq("id", groupId)
        .single();

      if (groupError || !group) {
        throw new Error(
          `Group not found: ${groupError?.message || "Unknown error"}`
        );
      }

      // 如果是创建者，需要转移所有权或删除小组
      if (group.creator_id === userId) {
        // 查找其他管理员
        const { data: admins, error: adminsError } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId)
          .eq("role", "admin")
          .neq("user_id", userId);

        if (!adminsError && admins && admins.length > 0) {
          // 转移所有权给第一个管理员
          await supabase
            .from("learning_groups")
            .update({ creator_id: admins[0].user_id })
            .eq("id", groupId);
        } else {
          // 查找普通成员
          const { data: members, error: membersError } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupId)
            .eq("role", "member")
            .limit(1);

          if (!membersError && members && members.length > 0) {
            // 提升第一个成员为管理员并转移所有权
            await supabase
              .from("group_members")
              .update({ role: "admin" })
              .eq("user_id", members[0].user_id)
              .eq("group_id", groupId);

            await supabase
              .from("learning_groups")
              .update({ creator_id: members[0].user_id })
              .eq("id", groupId);
          } else {
            // 没有其他成员，删除小组
            await supabase.from("learning_groups").delete().eq("id", groupId);

            return {
              success: true,
              message: "Group deleted as you were the only member",
            };
          }
        }
      }

      // 移除成员关系
      const { error: memberError } = await supabase
        .from("group_members")
        .delete()
        .eq("user_id", userId)
        .eq("group_id", groupId);

      if (memberError) {
        throw new Error(`Failed to leave group: ${memberError.message}`);
      }

      return { success: true, message: "Successfully left the group" };
    } catch (error: any) {
      console.error("Error leaving learning group:", error);
      throw new Error(`Failed to leave learning group: ${error.message}`);
    }
  }

  /**
   * 发布小组讨论
   * @param userId 用户ID
   * @param groupId 小组ID
   * @param discussionData 讨论数据
   * @returns 创建的讨论
   */
  async createGroupDiscussion(
    userId: string,
    groupId: string,
    discussionData: {
      title: string;
      content: string;
      type: "question" | "discussion" | "resource" | "other";
      tags?: string[];
      attachments?: string[];
    }
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 验证用户是否是小组成员
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single();

      if (membershipError || !membership) {
        throw new Error(
          "You must be a member of the group to post a discussion"
        );
      }

      // 创建讨论
      const { data: discussion, error: discussionError } = await supabase
        .from("group_discussions")
        .insert({
          group_id: groupId,
          user_id: userId,
          title: discussionData.title,
          content: discussionData.content,
          type: discussionData.type,
          tags: discussionData.tags || [],
          attachments: discussionData.attachments || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (discussionError) {
        throw new Error(
          `Failed to create discussion: ${discussionError.message}`
        );
      }

      // 获取小组成员，为他们创建通知
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", userId); // 排除发布者自己

      if (!membersError && members && members.length > 0) {
        const notifications = members.map((member: any) => ({
          user_id: member.user_id,
          type: "new_discussion",
          content: `New discussion in your group: "${discussionData.title.substring(
            0,
            30
          )}${discussionData.title.length > 30 ? "..." : ""}"`,
          related_id: discussion.id,
          created_at: new Date().toISOString(),
          is_read: false,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      return discussion;
    } catch (error: any) {
      console.error("Error creating group discussion:", error);
      throw new Error(`Failed to create group discussion: ${error.message}`);
    }
  }

  /**
   * 回复小组讨论
   * @param userId 用户ID
   * @param discussionId 讨论ID
   * @param content 回复内容
   * @returns 创建的回复
   */
  async replyToDiscussion(
    userId: string,
    discussionId: string,
    content: string
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 获取讨论信息
      const { data: discussion, error: discussionError } = await supabase
        .from("group_discussions")
        .select("*, learning_groups(*)")
        .eq("id", discussionId)
        .single();

      if (discussionError || !discussion) {
        throw new Error(
          `Discussion not found: ${discussionError?.message || "Unknown error"}`
        );
      }

      // 验证用户是否是小组成员
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", discussion.group_id)
        .single();

      if (membershipError || !membership) {
        throw new Error(
          "You must be a member of the group to reply to a discussion"
        );
      }

      // 创建回复
      const { data: reply, error: replyError } = await supabase
        .from("discussion_replies")
        .insert({
          discussion_id: discussionId,
          user_id: userId,
          content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (replyError) {
        throw new Error(`Failed to create reply: ${replyError.message}`);
      }

      // 通知讨论创建者（如果回复者不是创建者）
      if (userId !== discussion.user_id) {
        await supabase.from("notifications").insert({
          user_id: discussion.user_id,
          type: "discussion_reply",
          content: `Someone replied to your discussion "${discussion.title.substring(
            0,
            30
          )}${discussion.title.length > 30 ? "..." : ""}"`,
          related_id: reply.id,
          created_at: new Date().toISOString(),
          is_read: false,
        });
      }

      return reply;
    } catch (error: any) {
      console.error("Error replying to discussion:", error);
      throw new Error(`Failed to reply to discussion: ${error.message}`);
    }
  }

  /**
   * 创建协作学习会话
   * @param creatorId 创建者ID
   * @param groupId 小组ID
   * @param sessionData 会话数据
   * @returns 创建的学习会话
   */
  async createCollaborativeSession(
    creatorId: string,
    groupId: string,
    sessionData: {
      title: string;
      description: string;
      scheduledStart?: string;
      duration?: number;
      topic: string;
      learningObjectives?: string[];
    }
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 验证用户是否是小组成员
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", creatorId)
        .eq("group_id", groupId)
        .single();

      if (membershipError || !membership) {
        throw new Error(
          "You must be a member of the group to create a collaborative session"
        );
      }

      // 创建协作会话
      const { data: session, error: sessionError } = await supabase
        .from("collaborative_sessions")
        .insert({
          group_id: groupId,
          creator_id: creatorId,
          title: sessionData.title,
          description: sessionData.description,
          scheduled_start:
            sessionData.scheduledStart || new Date().toISOString(),
          duration: sessionData.duration || 60, // 默认60分钟
          topic: sessionData.topic,
          learning_objectives: sessionData.learningObjectives || [],
          status: "scheduled",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(
          `Failed to create collaborative session: ${sessionError.message}`
        );
      }

      // 获取小组成员，为他们创建通知
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", creatorId); // 排除创建者自己

      if (!membersError && members && members.length > 0) {
        const notifications = members.map((member: any) => ({
          user_id: member.user_id,
          type: "new_collaborative_session",
          content: `New collaborative session in your group: "${sessionData.title}"`,
          related_id: session.id,
          created_at: new Date().toISOString(),
          is_read: false,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      return session;
    } catch (error: any) {
      console.error("Error creating collaborative session:", error);
      throw new Error(
        `Failed to create collaborative session: ${error.message}`
      );
    }
  }

  /**
   * 加入协作学习会话
   * @param userId 用户ID
   * @param sessionId 会话ID
   * @returns 加入结果
   */
  async joinCollaborativeSession(
    userId: string,
    sessionId: string
  ): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 获取会话信息
      const { data: session, error: sessionError } = await supabase
        .from("collaborative_sessions")
        .select("*, learning_groups(*)")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error(
          `Session not found: ${sessionError?.message || "Unknown error"}`
        );
      }

      // 验证用户是否是小组成员
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", session.group_id)
        .single();

      if (membershipError || !membership) {
        throw new Error(
          "You must be a member of the group to join this session"
        );
      }

      // 检查用户是否已经加入会话
      const { data: participant, error: participantError } = await supabase
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .single();

      if (!participantError && participant) {
        return {
          success: false,
          message: "You have already joined this session",
        };
      }

      // 添加用户为参与者
      const { data: newParticipant, error: joinError } = await supabase
        .from("session_participants")
        .insert({
          session_id: sessionId,
          user_id: userId,
          role: userId === session.creator_id ? "host" : "participant",
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (joinError) {
        throw new Error(`Failed to join session: ${joinError.message}`);
      }

      // 如果不是创建者，通知创建者
      if (userId !== session.creator_id) {
        await supabase.from("notifications").insert({
          user_id: session.creator_id,
          type: "session_join",
          content: `Someone joined your collaborative session "${session.title}"`,
          related_id: sessionId,
          created_at: new Date().toISOString(),
          is_read: false,
        });
      }

      return { success: true, participant: newParticipant };
    } catch (error: any) {
      console.error("Error joining collaborative session:", error);
      throw new Error(`Failed to join collaborative session: ${error.message}`);
    }
  }

  /**
   * 生成协作学习提示和资源
   * @param sessionId 会话ID
   * @returns 生成的提示和资源
   */
  async generateCollaborationPrompts(sessionId: string): Promise<any> {
    try {
      const supabase = supabaseService.getClient();

      // 获取会话信息
      const { data: session, error: sessionError } = await supabase
        .from("collaborative_sessions")
        .select("*, learning_groups(*)")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error(
          `Session not found: ${sessionError?.message || "Unknown error"}`
        );
      }

      // 获取参与者
      const { data: participants, error: participantsError } = await supabase
        .from("session_participants")
        .select("*, profiles(*)")
        .eq("session_id", sessionId);

      if (participantsError) {
        throw new Error(
          `Failed to fetch participants: ${participantsError.message}`
        );
      }

      // 使用AI生成协作提示
      const prompt = `
        请为以下协作学习会话生成讨论提示、活动建议和学习资源：
        
        会话标题：${session.title}
        会话描述：${session.description || "无描述"}
        主题：${session.topic}
        学习目标：${
          (session.learning_objectives || []).join("、") || "未设置具体目标"
        }
        参与人数：${participants?.length || 0}人
        
        请提供以下内容：
        1. 5个讨论问题，促进深度思考和知识共享
        2. 3个小组协作活动建议，每个活动包含目的和步骤
        3. 相关学习资源推荐（书籍、文章、视频等）
        
        以JSON格式返回，结构如下：
        {
          "discussion_questions": ["问题1", "问题2", ...],
          "collaborative_activities": [
            {
              "title": "活动标题",
              "purpose": "活动目的",
              "steps": ["步骤1", "步骤2", ...]
            },
            ...
          ],
          "resources": [
            {
              "title": "资源标题",
              "type": "book/article/video/etc",
              "description": "简短描述"
            },
            ...
          ]
        }
      `;

      const responseText = await aiService.generateContent(prompt, {
        temperature: 0.7,
        max_tokens: 2000,
      });

      try {
        // 提取JSON部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const collaborationData = JSON.parse(jsonMatch[0]);

          // 保存生成的提示到数据库
          const { data: savedPrompts, error: saveError } = await supabase
            .from("session_resources")
            .insert({
              session_id: sessionId,
              discussion_questions:
                collaborationData.discussion_questions || [],
              collaborative_activities:
                collaborationData.collaborative_activities || [],
              resources: collaborationData.resources || [],
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (saveError) {
            console.error("Failed to save collaboration prompts:", saveError);
          }

          return collaborationData;
        } else {
          throw new Error("No valid JSON found in AI response");
        }
      } catch (error: any) {
        console.error("Failed to parse AI response:", error);
        throw new Error(
          `Failed to generate collaboration prompts: ${error.message}`
        );
      }
    } catch (error: any) {
      console.error("Error generating collaboration prompts:", error);
      throw new Error(
        `Failed to generate collaboration prompts: ${error.message}`
      );
    }
  }

  /**
   * 获取推荐的学习伙伴
   * @param userId 用户ID
   * @param count 推荐数量
   * @returns 推荐的学习伙伴
   */
  async getRecommendedStudyPartners(
    userId: string,
    count: number = 5
  ): Promise<any[]> {
    try {
      const supabase = supabaseService.getClient();

      // 获取用户的学习路径和兴趣
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*, user_progress(*)")
        .eq("id", userId)
        .single();

      if (profileError || !userProfile) {
        throw new Error(
          `Failed to fetch user profile: ${
            profileError?.message || "Unknown error"
          }`
        );
      }

      // 获取用户当前正在学习的路径
      const { data: userPaths, error: pathsError } = await supabase
        .from("user_progress")
        .select("path_id")
        .eq("user_id", userId);

      if (pathsError) {
        throw new Error(`Failed to fetch user paths: ${pathsError.message}`);
      }

      const pathIds = userPaths?.map((p) => p.path_id) || [];

      // 查找学习相同路径的其他用户
      let query = supabase
        .from("profiles")
        .select("*, user_progress(*)")
        .neq("id", userId) // 排除自己
        .limit(count * 2); // 获取更多候选人，后面会过滤

      if (pathIds.length > 0) {
        // 使用 or 条件查询学习相同路径的用户
        query = pathIds.reduce((q, pathId, index) => {
          return q.or(`user_progress.path_id.eq.${pathId}`);
        }, query);
      }

      const { data: candidates, error: candidatesError } = await query;

      if (candidatesError) {
        throw new Error(
          `Failed to fetch candidates: ${candidatesError.message}`
        );
      }

      if (!candidates || candidates.length === 0) {
        // 如果没有找到匹配的用户，返回最近活跃的用户
        const { data: activeUsers, error: activeError } = await supabase
          .from("profiles")
          .select("*")
          .neq("id", userId)
          .order("last_active", { ascending: false })
          .limit(count);

        if (activeError) {
          throw new Error(
            `Failed to fetch active users: ${activeError.message}`
          );
        }

        return activeUsers || [];
      }

      // 计算匹配度分数
      const scoredCandidates = candidates.map((candidate: any) => {
        let score = 0;

        // 相同路径加分
        const candidatePathIds =
          candidate.user_progress?.map((p: any) => p.path_id) || [];
        const commonPaths = pathIds.filter((id) =>
          candidatePathIds.includes(id)
        );
        score += commonPaths.length * 10;

        // 相似兴趣加分
        const userInterests = userProfile.interests || [];
        const candidateInterests = candidate.interests || [];
        const commonInterests = userInterests.filter((interest: string) =>
          candidateInterests.includes(interest)
        );
        score += commonInterests.length * 5;

        // 最近活跃加分
        if (candidate.last_active) {
          const daysSinceActive = Math.floor(
            (Date.now() - new Date(candidate.last_active).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          score += Math.max(0, 10 - daysSinceActive); // 最近10天内活跃加分
        }

        return {
          ...candidate,
          match_score: score,
        };
      });

      // 按匹配度排序并返回前N个
      return scoredCandidates
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, count);
    } catch (error: any) {
      console.error("Error getting recommended study partners:", error);
      throw new Error(
        `Failed to get recommended study partners: ${error.message}`
      );
    }
  }
}

export default new SocialLearningService();
