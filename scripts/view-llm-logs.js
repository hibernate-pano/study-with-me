#!/usr/bin/env node

/**
 * 查看和管理LLM日志的简单脚本
 * 
 * 使用方法:
 * - 查看最新日志: node scripts/view-llm-logs.js
 * - 查看特定日期的日志: node scripts/view-llm-logs.js --date 2023-05-07
 * - 查看特定请求ID的日志: node scripts/view-llm-logs.js --id 12345678-1234-1234-1234-123456789012
 * - 清理所有日志: node scripts/view-llm-logs.js --clean
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 日志目录
const LOG_DIR = path.join(process.cwd(), 'logs', 'llm');

// 命令行参数
const args = process.argv.slice(2);
const options = {
  date: null,
  id: null,
  clean: false,
  help: false
};

// 解析命令行参数
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && i + 1 < args.length) {
    options.date = args[i + 1];
    i++;
  } else if (args[i] === '--id' && i + 1 < args.length) {
    options.id = args[i + 1];
    i++;
  } else if (args[i] === '--clean') {
    options.clean = true;
  } else if (args[i] === '--help') {
    options.help = true;
  }
}

// 显示帮助信息
if (options.help) {
  console.log(`
查看和管理LLM日志的简单脚本

使用方法:
  - 查看最新日志: node scripts/view-llm-logs.js
  - 查看特定日期的日志: node scripts/view-llm-logs.js --date 2023-05-07
  - 查看特定请求ID的日志: node scripts/view-llm-logs.js --id 12345678-1234-1234-1234-123456789012
  - 清理所有日志: node scripts/view-llm-logs.js --clean
  `);
  process.exit(0);
}

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  console.log(`日志目录不存在: ${LOG_DIR}`);
  console.log('创建日志目录...');
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 清理所有日志
if (options.clean) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('确定要清理所有LLM日志吗? (y/n) ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      const files = fs.readdirSync(LOG_DIR);
      let count = 0;
      
      for (const file of files) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        count++;
      }
      
      console.log(`已清理 ${count} 个日志文件`);
    } else {
      console.log('操作已取消');
    }
    
    rl.close();
  });
  
  return;
}

// 获取日志文件列表
const files = fs.readdirSync(LOG_DIR);

// 按特定请求ID查看日志
if (options.id) {
  const requestFiles = files.filter(file => file.includes(options.id));
  
  if (requestFiles.length === 0) {
    console.log(`未找到请求ID为 ${options.id} 的日志`);
    return;
  }
  
  console.log(`找到 ${requestFiles.length} 个与请求ID ${options.id} 相关的日志文件:`);
  
  for (const file of requestFiles) {
    console.log(`\n=== ${file} ===`);
    const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
    console.log(content);
  }
  
  return;
}

// 按日期查看日志
if (options.date) {
  const dateStr = options.date;
  const logFile = path.join(LOG_DIR, `llm_${dateStr}.log`);
  
  if (!fs.existsSync(logFile)) {
    console.log(`未找到日期为 ${dateStr} 的日志`);
    return;
  }
  
  console.log(`显示 ${dateStr} 的日志:`);
  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      console.log(`[${entry.timestamp}] [${entry.type}] ${entry.requestId ? `[${entry.requestId.substring(0, 8)}] ` : ''}${JSON.stringify(entry, null, 2)}`);
    } catch (e) {
      console.log(line);
    }
  }
  
  return;
}

// 显示所有日志文件
console.log(`日志目录: ${LOG_DIR}`);
console.log(`找到 ${files.length} 个日志文件:`);

// 按修改时间排序
const sortedFiles = files.map(file => ({
  name: file,
  time: fs.statSync(path.join(LOG_DIR, file)).mtime.getTime()
}))
.sort((a, b) => b.time - a.time)
.map(file => file.name);

// 显示文件列表
for (const file of sortedFiles) {
  const stats = fs.statSync(path.join(LOG_DIR, file));
  const size = (stats.size / 1024).toFixed(2);
  const time = stats.mtime.toLocaleString();
  
  console.log(`${file.padEnd(40)} ${size} KB ${time}`);
}

// 如果有日志文件，显示最新的日志文件内容
if (sortedFiles.length > 0) {
  const latestLogFile = sortedFiles[0];
  
  if (latestLogFile.endsWith('.log')) {
    console.log(`\n显示最新日志文件 ${latestLogFile} 的内容:`);
    const content = fs.readFileSync(path.join(LOG_DIR, latestLogFile), 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        console.log(`[${entry.timestamp}] [${entry.type}] ${entry.requestId ? `[${entry.requestId.substring(0, 8)}] ` : ''}${JSON.stringify(entry, null, 2)}`);
      } catch (e) {
        console.log(line);
      }
    }
  } else {
    console.log(`\n要查看特定日志文件的内容，请使用 --id 或 --date 选项`);
  }
}
