# LLM 调用全周期日志记录

本项目实现了全面的 LLM 调用全周期日志记录功能，用于跟踪和诊断 AI 响应问题。

## 日志存储位置

所有 LLM 调用日志都存储在项目根目录的 `logs/llm` 文件夹中。该文件夹已被添加到 `.gitignore` 文件中，不会被提交到 Git 仓库。

## 日志文件类型

LLM 日志系统会生成以下几种类型的日志文件：

1. **日志摘要文件**：`llm_YYYY-MM-DD.log`
   - 包含当天所有 LLM 调用的摘要信息
   - 每行是一个 JSON 对象，记录了请求、响应和处理过程的关键信息

2. **请求详情文件**：`{requestId}_*.txt`
   - `{requestId}_prompt.txt`：完整的提示词内容
   - `{requestId}_response.txt`：原始 API 响应内容
   - `{requestId}_content.txt`：从响应中提取的内容
   - `{requestId}_processed.txt`：处理后的最终内容
   - `{requestId}_error.json`：错误信息（如果有）

## 日志内容

LLM 日志记录了 LLM 调用的全周期信息，包括：

1. **请求阶段**：
   - 请求 URL、方法、参数
   - 请求头信息（排除敏感信息）
   - 请求体内容（对长内容进行截断）
   - 请求时间戳和上下文信息

2. **响应阶段**：
   - 响应状态码和头信息
   - 原始响应内容（对长内容进行截断）
   - 响应时间和处理耗时
   - JSON 解析结果和结构信息

3. **处理阶段**：
   - 详细的处理步骤记录
   - 内容提取和转换过程
   - 处理耗时和结果信息
   - 特殊情况处理（如 JSON 解析错误）

4. **错误处理**：
   - 详细的错误信息和堆栈跟踪
   - 错误上下文和相关数据
   - 错误类型和阶段信息
   - 恢复措施和后续处理

## 查看日志

项目提供了一个简单的脚本，用于查看和管理 LLM 日志：

```bash
# 查看最新日志
node scripts/view-llm-logs.js

# 查看特定日期的日志
node scripts/view-llm-logs.js --date 2023-05-07

# 查看特定请求ID的日志
node scripts/view-llm-logs.js --id 12345678-1234-1234-1234-123456789012

# 清理所有日志
node scripts/view-llm-logs.js --clean

# 显示帮助信息
node scripts/view-llm-logs.js --help
```

## 日志配置

LLM 日志系统提供了以下配置选项：

1. **启用/禁用日志记录**：
   ```typescript
   import LLMLogger from './utils/LLMLogger';
   
   // 启用或禁用日志记录
   LLMLogger.setEnabled(true);
   ```

2. **启用/禁用控制台日志**：
   ```typescript
   // 启用或禁用控制台日志
   LLMLogger.setConsoleEnabled(true);
   ```

3. **启用/禁用文件日志**：
   ```typescript
   // 启用或禁用文件日志
   LLMLogger.setFileEnabled(true);
   ```

4. **启用/禁用详细模式**：
   ```typescript
   // 启用或禁用详细模式
   LLMLogger.setDetailedMode(true);
   ```

5. **自定义日志目录**：
   通过环境变量 `LLM_LOG_DIR` 设置自定义日志目录：
   ```
   LLM_LOG_DIR=/path/to/logs npm start
   ```

## 前端日志

前端也实现了 LLM 调用日志记录功能，日志会显示在浏览器控制台中，并保存在浏览器的 localStorage 中。

可以通过浏览器控制台查看前端日志：

```javascript
// 获取所有日志
const logs = LLMLogger.getAllLogs();
console.log(logs);

// 清除所有日志
LLMLogger.clearLogs();
```

## 诊断 "AI response is not in valid JSON format" 错误

当遇到 "AI response is not in valid JSON format" 错误时，可以通过查看日志来诊断问题：

1. 查看错误发生时的请求 ID（通常会在控制台日志中显示）
2. 使用脚本查看该请求 ID 的详细日志：
   ```bash
   node scripts/view-llm-logs.js --id <requestId>
   ```
3. 检查原始响应内容（`{requestId}_response.txt`）和处理过程中的错误信息
4. 根据日志信息，确定错误的确切原因，并采取相应的修复措施

## 实现细节

LLM 日志系统由以下组件组成：

1. **后端 LLMLogger**：
   - 位于 `backend/src/utils/LLMLogger.ts`
   - 提供服务器端的日志记录功能

2. **前端 LLMLogger**：
   - 位于 `frontend/src/utils/LLMLogger.ts`
   - 提供浏览器端的日志记录功能

3. **日志查看脚本**：
   - 位于 `scripts/view-llm-logs.js`
   - 提供命令行工具，用于查看和管理日志

这些组件协同工作，提供了全面的 LLM 调用全周期日志记录功能。
