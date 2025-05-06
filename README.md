# Study With Me - AI辅助学习平台

Study With Me 是一个利用人工智能技术帮助用户高效学习的在线平台。该平台能够根据用户的学习目标自动生成个性化的学习路径，提供结构化的学习内容，并通过AI实时辅导解答疑问，全方位提升学习体验和效果。

## 核心功能

- **个性化学习路径**：AI根据用户目标和基础自动生成定制化学习计划
- **结构化知识体系**：将复杂知识拆解为清晰的结构和进阶路径
- **智能实时辅导**：提供24/7的AI辅导，解答疑问，补充知识点
- **多模态学习内容**：融合文本、代码、图表、视频等多种形式
- **进度追踪与激励**：智能跟踪学习进度，通过游戏化元素保持学习动力
- **社区协作学习**：促进用户间的知识分享和协作学习

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
- TailwindCSS + DaisyUI
- SWR/React Query
- TypeScript

### 后端
- Node.js + NestJS
- PostgreSQL + Prisma
- Redis
- JWT认证

### AI服务
- OpenAI GPT-4/Claude/Gemini
- LangChain
- Pinecone/Milvus向量数据库
- 自研RAG系统

## 开发环境设置

### 前提条件
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 6+

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/study-with-me.git
cd study-with-me
```

2. 安装依赖
```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

3. 环境配置
```bash
# 前端环境变量
cp frontend/.env.example frontend/.env.local

# 后端环境变量
cp backend/.env.example backend/.env
```

4. 启动开发服务器
```bash
# 使用Docker Compose启动所有服务
docker-compose up -d

# 或分别启动前后端
# 前端
cd frontend
npm run dev

# 后端
cd backend
npm run start:dev
```

5. 访问应用
- 前端: http://localhost:3000
- 后端API: http://localhost:4000
- API文档: http://localhost:4000/api-docs

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

## 许可证

本项目采用 MIT 许可证 - 详情请参见 [LICENSE](LICENSE) 文件

## 联系方式

项目维护者 - [@yourusername](https://github.com/yourusername)

项目链接: [https://github.com/yourusername/study-with-me](https://github.com/yourusername/study-with-me)
