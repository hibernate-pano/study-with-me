import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../config";

interface LearningGroupProps {
  groupId?: string;
  onGroupCreated?: (groupId: string) => void;
}

interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  role: "admin" | "member";
  joined_at: string;
  profile?: {
    username: string;
    avatar_url?: string;
  };
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  type: "question" | "discussion" | "resource" | "other";
  tags?: string[];
  reply_count: number;
  user?: {
    username: string;
    avatar_url?: string;
  };
}

interface Group {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  members_count: number;
  path_id?: string;
  path?: {
    title: string;
  };
  tags?: string[];
}

/**
 * 学习小组组件
 * 展示学习小组信息并提供交互功能
 */
const LearningGroup: React.FC<LearningGroupProps> = ({
  groupId,
  onGroupCreated,
}) => {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // 创建小组表单状态
  const [showCreateForm, setShowCreateForm] = useState<boolean>(!groupId);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    pathId: "",
    isPrivate: false,
    tags: "",
  });

  // 讨论表单状态
  const [showDiscussionForm, setShowDiscussionForm] = useState<boolean>(false);
  const [discussionData, setDiscussionData] = useState({
    title: "",
    content: "",
    type: "discussion" as "question" | "discussion" | "resource" | "other",
    tags: "",
  });

  // 获取小组信息
  useEffect(() => {
    if (!groupId) return;

    const fetchGroupData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 获取小组基本信息
        const groupResponse = await axios.get(`${API_URL}/groups/${groupId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (groupResponse.data.success) {
          setGroup(groupResponse.data.data);
        }

        // 获取成员信息
        const membersResponse = await axios.get(
          `${API_URL}/groups/${groupId}/members`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (membersResponse.data.success) {
          setMembers(membersResponse.data.data);

          // 检查当前用户是否是成员
          const userMember = membersResponse.data.data.find(
            (m: GroupMember) => m.user_id === user?.id
          );
          setIsMember(!!userMember);
          setIsAdmin(userMember?.role === "admin");
        }

        // 获取讨论信息
        const discussionsResponse = await axios.get(
          `${API_URL}/groups/${groupId}/discussions`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (discussionsResponse.data.success) {
          setDiscussions(discussionsResponse.data.data);
        }
      } catch (err: any) {
        console.error("Error fetching group data:", err);
        setError(err.response?.data?.message || "Failed to load group data");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [groupId, user?.id]);

  // 处理表单输入变化
  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // 处理讨论表单输入变化
  const handleDiscussionFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setDiscussionData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 创建学习小组
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to create a group");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/adaptive/groups`,
        {
          creatorId: user.id,
          name: formData.name,
          description: formData.description,
          pathId: formData.pathId || undefined,
          isPrivate: formData.isPrivate,
          tags: formData.tags
            ? formData.tags.split(",").map((tag) => tag.trim())
            : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success && response.data.data) {
        if (onGroupCreated) {
          onGroupCreated(response.data.data.id);
        }

        setGroup(response.data.data);
        setShowCreateForm(false);
        setIsMember(true);
        setIsAdmin(true);
      }
    } catch (err: any) {
      console.error("Error creating group:", err);
      setError(err.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  // 加入学习小组
  const handleJoinGroup = async () => {
    if (!user || !groupId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/adaptive/groups/join`,
        {
          userId: user.id,
          groupId,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setIsMember(true);

        // 刷新成员列表
        const membersResponse = await axios.get(
          `${API_URL}/groups/${groupId}/members`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (membersResponse.data.success) {
          setMembers(membersResponse.data.data);
        }
      }
    } catch (err: any) {
      console.error("Error joining group:", err);
      setError(err.response?.data?.message || "Failed to join group");
    } finally {
      setLoading(false);
    }
  };

  // 离开学习小组
  const handleLeaveGroup = async () => {
    if (!user || !groupId) return;

    if (!window.confirm("确定要离开这个学习小组吗？")) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/adaptive/groups/leave`,
        {
          userId: user.id,
          groupId,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setIsMember(false);
        setIsAdmin(false);

        // 如果小组已被删除，重置状态
        if (
          response.data.message === "Group deleted as you were the only member"
        ) {
          setGroup(null);
          setMembers([]);
          setDiscussions([]);
          setShowCreateForm(true);
        } else {
          // 刷新成员列表
          const membersResponse = await axios.get(
            `${API_URL}/groups/${groupId}/members`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );

          if (membersResponse.data.success) {
            setMembers(membersResponse.data.data);
          }
        }
      }
    } catch (err: any) {
      console.error("Error leaving group:", err);
      setError(err.response?.data?.message || "Failed to leave group");
    } finally {
      setLoading(false);
    }
  };

  // 创建讨论
  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !groupId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/adaptive/groups/discussions`,
        {
          userId: user.id,
          groupId,
          title: discussionData.title,
          content: discussionData.content,
          type: discussionData.type,
          tags: discussionData.tags
            ? discussionData.tags.split(",").map((tag) => tag.trim())
            : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success && response.data.data) {
        // 刷新讨论列表
        const discussionsResponse = await axios.get(
          `${API_URL}/groups/${groupId}/discussions`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (discussionsResponse.data.success) {
          setDiscussions(discussionsResponse.data.data);
        }

        // 重置表单
        setDiscussionData({
          title: "",
          content: "",
          type: "discussion",
          tags: "",
        });

        setShowDiscussionForm(false);
      }
    } catch (err: any) {
      console.error("Error creating discussion:", err);
      setError(err.response?.data?.message || "Failed to create discussion");
    } finally {
      setLoading(false);
    }
  };

  // 渲染创建小组表单
  const renderCreateGroupForm = () => {
    return (
      <div className="create-group-form">
        <h2>创建学习小组</h2>
        <form onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label htmlFor="name">小组名称 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              required
              placeholder="输入小组名称"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">小组描述 *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              required
              placeholder="描述小组的目标和活动"
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pathId">关联学习路径（可选）</label>
            <input
              type="text"
              id="pathId"
              name="pathId"
              value={formData.pathId}
              onChange={handleFormChange}
              placeholder="输入学习路径ID"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">标签（用逗号分隔）</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleFormChange}
              placeholder="例如：编程,AI,数学"
            />
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="isPrivate"
              name="isPrivate"
              checked={formData.isPrivate}
              onChange={handleFormChange}
            />
            <label htmlFor="isPrivate">设为私有小组</label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "创建中..." : "创建小组"}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 渲染小组信息
  const renderGroupInfo = () => {
    if (!group) return null;

    return (
      <div className="group-info">
        <h2>{group.name}</h2>
        <p className="group-description">{group.description}</p>

        {group.tags && group.tags.length > 0 && (
          <div className="group-tags">
            {group.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {group.path && (
          <div className="group-path">
            <strong>学习路径：</strong> {group.path.title}
          </div>
        )}

        <div className="group-meta">
          <span>成员数：{members.length}</span>
          <span>
            创建时间：{new Date(group.created_at).toLocaleDateString()}
          </span>
          {group.is_private && <span className="private-badge">私有</span>}
        </div>

        {!isMember ? (
          <button
            className="join-button"
            onClick={handleJoinGroup}
            disabled={loading}
          >
            {loading ? "加入中..." : "加入小组"}
          </button>
        ) : (
          <button
            className="leave-button"
            onClick={handleLeaveGroup}
            disabled={loading}
          >
            {loading ? "处理中..." : "离开小组"}
          </button>
        )}
      </div>
    );
  };

  // 渲染成员列表
  const renderMembers = () => {
    if (members.length === 0) return <p>暂无成员</p>;

    return (
      <div className="members-list">
        <h3>小组成员 ({members.length})</h3>
        <ul>
          {members.map((member) => (
            <li
              key={member.id}
              className={`member ${member.role === "admin" ? "admin" : ""}`}
            >
              {member.profile?.avatar_url && (
                <img
                  src={member.profile.avatar_url}
                  alt={member.profile.username || "用户"}
                  className="avatar"
                />
              )}
              <span className="username">
                {member.profile?.username || "用户"}
              </span>
              {member.role === "admin" && (
                <span className="role-badge">管理员</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // 渲染讨论列表
  const renderDiscussions = () => {
    return (
      <div className="discussions">
        <div className="discussions-header">
          <h3>讨论 ({discussions.length})</h3>
          {isMember && (
            <button
              className="new-discussion-button"
              onClick={() => setShowDiscussionForm(!showDiscussionForm)}
            >
              {showDiscussionForm ? "取消" : "新建讨论"}
            </button>
          )}
        </div>

        {showDiscussionForm && (
          <form className="discussion-form" onSubmit={handleCreateDiscussion}>
            <div className="form-group">
              <label htmlFor="title">标题 *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={discussionData.title}
                onChange={handleDiscussionFormChange}
                required
                placeholder="讨论标题"
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">内容 *</label>
              <textarea
                id="content"
                name="content"
                value={discussionData.content}
                onChange={handleDiscussionFormChange}
                required
                placeholder="讨论内容"
                rows={5}
              />
            </div>

            <div className="form-group">
              <label htmlFor="type">类型 *</label>
              <select
                id="type"
                name="type"
                value={discussionData.type}
                onChange={handleDiscussionFormChange}
                required
              >
                <option value="discussion">讨论</option>
                <option value="question">问题</option>
                <option value="resource">资源分享</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="discussionTags">标签（用逗号分隔）</label>
              <input
                type="text"
                id="discussionTags"
                name="tags"
                value={discussionData.tags}
                onChange={handleDiscussionFormChange}
                placeholder="例如：问题,帮助,资源"
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? "发布中..." : "发布讨论"}
              </button>
            </div>
          </form>
        )}

        {discussions.length === 0 ? (
          <p>暂无讨论</p>
        ) : (
          <ul className="discussions-list">
            {discussions.map((discussion) => (
              <li
                key={discussion.id}
                className={`discussion ${discussion.type}`}
              >
                <div className="discussion-header">
                  <h4>{discussion.title}</h4>
                  <span className={`type-badge ${discussion.type}`}>
                    {discussion.type === "discussion" && "讨论"}
                    {discussion.type === "question" && "问题"}
                    {discussion.type === "resource" && "资源"}
                    {discussion.type === "other" && "其他"}
                  </span>
                </div>

                <div className="discussion-content">
                  {discussion.content.length > 200
                    ? `${discussion.content.substring(0, 200)}...`
                    : discussion.content}
                </div>

                {discussion.tags && discussion.tags.length > 0 && (
                  <div className="discussion-tags">
                    {discussion.tags.map((tag, index) => (
                      <span key={index} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="discussion-meta">
                  <span className="author">
                    {discussion.user?.username || "用户"}
                  </span>
                  <span className="date">
                    {new Date(discussion.created_at).toLocaleDateString()}
                  </span>
                  <span className="replies">{discussion.reply_count} 回复</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (loading && !group) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return <div className="error">错误: {error}</div>;
  }

  if (showCreateForm) {
    return renderCreateGroupForm();
  }

  return (
    <div className="learning-group">
      {renderGroupInfo()}

      <div className="group-content">
        <div className="left-column">{renderDiscussions()}</div>

        <div className="right-column">{renderMembers()}</div>
      </div>

      <style jsx>{`
        .learning-group {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .group-info {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e8e8e8;
        }

        .group-description {
          margin-bottom: 15px;
          line-height: 1.6;
        }

        .group-tags {
          margin-bottom: 15px;
        }

        .tag {
          display: inline-block;
          background-color: #f0f0f0;
          padding: 3px 10px;
          border-radius: 12px;
          margin-right: 8px;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .group-meta {
          display: flex;
          margin-bottom: 20px;
        }

        .group-meta span {
          margin-right: 20px;
          font-size: 14px;
          color: #666;
        }

        .private-badge {
          background-color: #ff4d4f;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .join-button,
        .leave-button {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
        }

        .join-button {
          background-color: #1890ff;
          color: white;
        }

        .leave-button {
          background-color: #ff4d4f;
          color: white;
        }

        .group-content {
          display: flex;
          flex-wrap: wrap;
        }

        .left-column {
          flex: 1;
          min-width: 300px;
          margin-right: 20px;
        }

        .right-column {
          width: 250px;
        }

        .members-list {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
        }

        .members-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .member {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          margin-right: 10px;
        }

        .role-badge {
          background-color: #faad14;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 12px;
          margin-left: 10px;
        }

        .discussions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .new-discussion-button {
          background-color: #52c41a;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        .discussions-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .discussion {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #e8e8e8;
          border-radius: 4px;
        }

        .discussion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .discussion-header h4 {
          margin: 0;
        }

        .type-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
        }

        .type-badge.discussion {
          background-color: #1890ff;
          color: white;
        }

        .type-badge.question {
          background-color: #faad14;
          color: white;
        }

        .type-badge.resource {
          background-color: #52c41a;
          color: white;
        }

        .type-badge.other {
          background-color: #722ed1;
          color: white;
        }

        .discussion-content {
          margin-bottom: 15px;
          line-height: 1.6;
        }

        .discussion-meta {
          display: flex;
          font-size: 12px;
          color: #666;
        }

        .discussion-meta span {
          margin-right: 15px;
        }

        .create-group-form,
        .discussion-form {
          max-width: 600px;
          margin: 0 auto;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
        }

        .form-group.checkbox {
          display: flex;
          align-items: center;
        }

        .form-group.checkbox input {
          width: auto;
          margin-right: 10px;
        }

        .form-actions {
          text-align: right;
        }

        .form-actions button {
          padding: 8px 16px;
          background-color: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .form-actions button:disabled {
          background-color: #d9d9d9;
          cursor: not-allowed;
        }

        .loading,
        .error {
          text-align: center;
          padding: 40px;
        }

        .error {
          color: #ff4d4f;
        }

        @media (max-width: 768px) {
          .group-content {
            flex-direction: column;
          }

          .left-column {
            margin-right: 0;
            margin-bottom: 20px;
          }

          .right-column {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default LearningGroup;
