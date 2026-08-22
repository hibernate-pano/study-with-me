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
cd frontend && npm install && npm run build
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