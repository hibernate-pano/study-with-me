# 概念深挖器 · Frontend

Next.js 15 App Router · React 19 · Tailwind CSS 4 · react-markdown

## 开发

```bash
npm install
cp .env.local.example .env.local   # 填入 AI_API_KEY（必填）
npm run dev                        # http://localhost:3000
```

## 构建（带严格类型 + ESLint 检查）

```bash
npm run build
npm start
```

## 目录

```
src/
├── app/
│   ├── page.tsx                       首页：大输入框 + 示例词 + 最近搜索
│   ├── analyze/[term]/page.tsx        结果页：流式渲染 + 目录 + 折叠/复制/停止
│   ├── api/analyze/route.ts           POST /api/analyze，流式 DeepSeek + 并行 Tavily
│   ├── globals.css                    全局样式（含 Tailwind 主题、Markdown 渲染、骨架屏）
│   └── layout.tsx
├── components/
│   ├── SearchBox.tsx
│   └── SectionCard.tsx
└── lib/
    ├── prompt.ts                      7 个模块的固定 prompt（标题是前后端协议）
    ├── stream.ts                      Markdown → Section 解析 + 标题样式映射
    └── search.ts                      Tavily 检索客户端（无 key 自动跳过）
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `AI_API_URL` | ✅ | 默认 `https://api.siliconflow.cn/v1/chat/completions` |
| `AI_API_KEY` | ✅ | 硅基流动 API Key |
| `AI_MODEL_NAME` | ✅ | 默认 `deepseek-ai/DeepSeek-V3` |
| `TAVILY_API_KEY` | 可选 | 开启「实时资料检索」 |
| `TAVILY_MAX_RESULTS` | 可选 | 默认 5 |

## 改动约定

- **Prompt 中的 `## ` 标题是协议**，前后端靠它切分卡片。若修改，需同步 `lib/prompt.ts` 和 `lib/stream.ts` 的 `styleForTitle`。
- AI 调用走 `app/api/**` 或 `lib/*.ts`（Node 侧），禁止前端直接持有 `AI_*` 变量。
- 流式响应为纯文本 Markdown，前端按 `## ` 切分；不要改成 JSON-SSE。