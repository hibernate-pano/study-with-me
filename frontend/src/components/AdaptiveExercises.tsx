import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../config";

interface AdaptiveExercisesProps {
  chapterId: string;
  count?: number;
  onComplete?: (results: any) => void;
}

interface Exercise {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
  content: string;
  options?: string[];
  difficulty: string;
  knowledge_points: string[];
}

/**
 * 自适应练习组件
 * 根据用户表现自动调整练习难度
 */
const AdaptiveExercises: React.FC<AdaptiveExercisesProps> = ({
  chapterId,
  count = 5,
  onComplete,
}) => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [startTime, setStartTime] = useState<Record<string, number>>({});

  // 获取自适应练习
  useEffect(() => {
    const fetchExercises = async () => {
      if (!user || !chapterId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await axios.post(
          `${API_URL}/adaptive/exercises/generate`,
          {
            userId: user.id,
            chapterId,
            count,
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (response.data.success && response.data.data.exercises) {
          setExercises(response.data.data.exercises);

          // 记录每个练习的开始时间
          const times: Record<string, number> = {};
          response.data.data.exercises.forEach((exercise: Exercise) => {
            times[exercise.id] = Date.now();
          });
          setStartTime(times);
        } else {
          setError("Failed to load exercises");
        }
      } catch (err: any) {
        console.error("Error fetching adaptive exercises:", err);
        setError(err.response?.data?.message || "Failed to load exercises");
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, [user, chapterId, count]);

  // 处理用户答案
  const handleAnswerChange = (exerciseId: string, answer: any) => {
    setUserAnswers((prev) => ({
      ...prev,
      [exerciseId]: answer,
    }));
  };

  // 提交当前练习答案
  const submitAnswer = async () => {
    const currentExercise = exercises[currentExerciseIndex];
    if (!currentExercise) return;

    const exerciseId = currentExercise.id;
    const userAnswer = userAnswers[exerciseId];

    if (!userAnswer) {
      alert("请先回答问题");
      return;
    }

    try {
      setSubmitting(true);

      // 计算花费时间（秒）
      const timeSpent = Math.floor(
        (Date.now() - (startTime[exerciseId] || Date.now())) / 1000
      );

      // 检查答案是否正确（简单实现，实际应由后端判断）
      const isCorrect = checkAnswer(currentExercise, userAnswer);

      // 记录结果
      await axios.post(
        `${API_URL}/adaptive/exercises/result`,
        {
          userId: user?.id,
          exerciseId,
          userAnswer,
          isCorrect,
          timeSpent,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // 更新结果状态
      setResults((prev) => ({
        ...prev,
        [exerciseId]: {
          userAnswer,
          isCorrect,
          timeSpent,
        },
      }));

      // 移动到下一题或完成
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      } else {
        // 所有练习完成
        setCompleted(true);
        if (onComplete) {
          onComplete(results);
        }
      }
    } catch (err: any) {
      console.error("Error submitting answer:", err);
      alert("提交答案失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 检查答案是否正确（简单实现）
  const checkAnswer = (exercise: Exercise, userAnswer: any): boolean => {
    // 这里是简化的检查逻辑，实际应用中应该由后端判断
    // 这里仅作为示例
    return true;
  };

  // 渲染练习题
  const renderExercise = () => {
    if (loading) {
      return <div>加载练习中...</div>;
    }

    if (error) {
      return <div>错误: {error}</div>;
    }

    if (completed) {
      return (
        <div>
          <h3>练习完成！</h3>
          <p>您已完成本章节的练习。</p>
          <button onClick={() => window.location.reload()}>再做一组</button>
        </div>
      );
    }

    if (exercises.length === 0) {
      return <div>没有可用的练习题</div>;
    }

    const currentExercise = exercises[currentExerciseIndex];

    return (
      <div className="exercise-container">
        <div className="exercise-header">
          <span className="exercise-progress">
            {currentExerciseIndex + 1} / {exercises.length}
          </span>
          <span className="exercise-difficulty">
            难度: {currentExercise.difficulty}
          </span>
        </div>

        <div className="exercise-content">
          <h3>{currentExercise.content}</h3>

          {currentExercise.type === "multiple_choice" && (
            <div className="options">
              {currentExercise.options?.map((option, index) => (
                <div key={index} className="option">
                  <input
                    type="radio"
                    id={`option-${index}`}
                    name={`exercise-${currentExercise.id}`}
                    value={option}
                    checked={userAnswers[currentExercise.id] === option}
                    onChange={() =>
                      handleAnswerChange(currentExercise.id, option)
                    }
                  />
                  <label htmlFor={`option-${index}`}>{option}</label>
                </div>
              ))}
            </div>
          )}

          {currentExercise.type === "true_false" && (
            <div className="options">
              <div className="option">
                <input
                  type="radio"
                  id="option-true"
                  name={`exercise-${currentExercise.id}`}
                  value="true"
                  checked={userAnswers[currentExercise.id] === "true"}
                  onChange={() =>
                    handleAnswerChange(currentExercise.id, "true")
                  }
                />
                <label htmlFor="option-true">正确</label>
              </div>
              <div className="option">
                <input
                  type="radio"
                  id="option-false"
                  name={`exercise-${currentExercise.id}`}
                  value="false"
                  checked={userAnswers[currentExercise.id] === "false"}
                  onChange={() =>
                    handleAnswerChange(currentExercise.id, "false")
                  }
                />
                <label htmlFor="option-false">错误</label>
              </div>
            </div>
          )}

          {currentExercise.type === "fill_blank" && (
            <div className="fill-blank">
              <input
                type="text"
                value={userAnswers[currentExercise.id] || ""}
                onChange={(e) =>
                  handleAnswerChange(currentExercise.id, e.target.value)
                }
                placeholder="请输入答案"
              />
            </div>
          )}

          {currentExercise.type === "short_answer" && (
            <div className="short-answer">
              <textarea
                value={userAnswers[currentExercise.id] || ""}
                onChange={(e) =>
                  handleAnswerChange(currentExercise.id, e.target.value)
                }
                placeholder="请输入您的回答"
                rows={5}
              />
            </div>
          )}

          <div className="knowledge-points">
            {currentExercise.knowledge_points.map((point, index) => (
              <span key={index} className="knowledge-point">
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="exercise-actions">
          <button
            onClick={submitAnswer}
            disabled={submitting || !userAnswers[currentExercise.id]}
          >
            {submitting ? "提交中..." : "提交答案"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="adaptive-exercises">
      <h2>自适应练习</h2>
      {renderExercise()}

      <style jsx>{`
        .adaptive-exercises {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .exercise-container {
          border: 1px solid #e8e8e8;
          border-radius: 4px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .exercise-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .exercise-difficulty {
          padding: 2px 8px;
          border-radius: 10px;
          background-color: #f0f0f0;
        }

        .exercise-content {
          margin-bottom: 20px;
        }

        .options {
          margin-top: 15px;
        }

        .option {
          margin-bottom: 10px;
        }

        .fill-blank input,
        .short-answer textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
        }

        .knowledge-points {
          margin-top: 15px;
        }

        .knowledge-point {
          display: inline-block;
          background-color: #e6f7ff;
          color: #1890ff;
          padding: 2px 8px;
          border-radius: 10px;
          margin-right: 8px;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .exercise-actions {
          margin-top: 20px;
          text-align: right;
        }

        button {
          padding: 8px 16px;
          background-color: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:disabled {
          background-color: #d9d9d9;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AdaptiveExercises;
