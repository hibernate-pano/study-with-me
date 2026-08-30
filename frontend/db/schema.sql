-- 概念深挖器 云端存储 schema（Cloudflare D1 / SQLite）
-- 数据库与表已通过 Cloudflare API 自动创建（无需手动执行本文件，仅作存档与审计）。
-- 时间字段统一为 INTEGER 毫秒（与 JS Date.now() 对齐）。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,      -- GitHub 用户 ID（永不变化的主键依据）
  login TEXT UNIQUE NOT NULL,            -- GitHub 用户名
  avatar_url TEXT,
  email TEXT,                            -- 可能为 null（GitHub 隐私设置）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,                -- crypto 随机 32 字节 hex
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,           -- 毫秒时间戳
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS reports (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  parent_term TEXT,
  relation_type TEXT,
  full_text TEXT NOT NULL,
  related TEXT NOT NULL DEFAULT '[]',    -- JSON 字符串
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS cards (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- AI 限流计数（rateLimit.ts 的 aiAccess）：
-- key 约定：匿名分钟窗 `ip:<ip>:m<窗口起点毫秒>`；登录日配额 `u:<userId>:d<YYYY-MM-DD>`。
-- 过期行不再被命中即自然失效，量级 = 活跃 IP×分钟 + 用户×天，暂不清理。
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
