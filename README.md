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

报告**自动保存在浏览器本地（IndexedDB）**，刷新不丢失：

- **📂 打开即读**：再次进入同一概念直接显示已存报告，不重复烧 token；点「重新生成」可覆盖更新
- **📤 分享**：一键复制分享链接，报告全文压缩进 URL hash（`#report=`），对方打开即是只读完整报告
- **💾 导出**：一键下载 Markdown 文件
- **🏠 首页存档预览**：最近学过的概念直接出现在首页（实时数据）
- **📚 我的存档**：分析页侧栏列出你学过的所有概念，随时跳回

本地存储结构：主报告 key = 概念名；深挖报告 key = `drill:<父概念>::<子概念>`。

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
- **React 19 + Tailwind CSS 4**，仅 `react-markdown` + `lz-string`（分享链接压缩）两个额外运行时依赖
- **本地知识库**：IndexedDB（原生封装 `lib/storage.ts`，无第三方库）
- **模型默认**：MiniMax 国内版 `MiniMax-M3`（OpenAI 兼容接口，OpenAI 兼容 SSE 流式）
- **联网检索（可选）**：Tavily API
- **关键**：路由内做了 `<thinking>` 标签过滤（M 系列模型会把思考过程包在这个标签里）
- **测试**：Vitest 61 个用例（解析器 / 状态机 / 存储 / 分享编码），`cd frontend && npm test`

## 环境变量（项目根 `.env`）

| 变量 | 必填 | 默认 / 说明 |
|---|---|---|
| `AI_API_URL` | ✅ | 默认 `https://api.minimaxi.com/v1/chat/completions` |
| `AI_API_KEY` | ✅ | MiniMax 国内版 key（https://platform.minimaxi.com 创建） |
| `AI_MODEL_NAME` | ✅ | 默认 `MiniMax-M3`，备选 `MiniMax-M2.7` / `M2.7-highspeed` |
| `TAVILY_API_KEY` | 可选 | 开启「实时资料检索」（https://tavily.com） |
| `TAVILY_MAX_RESULTS` | 可选 | 默认 5 |

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
│   │   │   └── api/analyze/route.ts     流式接口 + thinking 过滤
│   │   ├── components/
│   │   │   ├── SearchBox.tsx
│   │   │   ├── SectionCard.tsx
│   │   │   ├── KnowledgeNetworkCard.tsx
│   │   │   └── DrillDownDrawer.tsx       深挖抽屉
│   │   └── lib/
│   │       ├── prompt.ts                8 模块 prompt（含知识网络结构）
│   │       ├── stream.ts                Markdown → Section / 摘要抽取
│   │       ├── network.ts               知识网络解析 + 关系定义
│   │       ├── thinkingFilter.ts        流式 <thinking> 过滤
│   │       ├── storage.ts               IndexedDB 报告持久化
│   │       ├── share.ts                 分享链接压缩/解压
│   │       └── search.ts                Tavily 客户端
│   └── package.json                     dev = `dotenv -e ../.env -- next dev`
└── vitest 单元测试                        frontend/src/lib/*.test.ts（Vitest）
```

## 目录说明

- `frontend/` —— 新应用（唯一需要维护的代码）
- **历史档案**：`legacy-backend/`（旧 Express + Supabase 后端）与 `docs/`（旧项目文档）已迁出本仓库，位置：
  ```
  ../study-with-me-archive/legacy-backend/
  ../study-with-me-archive/old-docs/
  ```
  仅为存档参考，不在本仓库维护。如需查阅旧文档请直接打开这两个路径。