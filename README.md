# ⛏️ 概念深挖器 (Concept Digger)

输入一个词，**把它挂到你的知识网络上**。

这不只是一个查词器——而是一个帮你**构建知识网络**的学习助手：
你输入任何术语、概念、一段话或完整的学习问题，AI 流式生成一份深度解析，
最关键的是会列出 6-10 个**相关 / 相似 / 相反 / 跨领域**的概念，每个都是可点击的接力棒——
点击后直接深挖下一个概念，**顺着网络一路学下去**。

## 报告包含 8 个模块

| 模块 | 说明 |
|---|---|
| 🎯 一句话定义 | 1-2 句秒懂，长输入会先回应你的具体场景 |
| 📌 核心重点（最重要的事） | 先抓什么、关键变量/机制 |
| ⚠️ 常见误区与易错点 | 「错误认知 → 正确理解」 |
| 🧩 拆解分析 | 拆成 3-5 个部分，讲清关联 |
| 🧭 学习进阶路径 | 零 → 精通，分阶段 + 验证方式 |
| 🌐 **知识网络**（核心） | 前置 / 兄弟 / 后继 / 对立 / 跨领域类比，点击即跳转 |
| 🔍 深入追问 | 自测题检验是否真懂 |
| 📚 推荐资料 + 🔗 联网检索 | 权威资料 + Tavily 实时结果（可选） |

## 你的知识库（纯前端，零后端）

报告**自动保存在浏览器本地（IndexedDB）**，刷新不丢失。**GitHub 登录后自动同步到云端**
（Neon PostgreSQL），换设备照常读取：

- **📂 打开即读**：再次进入同一概念直接显示已存报告，不重复烧 token；点「重新生成」可覆盖更新
- **💾 导出**：一键下载 Markdown 文件
- **🏠 首页存档预览**：最近学过的概念直接出现在首页（实时数据）
- **📚 我的存档**：分析页侧栏列出你学过的所有概念，随时跳回
- **☁️ 登录 + 云同步**（可选）：右上角 GitHub 登录 → 报告/复习卡/复习状态全量同步。
  本地 IndexedDB 是缓存，云端是真相；未登录时行为与纯本地模式完全一致。

> 分享功能（UI）已停用（v1.4 起不再显示分享按钮/只读提示）；旧 `#report=` 链接仍兼容打开。

## 三个帮你“真正掌握”的功能（全部本地、零后端）

- **🗂 复习卡（间隔重复）**：报告里的「🔍 深入追问」自测题自动变成复习卡。
  忘了 → 明天再来；记住了 → 间隔翻倍（1 → 2 → 4 → … → 30 天封顶）。入口在分析页/首页，`/review`。
- **⚖️ 概念对比**：把两个容易混淆的概念放在一起做辨析（一句话辨析 / 五个关键差异 /
  各自场景 / 易混淆点 / 如何协同），入口在分析页“对比”按钮，支持 `?a=&b=` 直达，`/compare`。
  对比报告同样入库（key = `compare:A::B`）。
- **🗺 我的知识网络地图**：所有报告里「🌐 知识网络」自动聚合成一张 SVG 概念图（手写力导向，无 D3）。
  悬停看关系、点击跳转概念，学得越多网越密，`/map`。

本地存储结构：主报告 key = 概念名；深挖报告 key = `drill:<父概念>::<子概念>`；
对比报告 key = `compare:A::B`；复习卡 key = `概念::问题hash`（cards store）；
旧分享链接 `#report=`（lz-string 压缩）仅保留解码兼容。

## 输入可以是

- 一个孤立词：`分布式锁`、`十五规划`、`Kafka` ；
- 一段话或完整问题：`我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？`。

## 快速开始

环境变量放在**项目根目录的 `.env`**（单一来源，已加入 `.gitignore`）。

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env，至少填一个 AI_API_KEY
#    - MiniMax 国内版 key：去 https://platform.minimaxi.com/user-center/basic-information/interface-key 创建
#    - 默认用 MiniMax-M3 模型（中文长文本友好，1M 上下文）
#    - 可选：填 TAVILY_API_KEY 开启「实时资料检索」

# 3. 安装并启动
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

dev/start 命令内部使用 `dotenv-cli` 加载根 `.env`，所以 Next.js 进程能读到所有 key。

## 技术栈（精简到极致）

- **Next.js 15.3**（App Router，前后端一体：AI 调用收在 `/api/analyze` 路由内，密钥只留在服务端）
- **React 19 + Tailwind CSS 4**，仅 `react-markdown` + `lz-string`（旧分享链接解码）两个额外运行时依赖
- **本地知识库**：IndexedDB（原生封装 `lib/storage.ts`，无第三方库）
- **云端同步（可选）**：GitHub OAuth（手写，无 NextAuth）+ Neon PostgreSQL（`@neondatabase/serverless`），
  HttpOnly Cookie 会话，云端为真相、本地为缓存，写操作防抖推送
