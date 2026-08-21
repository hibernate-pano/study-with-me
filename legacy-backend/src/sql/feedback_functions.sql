-- 创建获取反馈统计的存储过程
CREATE OR REPLACE FUNCTION get_feedback_stats(p_content_type TEXT, p_content_id TEXT)
RETURNS TABLE (
  feedback_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    feedback_type,
    COUNT(*) as count
  FROM 
    user_feedback
  WHERE 
    content_type = p_content_type
    AND content_id = p_content_id
  GROUP BY 
    feedback_type
  ORDER BY 
    count DESC;
END;
$$ LANGUAGE plpgsql;

-- 创建用户反馈表（如果不存在）
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  feedback_text TEXT,
  path_id TEXT,
  chapter_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user
    FOREIGN KEY(user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_id ON user_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_type ON user_feedback(content_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback_type ON user_feedback(feedback_type); 