-- 概念深挖器 云端存储 schema（Cloudflare D1 / SQLite）
-- 数据库与表已通过 Cloudflare API 自动创建（无需手动执行本文件，仅作存档与审计）。
-- 时间字段统一为 INTEGER 毫秒（与 JS Date.now() 对齐）。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,      -- GitHub 用户 ID（永不变化的主键依据）
  login TEXT NOT NULL,                   -- GitHub 用户名：可被回收/改名，不可作唯一键
  avatar_url TEXT,
  email TEXT,                            -- 可能为 null（GitHub 隐私设置）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- login 降级为普通索引：GitHub 用户名可被回收，A 改名不回来期间 B 接管同名，
-- UNIQUE 会让 B 的登录 callback 撞约束失败（?auth=error），也会让「首次落用户行」
-- 的读路径 INSERT 撞约束、把 A 静默降级成游客。
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

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
-- key 固定为 `ip:<ip>`（匿名 60s 窗）/ `u:<userId>`（登录日配额）/ `d:ip:<ip>`（匿名日配额），
-- **不把窗口起点编进 key**（早前 `ip:<ip>:m<窗口起点>` 每活跃窗口新增一行、永久累积）；
-- 窗口归属由行上的 updated_at 判定，所以行数只随「独立 IP / 独立用户」增长。
-- 仍存的缺口：不活跃 IP / 不再登录的用户的旧行也长期驻留，彻底回收需要一个
-- 带 D1 凭据的清理端点 + cron（vercel.json crons 只能调度 HTTP 端点、执行不了 SQL）。
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
