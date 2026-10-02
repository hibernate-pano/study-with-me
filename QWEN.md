# 概念深挖器 - 项目说明（AI 助手阅读）

> 本文件用于让后续 AI 会话快速理解项目现状，避免被旧文档误导。

## 项目定位

**概念深挖器（Concept Digger）**：纯自用的个人学习助手，核心是三段闭环——
**深挖（理解）→ 出题（检验）→ 复习卡（间隔重复防遗忘）**。

- 输入术语/概念/一段话/完整学习问题 → AI 流式输出 8 模块深挖报告；「🌐 知识网络」模块里的概念可点击接力深挖，顺着网络一路学下去。
- 上传 PDF → AI 生成题库 → 组卷答题判分（出题大师）。
- 报告「深入追问」自动变成间隔重复复习卡。

**明确不做**：手动打卡/习惯追踪类功能（2026-10-02 拍板删除 today/history 整组，理由：手动记录不反哺学习闭环）。学习统计页 `/trends` 从 IndexedDB 真实学习数据自动计算（深挖/复习/考试事件），零手动输入——口径见 `lib/learning.ts`。

## 架构（只有 frontend/ 一个应用）

- **Next.js 15 App Router**，前后端一体，无独立后端；部署 Vercel
- AI 调用收在 `app/api/**` 路由（服务端，密钥不泄漏）；模型 `.env` 三件套可插拔，默认 MiniMax-M3（OpenAI 兼容流式 SSE），含 `<thinking>` 标签过滤
- 本地知识库：IndexedDB（`lib/storage.ts` 原生封装，无第三方库）；报告打开即读不重复烧 token
- 可选：Tavily 联网检索；GitHub OAuth + Cloudflare D1 云同步（手写，无 NextAuth；不配置则纯本地）
- PDF 解析在浏览器内完成，文件不出本机；GitHub repo 学习只处理公开仓库（私有一律拒绝）

## 页面与 API

| 路由 | 职责 |
|---|---|
| `/` | 首页：大输入框 + 示例 + 知识库统计 + 到期复习提醒 |
| `/analyze/[term]` | 深挖报告：流式渲染、目录侧栏、深挖抽屉、Mermaid 渲染、开讲挑战 |
| `/compare` | 概念对比辨析（`?a=&b=` 直达） |
| `/exam` | 出题大师：PDF→题库→组卷→答题→判分→错题回收 |
| `/map` | 知识网络地图（SVG 力导向，手写无 D3） |
| `/repo/[owner]/[repo]` | GitHub 仓库学习：Atlas 架构地图（结构化 JSON 协议） |
| `/review` | 间隔重复复习（导航挂到期角标） |
| `/trends` | 学习统计：91 天热力图 / 连续天数 / 考试正确率（`lib/learning.ts` 纯逻辑） |
| `/api/analyze` `/api/exam` `/api/repo[/module[/atlas]]` | AI 管线（限流 + 鉴权） |
| `/api/auth/*` `/api/sync` | OAuth 会话 + 云同步（D1） |

全站壳（左侧导航 + ⌘K 命令面板）：`components/AppShell.tsx` + `components/CommandPalette.tsx`。

## 关键文件

| 文件 | 职责 |
|---|---|
| `lib/prompt.ts` | 所有提示词：深挖 8 模块 / 出题 / repo Atlas。**`## ` 模块标题是协议**，前端 `parseSections`/`styleForTitle` 依赖它 |
| `lib/stream.ts` | Markdown → 区块解析（按 `## ` 切分）；流式协议是纯文本 Markdown，别改 JSON-SSE |
| `lib/storage.ts` | IndexedDB：`reports` / `cards` / `exam_sets` 三个 store，`DB_VERSION = 4` |
| `lib/exams.ts` | 出题领域模型：题库解析、组卷（seed 可复现）、判分（与 UI/存储解耦） |
| `lib/atlas.ts` `lib/github.ts` | repo Atlas JSON 协议与 GitHub ingest（服务端专用） |
| `lib/cards.ts` | 复习卡 + 间隔重复调度（1→2→4→…→30 天封顶） |
| `lib/rateLimit.ts` `lib/auth.ts` `lib/session.ts` `lib/db.ts` `lib/cloud.ts` `lib/sync.ts` | 限流 / OAuth / D1 / 云同步 |
| `lib/pdf.ts` | PDF 浏览器内解析（pdfjs-dist） |

## 环境变量（项目根 `.env`）

必填：`AI_API_URL` / `AI_API_KEY` / `AI_MODEL_NAME`（MiniMax 国内版）
可选：`TAVILY_API_KEY`、`GITHUB_CLIENT_ID/SECRET`、`CLOUDFLARE_API_TOKEN/ACCOUNT_ID`、`D1_DATABASE_ID`（后五项为登录/云同步）、`GITHUB_TOKEN`（repo 学习提速；必须 fine-grained 且不给任何 repository scope）

## 常用命令

```bash
cd frontend
npm run dev    # 开发（http://localhost:3000）
npm test       # Vitest（约 400 用例）
npm run lint   # ESLint
npm run build  # 构建（严格类型检查）
```

## 改动约定

1. **提示词模块标题是协议**：`## ` 标题一旦改动，前端解析（`parseSections`）和样式映射（`styleForTitle`）必须同步改。
2. **密钥只在服务端**：所有 `AI_*` 环境变量只允许在 `app/api/**` 或 `lib/*.ts` 的 Node 侧读取。
3. **流式协议为纯文本 Markdown**，前端按 `## ` 切分；不要改成 JSON-SSE，除非同步重写两端。
4. **导航**在 `AppShell.tsx` 的 `NAV` 常量；新增页面记得挂进去（含移动端横滚条）。
5. **测试是 node 环境**（无 jsdom）：`.tsx` 组件行为测不了，用 AST 契约测试或抽纯逻辑到 `lib/*.ts` 再测。
