# Vercel 部署指南

## 一键部署到 Vercel

本项目已配置好 `vercel.json`，Vercel 会自动识别 Next.js 项目。

### 步骤 1：在 Vercel 导入 GitHub 仓库

打开 https://vercel.com/new ，选择 `Import Git Repository` → 选 `hibernate-pano/study-with-me`。

### 步骤 2：配置项目（Vercel 会自动检测）

Vercel 会读 `vercel.json`，自动设置 **Root Directory 为 `frontend`**。

如果没自动设置，手动改：
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`

### 步骤 3：配置环境变量（关键！）

进入 **Project Settings → Environment Variables**，添加：

| Name | Value | 适用环境 |
|---|---|---|
| `AI_API_URL` | `https://api.minimaxi.com/v1/chat/completions` | Production / Preview / Development |
| `AI_API_KEY` | 你的 MiniMax API key（从 https://platform.minimaxi.com 获取） | Production / Preview / Development |
| `AI_MODEL_NAME` | `MiniMax-M3` | Production / Preview / Development |
| `TAVILY_API_KEY` | （可选）联网检索用 | Production / Preview / Development |

> ⚠️ **不要把 `.env` 文件内容粘贴到 Vercel 的 "Import .env" 功能里**——key 会进入仓库历史。
> 改为逐个添加。

### 步骤 4：Deploy

点 **Deploy** 按钮。

构建会跑：
```
cd frontend && pnpm install --frozen-lockfile && pnpm run build
```

约 1-2 分钟完成。

### 步骤 5：访问

部署完成后会得到一个 `xxx.vercel.app` 域名，例如：
```
https://study-with-me-peach-beta.vercel.app（本项目实际域名）
```

> 本项目已在 Vercel 连接 GitHub（`hibernate-pano/study-with-me`），
> **每次 push main 会自动部署到 Production**，无需手动操作。
> 绑定域名：`https://studywithme.panbo.space`（Cloudflare CNAME → `cname.vercel-dns.com`，DNS-only）。

---

## D1 数据库迁移（改表结构必读）

> **一句话：`frontend/db/schema.sql` 只是存档，改它不会影响线上 D1。**
> 改了表结构就必须手工跑一次 `frontend/db/migrate-*.sql`，否则线上库永远停在旧结构。

### 为什么 schema.sql 改了没用

`schema.sql` 里每张表都是 `CREATE TABLE IF NOT EXISTS`，而它的第 2 行也写明了
「已通过 Cloudflare API 自动创建（仅作存档与审计）」。表一旦存在，
`IF NOT EXISTS` 就是 no-op —— 仓库里改了列约束、索引、外键，**生产库一行都不会动**。

应用层很多地方还有 catch 兜底（见 `auth.ts` 的 `upsertUserFromGithub` /
`getUserBySession`），schema 没跟上时**不会报错**，只会安静地走降级分支。
所以「改完 schema.sql 以为生效了」是这类问题最难发现的一种。

### 已有迁移脚本

| 文件 | 作用 | 状态 |
|---|---|---|
| `frontend/db/migrate-2026-09-users-login.sql` | `users.login` 从 `UNIQUE` 降级为普通索引 | 待执行（线上仍是 UNIQUE） |

`login` 之所以不能是唯一键：GitHub 用户名可被回收/改名。UNIQUE 还在时，
「A 改名 → B 接管同名 → A 的浏览器重新登录」会让 B 的落库 INSERT 撞约束；
读路径的 INSERT 被 catch 吞掉后按 `github_id` 反查不到行，
**表现为「明明登录了却是游客」**。`github_id` 的 UNIQUE 保留不动 —— 它才是真正的身份依据。

### 执行流程

数据库名 / ID 见 README「环境变量」一节（`D1_DATABASE_ID`），或 `npx wrangler d1 list` 查名字。

```bash
cd frontend

# 1. 先看当前库长什么样（预检，脚本文件里也有同一组查询）
npx wrangler d1 execute <DB_NAME> --remote --command \
  "SELECT sql FROM sqlite_schema WHERE tbl_name = 'users'"

# 2. 执行迁移
npx wrangler d1 execute <DB_NAME> --remote \
  --file=db/migrate-2026-09-users-login.sql

# 3. 校验：四张表行数必须与执行前逐一相等
npx wrangler d1 execute <DB_NAME> --remote --command \
  "SELECT 'users' AS t, COUNT(*) AS n FROM users
   UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
   UNION ALL SELECT 'reports',  COUNT(*) FROM reports
   UNION ALL SELECT 'cards',    COUNT(*) FROM cards"
```

也可以在 Cloudflare D1 控制台 → 选中该库 → Console 里整份粘贴脚本执行。

**执行前必须在 D1 控制台导出 SQL 备份**（Database → Export）。迁移脚本不带事务
（`PRAGMA foreign_keys` 在事务内设置是 SQLite 规定的 no-op，必须留在事务外），
中途失败无法 ROLLBACK，备份是唯一的回滚手段。

### 两个硬性禁忌

- ❌ **不要用 `wrangler d1 migrations apply` 跑这个脚本。** 迁移系统按版本文件执行，
  一旦把脚本包进事务，`PRAGMA foreign_keys = OFF` 就会静默失效；
  紧接着的 `DROP TABLE users` 会触发 `sessions`/`reports`/`cards` 上的
  `ON DELETE CASCADE`，**把全站用户数据删空**。用 `d1 execute --file` 或控制台。
- ❌ **不要把步骤拆成一条条单独执行。** `PRAGMA foreign_keys` 是会话级的，
  换一条语句就是新会话、设置立刻失效，同样会触发级联删库。

脚本文件里以注释形式写死了两段：**开头的「步骤 0 预检」**（行数基线 + `table_info`
列数确认 + 确认 UNIQUE 还在）和**结尾的「执行后校验」**（行数比对 + 索引确认 +
`github_id` 查重 + 功能验证 + 回滚方式）。照着跑，别跳。

---

## 故障排查

### 构建失败："Cannot find module"
- 确认 Root Directory 设置为 `frontend`
- 检查 Vercel 构建日志

### 运行时错误："AI 接口错误"
- 检查环境变量是否正确填入
- Vercel 控制台 → Functions → 选你的 deployment → Logs

### 流式响应没内容
- Vercel 默认开启 Edge Functions，但 `/api/analyze` 用了 `runtime = "nodejs"`
- 在 `vercel.json` 不用特殊配置，Next.js 会自动用 Node runtime

---

## 自定义域名

Project Settings → Domains → 添加你的域名，Vercel 会自动配 SSL。

---

## 后续每次推送

配置好后，**每次 `git push` 都会自动部署**到 Preview URL（PR）或 Production（main）。

Tag `v1.0.0` 推送后会触发 Preview deployment，但**不影响 Production**。
如需让某个 tag 部署到 Production，可以在 Vercel Dashboard 设置 Git 集成时开启 "Deploy on push to branch"。