-- 概念深挖器 云端存储 schema（Neon PostgreSQL）
-- 执行方式：neon db 控制台 → SQL Editor 粘贴执行，或 psql < schema.sql

-- 用户表：GitHub OAuth 换来的最小信息集
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,      -- GitHub 用户 ID（永不变化的主键依据）
  login TEXT UNIQUE NOT NULL,            -- GitHub 用户名
  avatar_url TEXT,
  email TEXT,                            -- 可能为 null（GitHub 隐私设置）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 会话表：HttpOnly cookie 里的 token 指向这里
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,                -- crypto 随机 32 字节 hex
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 报告表：与 IndexedDB 对齐的 key 语义（概念名 / drill:父::子 / compare:A::B）
CREATE TABLE IF NOT EXISTS reports (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  parent_term TEXT,
  relation_type TEXT,
  full_text TEXT NOT NULL,
  related JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- 复习卡表：间隔调度状态在用户维度
CREATE TABLE IF NOT EXISTS cards (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  due_at BIGINT NOT NULL,
  interval_days INT NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- 动态清理过期会话（Vercel cron 或手动执行）
-- DELETE FROM sessions WHERE expires_at < now();