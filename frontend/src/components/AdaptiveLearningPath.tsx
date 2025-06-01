import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  Typography,
  Spin,
  Alert,
  Divider,
  Space,
  Tag,
  Tooltip,
  Modal,
} from "antd";
import {
  RocketOutlined,
  AimOutlined,
  ToolOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../config";

const { Title, Text, Paragraph } = Typography;

interface AdaptiveLearningPathProps {
  pathId: string;
  onPathAdjusted?: (newPathId: string) => void;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  is_customized: boolean;
  original_path_id?: string;
  stages: any[];
}

/**
 * 自适应学习路径组件
 * 展示学习路径并提供个性化调整功能
 */
const AdaptiveLearningPath: React.FC<AdaptiveLearningPathProps> = ({
  pathId,
  onPathAdjusted,
}) => {
  const { user } = useAuth();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // 获取学习路径数据
  useEffect(() => {
    const fetchPath = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${API_URL}/learning-paths/${pathId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        setPath(response.data.data);
      } catch (err: any) {
        console.error("Failed to fetch learning path:", err);
        setError(err.response?.data?.message || "Failed to load learning path");
      } finally {
        setLoading(false);
      }
    };

    if (pathId) {
      fetchPath();
    }
  }, [pathId]);

  // 调整学习路径
  const handleAdjustPath = async () => {
    if (!user || !pathId) return;

    try {
      setAdjusting(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/adaptive/learning-path/adjust`,
        {
          userId: user.id,
          pathId,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success && response.data.data) {
        // 通知父组件路径已调整
        if (onPathAdjusted) {
          onPathAdjusted(response.data.data.id);
        }

        // 更新当前显示的路径
        setPath(response.data.data);
      }
    } catch (err: any) {
      console.error("Failed to adjust learning path:", err);
      setError(err.response?.data?.message || "Failed to adjust learning path");
    } finally {
      setAdjusting(false);
    }
  };

  // 显示信息模态框
  const showAdaptiveInfo = () => {
    setShowInfoModal(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: "16px" }}>加载学习路径中...</Paragraph>
      </div>
    );
  }

  if (error) {
    return (
      <Alert message="加载错误" description={error} type="error" showIcon />
    );
  }

  if (!path) {
    return (
      <Alert
        message="未找到学习路径"
        description="请选择一个有效的学习路径"
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div className="adaptive-learning-path">
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              {path.title}
            </Title>
            {path.is_customized && <Tag color="green">个性化</Tag>}
            <Tooltip title="了解自适应学习路径">
              <InfoCircleOutlined
                onClick={showAdaptiveInfo}
                style={{ cursor: "pointer" }}
              />
            </Tooltip>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<ToolOutlined />}
            onClick={handleAdjustPath}
            loading={adjusting}
            disabled={adjusting}
          >
            {path.is_customized ? "重新调整" : "个性化调整"}
          </Button>
        }
      >
        <Paragraph>{path.description}</Paragraph>

        {path.is_customized && (
          <Alert
            message="个性化学习路径"
            description="此学习路径已根据您的学习进度和表现进行了个性化调整，以提供最适合您的学习体验。"
            type="info"
            showIcon
            icon={<RocketOutlined />}
            style={{ marginBottom: "16px" }}
          />
        )}

        <Divider orientation="left">学习阶段</Divider>

        {path.stages && path.stages.length > 0 ? (
          path.stages.map((stage, index) => (
            <Card
              key={stage.id || index}
              type="inner"
              title={`${index + 1}. ${stage.title}`}
              style={{ marginBottom: "16px" }}
            >
              <Paragraph>{stage.description}</Paragraph>

              <Divider orientation="left" plain>
                章节
              </Divider>

              {stage.chapters && stage.chapters.length > 0 ? (
                <ul style={{ paddingLeft: "20px" }}>
                  {stage.chapters.map((chapter: any, chapterIndex: number) => (
                    <li key={chapter.id || chapterIndex}>
                      <Text strong>{chapter.title}</Text>
                      {chapter.key_points && chapter.key_points.length > 0 && (
                        <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                          {chapter.key_points.map(
                            (point: string, pointIndex: number) => (
                              <Tag
                                key={pointIndex}
                                color="blue"
                                style={{ margin: "2px" }}
                              >
                                {point}
                              </Tag>
                            )
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary">没有章节</Text>
              )}
            </Card>
          ))
        ) : (
          <Text type="secondary">没有学习阶段</Text>
        )}
      </Card>

      <Modal
        title="自适应学习路径"
        open={showInfoModal}
        onCancel={() => setShowInfoModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowInfoModal(false)}>
            关闭
          </Button>,
        ]}
      >
        <div style={{ padding: "10px 0" }}>
          <Title level={5}>什么是自适应学习路径？</Title>
          <Paragraph>
            自适应学习路径是根据您的学习进度、表现和偏好自动调整的个性化学习计划。系统会分析您的学习数据，包括：
          </Paragraph>
          <ul>
            <li>已完成的章节和练习</li>
            <li>强项和弱项知识点</li>
            <li>学习速度和习惯</li>
            <li>练习正确率和完成时间</li>
          </ul>

          <Title level={5}>自适应调整包括：</Title>
          <ul>
            <li>跳过您已掌握的内容</li>
            <li>为薄弱领域添加更多基础内容</li>
            <li>根据您的学习速度调整内容深度和广度</li>
            <li>根据您的学习风格调整内容呈现方式</li>
          </ul>

          <Paragraph>
            <Text strong>注意：</Text>{" "}
            调整后的学习路径将作为新的个性化路径保存，您随时可以返回原始路径。
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};

export default AdaptiveLearningPath;
