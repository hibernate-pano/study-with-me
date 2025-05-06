# Study With Me - AI辅助学习平台

Study With Me 是一个利用人工智能技术帮助用户高效学习的在线平台。该平台能够根据用户的学习目标自动生成个性化的学习路径，提供结构化的学习内容，并通过AI实时辅导解答疑问，全方位提升学习体验和效果。

## 核心功能

- **个性化学习路径**：AI根据用户目标和基础自动生成定制化学习计划
- **结构化知识体系**：将复杂知识拆解为清晰的结构和进阶路径
- **智能实时辅导**：提供24/7的AI辅导，解答疑问，补充知识点
- **课后练习生成**：AI根据学习内容自动生成针对性练习题，帮助巩固所学知识
- **多模态学习内容**：融合文本、代码、图表、视频等多种形式
- **进度追踪与激励**：智能跟踪学习进度，通过游戏化元素保持学习动力

## 项目文档

详细的项目文档位于 `/docs` 目录下：

- [项目概述](/docs/00-项目概述.md)：项目背景、目标和整体规划
- [需求说明](/docs/01-需求说明.md)：详细的功能需求和非功能需求
- [架构设计](/docs/02-架构设计.md)：系统架构、技术选型和数据模型
- [开发计划](/docs/03-开发计划.md)：开发阶段、任务分解和资源规划
- [UI设计](/docs/04-UI设计.md)：设计原则、视觉系统和界面设计
- [技术实现](/docs/05-技术实现.md)：前端、后端、AI服务的实现方案
- [开发记录](/docs/06-开发记录.md)：开发过程中的决策和解决方案

## 技术栈

### 前端
- React + Next.js
- Material UI (Google风格)
- TypeScript
- SWR (数据获取)

### 后端
- Node.js + Express
- TypeScript
- Supabase (PostgreSQL数据库、认证、存储)

### AI服务
- 硅基流动 Qwen/Qwen3-235B-A22B 模型

## 开发环境设置

### 前提条件
- Node.js 18+
- Supabase账号
- 硅基流动API密钥

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/study-with-me.git
cd study-with-me
```

2. 设置Supabase
   - 在Supabase创建新项目
   - 运行`backend/supabase/schema.sql`中的SQL语句设置数据库结构
   - 复制项目URL和API密钥

3. 设置前端
```bash
cd frontend
npm install
cp .env.local.example .env.local
# 编辑.env.local文件，填入Supabase URL和密钥
```

4. 设置后端
```bash
cd backend
npm install
cp .env.example .env
# 编辑.env文件，填入Supabase和AI模型的配置
```

5. 启动开发服务器
```bash
# 前端
cd frontend
npm run dev

# 后端
cd backend
npm run dev
```

6. 访问应用
   - 前端: http://localhost:3000
   - 后端API: http://localhost:4000

## 配置硅基流动 Qwen/Qwen3-235B-A22B 模型

1. 获取硅基流动API密钥
2. 在`backend/.env`文件中配置以下环境变量:
   ```
   AI_API_URL=your_ai_api_url
   AI_API_KEY=your_ai_api_key
   AI_MODEL_NAME=Qwen/Qwen3-235B-A22B
   ```

## 开发指南

### 前端开发

前端使用Next.js的App Router结构，主要页面包括:

- `/`: 首页
- `/learning-paths/new`: 新建学习路径
- `/learning-paths/[pathId]/chapters/[chapterId]`: 章节内容页面

添加新页面时，在`src/app`目录下创建相应的文件夹和`page.tsx`文件。

### 后端开发

后端使用Express框架，API路由包括:

- `/api/auth`: 认证相关API
- `/api/learning-paths`: 学习路径相关API
- `/api/content`: 内容生成相关API
- `/api/tutor`: AI辅导相关API
- `/api/progress`: 学习进度相关API
- `/api/exercises`: 练习题相关API

添加新API时，在`src/routes`目录下创建相应的路由文件，并在`src/index.ts`中注册。

## 贡献指南

我们欢迎各种形式的贡献，包括但不限于：

- 提交Bug报告
- 提出新功能建议
- 改进文档
- 提交代码修复或新功能

### 贡献流程

1. Fork本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个Pull Request

## 部署

### 前端部署

可以使用Vercel部署Next.js应用:

```bash
cd frontend
vercel
```

### 后端部署

可以使用云服务器或Serverless服务部署Express应用:

```bash
cd backend
npm run build
# 使用PM2或其他进程管理器运行
pm2 start dist/index.js
```

## 许可证

本项目采用 MIT 许可证 - 详情请参见 [LICENSE](LICENSE) 文件

## 联系方式

项目维护者 - [@yourusername](https://github.com/yourusername)

项目链接: [https://github.com/yourusername/study-with-me](https://github.com/yourusername/study-with-me)
