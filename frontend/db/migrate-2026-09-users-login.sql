-- =============================================================================
-- migrate-2026-09-users-login.sql —— 把线上 D1 users.login 从 UNIQUE 降级为普通索引
--
-- 为什么要单独跑这个文件（schema.sql 改了不算数）
--   线上 D1 的 users 表建于 2026-08（commit 51221c5「切换到 Cloudflare D1」），
--   当时 login 是 `TEXT UNIQUE NOT NULL`。仓库里的 frontend/db/schema.sql 后来把它
--   降级成了普通索引，但 D1 不会跟着变：schema.sql 用的是 CREATE TABLE IF NOT EXISTS，
--   表已存在时整条语句是 no-op。**改 schema.sql 对生产没有任何效果**，所以必须手工跑一次。
--
--   唯一约束还挂在生产上时的实际后果（换号场景：同一浏览器登第二个 GitHub 账号，
--   而前者改名后该用户名被回收）：
--     1) 写路径 auth.ts:164 upsertUserFromGithub 的 `ON CONFLICT (github_id)`
--        只声明了 github_id 这一条冲突目标，撞的是 login 唯一约束 → ON CONFLICT
--        不生效、直接抛错。代码有兜底（auth.ts:180 退化成「只更新资料、保留旧显示名」）。
--     2) 读路径 auth.ts:213 getUserBySession 里那句「首次落用户行」的 INSERT 撞约束后
--        被 catch 静默吞掉（auth.ts:222），紧接着 `SELECT ... WHERE github_id = ?1`
--        查不到行 → `rows[0] ?? null` → **cookie 有效、却把人当成游客**。
--   两条都在应用层被兜底掩盖了，所以线上看不出报错，只会表现为「明明登录了却是游客」。
--
-- 执行方式（二选一，两条路都不会把本文件包进显式事务）
--   npx wrangler d1 execute <DB_NAME> --remote --file=frontend/db/migrate-2026-09-users-login.sql
--   Cloudflare D1 控制台 → 选中该库 → Console → 整份粘贴执行
--
--   ❌ 不要用 `wrangler d1 migrations apply`。迁移系统按版本文件执行，本脚本的
--      正确性完全依赖「PRAGMA foreign_keys=OFF 确实生效」，而 SQLite 规定该 PRAGMA
--      在事务内设置是 no-op —— 若执行路径把本文件包进了事务，这句会静默失效。
--
-- 可重复执行：成功跑完之后再跑一次是安全的（login 已经没有唯一约束，语义等价 no-op）。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 步骤 0（可选但强烈建议）：预检，把输出记下来，执行后用来逐项比对
--
--   SELECT 'users'      AS t, COUNT(*) AS rows FROM users
--   UNION ALL SELECT 'sessions',   COUNT(*) FROM sessions
--   UNION ALL SELECT 'reports',    COUNT(*) FROM reports
--   UNION ALL SELECT 'cards',      COUNT(*) FROM cards;
--
--   PRAGMA table_info(users);      -- 必须是 7 列，顺序与步骤 2 的建表语句一致
--
--   SELECT sql FROM sqlite_schema WHERE tbl_name = 'users';
--   -- 期望看到 `login TEXT UNIQUE NOT NULL`。若这里已经是 `login TEXT NOT NULL`，
--   -- 说明生产库早已是新版、这条迁移不必再跑（脚本跑一遍也无害）。
--
--   执行前必须先在 D1 控制台导出 SQL 备份（Database → Export）。本脚本没有事务
--   包裹，中途失败无法 ROLLBACK，备份是唯一的回滚手段。
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 步骤 1：关闭外键强制。
--
--   ★★ 必须作为第一条、在任何语句之外、且不能被包进事务 ★★
--
--   两个 SQLite 硬规则，任何一条踩中就是删库：
--   a) PRAGMA foreign_keys 在事务内设置是 no-op —— 所以本文件刻意不写 BEGIN/COMMIT。
--      代价是「中途出错不能回滚」，用执行前的导出备份兜底。
--   b) DROP TABLE 会对表做一次隐式 DELETE FROM users；只要外键强制还开着，
--      sessions / reports / cards 三张表上的 `ON DELETE CASCADE`
--      （schema.sql:21 / 29 / 42）就会把全站用户数据级联删空，且不可回滚。
--
--   同一个 PRAGMA 还保证下面的 ALTER TABLE ... RENAME 不会去改写子表的
--   REFERENCES 子句 —— 就算被改写了，步骤 4 的 RENAME 会把它改回来，属自愈。
--
--   自检：执行完这句后单独跑 `PRAGMA foreign_keys;`，必须返回 0。是 1 就停下来，
--         换用 D1 控制台 Console 执行整份文件。
-- -----------------------------------------------------------------------------
PRAGMA foreign_keys = OFF;