- **模型默认**：MiniMax 国内版 `MiniMax-M3`（OpenAI 兼容接口，OpenAI 兼容 SSE 流式）
- **联网检索（可选）**：Tavily API
- **关键**：路由内做了 `<thinking>` 标签过滤（M 系列模型会把思考过程包在这个标签里）
- **测试**：Vitest 92 个用例（解析器 / 状态机 / 存储 / 分享编码 / 复习卡调度 / 概念图聚合），`cd frontend && npm test`

## 环境变量（项目根 `.env`）

| 变量 | 必填 | 默认 / 说明 |
|---|---|---|
| `AI_API_URL` | ✅ | 默认 `https://api.minimaxi.com/v1/chat/completions` |
| `AI_API_KEY` | ✅ | MiniMax 国内版 key（https://platform.minimaxi.com 创建） |
| `AI_MODEL_NAME` | ✅ | 默认 `MiniMax-M3`，备选 `MiniMax-M2.7` / `M2.7-highspeed` |
| `TAVILY_API_KEY` | 可选 | 开启「实时资料检索」（https://tavily.com） |
| `TAVILY_MAX_RESULTS` | 可选 | 默认 5 |
| `GITHUB_CLIENT_ID` | 可选（登录/云同步） | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | 可选（登录/云同步） | GitHub OAuth App 的 Client Secret |
| `DATABASE_URL` | 可选（登录/云同步） | Neon PostgreSQL pooled 连接串（https://neon.tech） |

> 登录/云同步需要同时配置上面 3 个变量 + 执行一次 `frontend/db/schema.sql`；
> 不配置则保持纯本地模式，登录按钮不显示。

## 目录结构

```
study-with-me/
├── .env                # 真实环境变量（不提交）
├── .env.example        # 模板（可提交）
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                 首页
│   │   │   ├── analyze/[term]/page.tsx  结果页
│   │   │   ├── compare/page.tsx         概念对比
│   │   │   ├── review/page.tsx          间隔重复复习
│   │   │   ├── map/page.tsx             知识网络地图
│   │   │   └── api/
│   │   │       ├── analyze/route.ts     流式接口 + thinking 过滤
│   │   │       ├── auth/github/route.ts GitHub OAuth 发起
│   │   │       ├── auth/callback/       OAuth 回调（建会话）
│   │   │       ├── auth/me/route.ts     当前用户
│   │   │       ├── auth/logout/route.ts 登出
│   │   │       └── sync/route.ts        云端数据拉取/推送
│   │   ├── components/
│   │   │   ├── SearchBox.tsx
│   │   │   ├── SectionCard.tsx
│   │   │   ├── KnowledgeNetworkCard.tsx
│   │   │   ├── DrillDownDrawer.tsx       深挖抽屉
│   │   │   └── AuthBar.tsx               右上角登录栏（全局）
│   │   └── lib/
│   │       ├── prompt.ts                8 模块 prompt（含知识网络结构）
│   │       ├── stream.ts                Markdown → Section / 摘要抽取
│   │       ├── network.ts               知识网络解析 + 关系定义
│   │       ├── thinkingFilter.ts        流式 <thinking> 过滤
│   │       ├── storage.ts               IndexedDB 报告持久化 + 云推送钩子
│   │       ├── share.ts                 旧分享链接解码（兼容）
│   │       ├── search.ts                Tavily 客户端
│   │       ├── auth.ts                  OAuth/会话纯逻辑
│   │       ├── session.ts               HttpOnly cookie 约定
│   │       ├── db.ts                    Neon 连接 + 数据操作
│   │       ├── cloud.ts                 云同步客户端
│   │       └── sync.ts                  登录态 + 防抖推送协调
│   ├── db/schema.sql                    Neon 表结构（执行一次）
│   └── package.json                     dev = `dotenv -e ../.env -- next dev`
└── vitest 单元测试                        frontend/src/lib/*.test.ts（Vitest，107 用例）
```

## 目录说明

- `frontend/` —— 新应用（唯一需要维护的代码）
- **历史档案**：`legacy-backend/`（旧 Express + Supabase 后端）与 `docs/`（旧项目文档）作为 `study-with-me-archive/` 项目归档至仓库根的 `_archive/` 目录下。
  ```
  ../_archive/study-with-me-archive/legacy-backend/
  ../_archive/study-with-me-archive/old-docs/
  ```
  仅为存档参考，不在本仓库维护。如需查阅旧文档请直接打开这两个路径。