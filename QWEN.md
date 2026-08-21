# 概念深挖器 - 项目说明（AI 助手阅读）

> 本文件用于让后续 AI 会话快速理解项目现状，避免被旧文档误导。

## 项目定位（2025 重大整改后）

**旧项目**：Study With Me —— 重型 AI 学习平台（学习路径、登录、成就、排行榜、打卡、离线 PWA），
已**废弃**。旧代码保留在 `legacy-backend/` 与 `docs/`，仅存档，不要再扩展。

**新项目**：概念深挖器（Concept Digger）—— **学习助手 / 知识网络构建器**：
**输入任意术语、概念、一段话或完整学习问题 → 流式输出结构化深挖报告**（8 个模块，含核心的"🌐 知识网络"模块）。

设计哲学：**不是查词器，而是帮你把一个个概念挂到知识网络上的接力棒**。知识网络模块里的每个概念都可点击，点击后直接深挖下一个概念，顺着网络一路学下去。

## 架构（只有 frontend/ 一个应用）

- **Next.js 15 App Router**，前后端一体，无独立后端
- AI 调用在 `frontend/src/app/api/analyze/route.ts`（服务端，密钥不泄漏）
- 模型：硅基流动 `deepseek-ai/DeepSeek-V3`（OpenAI 兼容流式 SSE）
- 可选联网检索：Tavily API（未配 key 则自动跳过）

## 关键文件

| 文件 | 职责 |
|---|---|
| `frontend/src/app/page.tsx` | 首页：大输入框（textarea，支持长输入）+ 示例词 + 场景示例 + 最近搜索(localStorage `cd-recent`) |
| `frontend/src/app/analyze/[term]/page.tsx` | 结果页：流式渲染（120ms 节流）、目录侧栏、折叠/复制/停止/重生成。term 变化（点击知识网络 chip）时原地重新生成。 |
| `frontend/src/app/api/analyze/route.ts` | POST /api/analyze `{term}` → 纯文本 Markdown 流；LLM 与 Tavily 并行，检索结果追加在末尾。含鉴权/限流/友好错误。 |
| `frontend/src/lib/prompt.ts` | 核心提示词：固定 8 个 `## ` 模块标题（前端按标题切卡片，**不可随意改动标题**）；含输入自适应 + 知识网络结构定义 |
| `frontend/src/lib/stream.ts` | Markdown → 区块解析、标题样式映射（含"知识网络"专色） |
| `frontend/src/lib/search.ts` | Tavily 检索客户端 |
| `frontend/src/components/SearchBox.tsx` | 多行 textarea：Enter 提交、Shift+Enter 换行、自动撑高、300 字限制 |
| `frontend/src/components/SectionCard.tsx` | 单个 section 卡片：识别"知识网络"标题用专门渲染器 |
| `frontend/src/components/KnowledgeNetworkCard.tsx` | **解析知识网络 Markdown**（`### 子标题` + `**概念** — 描述`），按关联类型分组渲染成可点击的 chip 组 |

## 环境变量（frontend/.env.local）

必填：`AI_API_URL` / `AI_API_KEY` / `AI_MODEL_NAME`（硅基流动）
可选：`TAVILY_API_KEY` / `TAVILY_MAX_RESULTS`

## 常用命令

```bash
cd frontend
npm run dev    # 开发（http://localhost:3000）
npm run build  # 构建（开启严格类型检查）
```

## 改动约定

1. **提示词模块标题是协议**：`## ` 标题一旦改动，前端解析（`parseSections`）和样式映射（`styleForTitle`）必须同步改。
2. **密钥只在服务端**：所有 `AI_*` 环境变量只允许在 `app/api/**` 或 `lib/*.ts` 的 Node 侧读取。
3. 流式协议为纯文本 Markdown，前端按 `## ` 切分；不要改成 JSON-SSE，除非同步重写两端。