-- -----------------------------------------------------------------------------
-- 步骤 2：建新表。
--
--   列顺序 / 类型严格照抄线上旧表（见 `git show 51221c5:frontend/db/schema.sql`
--   第 5-13 行，即当初建库那一版），唯一区别是 login 去掉 UNIQUE。
--   **github_id 的 UNIQUE 必须保留** —— auth.ts 的 ON CONFLICT (github_id) 依赖它，
--   它是「同一个人重复登录走更新而不是插新行」的唯一依据，去掉会直接产生重复用户行。
--
--   刻意不写 `DROP TABLE IF EXISTS users_new`：如果这句报 "table users_new already
--   exists"，说明上一次执行是在步骤 3/4 之间中断的，此时 users_new 可能是全量数据
--   的唯一副本。宁可整份脚本中止让人来查，也不要自动 DROP 掉它。
-- -----------------------------------------------------------------------------
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,      -- GitHub 用户 ID（永不变化的主键依据）
  login TEXT NOT NULL,                   -- 降级自 UNIQUE：GitHub 用户名可被回收/改名
  avatar_url TEXT,
  email TEXT,                            -- 可能为 null（GitHub 隐私设置）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);


-- -----------------------------------------------------------------------------
-- 步骤 3：搬数据。
--
--   用 `SELECT *` 而不是显式列名，是把这一步当成一次断言用：列数或列序与线上旧表
--   对不上时这句会直接报错中止，而不是静默丢字段。前提是步骤 0 的
--   `PRAGMA table_info(users)` 确认为 7 列。
-- -----------------------------------------------------------------------------
INSERT INTO users_new SELECT * FROM users;


-- -----------------------------------------------------------------------------
-- 步骤 4：删旧表 + 改名。
--
--   ★ 全脚本唯一危险的一步，DROP TABLE users 会级联删三张子表 —— 见步骤 1 ★
--
--   id 原样搬过去，所以 sessions / reports / cards 里的 user_id 不需要任何改动。
--   AUTOINCREMENT 高水位会按 max(id) 重算（下个自增 id = max(id)+1，不与存量冲突）。
--   代价：若旧库 sqlite_sequence 里记的高水位曾高于 max(id)（历史上删过用户行），
--   这段空隙会被重新利用。users 表实际上只增不删，记录在案。
-- -----------------------------------------------------------------------------
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;


-- -----------------------------------------------------------------------------
-- 步骤 5：重建 login 索引。
--   旧表上 login 的 UNIQUE 是隐式自动索引（sqlite_autoindex_users_*），随旧表
--   一起消失，必须显式补一个普通索引回来。
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);


-- -----------------------------------------------------------------------------
-- 步骤 6：外键自检（SQLite 官方 12 步法的第 10 步，只读、不改数据）。
--   期望返回 0 行。若返回非 0，说明子表里存在指向已不存在 users.id 的孤儿行。
-- -----------------------------------------------------------------------------
PRAGMA foreign_key_check;


-- -----------------------------------------------------------------------------
-- 步骤 7：把外键强制开回去。
-- -----------------------------------------------------------------------------
PRAGMA foreign_keys = ON;


-- =============================================================================
-- 执行后校验（单独跑，不属于迁移本体）
--
--   1) 四张表行数必须与步骤 0 预检记录的数字**逐一相等**。任何一张对不上，
--      立刻从执行前的导出备份恢复，不要继续往下。
--
--      SELECT 'users' AS t, COUNT(*) AS rows FROM users
--      UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
--      UNION ALL SELECT 'reports',  COUNT(*) FROM reports
--      UNION ALL SELECT 'cards',    COUNT(*) FROM cards;
--
--   2) 确认唯一约束真的没了、普通索引建上了：
--
--      SELECT sql FROM sqlite_schema WHERE tbl_name = 'users';
--      -- 期望：CREATE TABLE users (... login TEXT NOT NULL, ...)  且含
--      --       CREATE INDEX idx_users_login ON users(login);
--      -- 不应再出现 sqlite_autoindex（那是 UNIQUE 留下的隐式索引）。
--
--      PRAGMA index_list(users);
--
--   3) 确认 github_id 的唯一性还在（重复行数为 0）：
--
--      SELECT github_id, COUNT(*) c FROM users GROUP BY github_id HAVING c > 1;
--      -- 期望 0 行
--
--   4) 功能验证：用一个新 GitHub 账号（或让 B 账号接管 A 回收掉的用户名）走一遍
--      登录 → 刷新页面 → 顶部显示的是新账号而不是游客。旧账号的数据仍在云同步里。
--
-- 回滚
--   只能用执行前导出的备份整库恢复（D1 控制台 → Database → Import）。
--   本脚本不含事务，无法做语句级回退。
-- =============================================================================
