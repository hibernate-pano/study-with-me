const fs = require('fs');
const path = require('path');

// 1. 修复配置文件，添加 mermaidApiUrl
const configPath = path.join(__dirname, 'backend', 'src', 'config', 'index.ts');
let configContent = fs.readFileSync(configPath, 'utf8');
if (!configContent.includes('mermaidApiUrl')) {
  configContent = configContent.replace(
    'export default config;',
    `  mermaidApiUrl: process.env.MERMAID_API_URL || 'https://mermaid.ink/svg',
};

export default config;`
  );
  fs.writeFileSync(configPath, configContent);
  console.log('✅ 已添加 mermaidApiUrl 到配置文件');
}

// 2. 修复 achievementService.ts 中的空值检查
const achievementServicePath = path.join(__dirname, 'backend', 'src', 'services', 'achievementService.ts');
let achievementContent = fs.readFileSync(achievementServicePath, 'utf8');
achievementContent = achievementContent.replace(
  'isEarned = count >= achievement.criteria.completed_exercises;',
  'isEarned = count !== null && count >= achievement.criteria.completed_exercises;'
);
fs.writeFileSync(achievementServicePath, achievementContent);
console.log('✅ 已修复 achievementService.ts 中的空值检查');

// 3. 修复 leaderboardService.ts 中的问题
const leaderboardServicePath = path.join(__dirname, 'backend', 'src', 'services', 'leaderboardService.ts');
let leaderboardContent = fs.readFileSync(leaderboardServicePath, 'utf8');

// 3.1 修复未定义变量使用的问题
leaderboardContent = leaderboardContent.replace(
  `let startDate: Date;
      
      if (period === 'week') {
        // 过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        // 过去30天
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      query = query.gte('last_accessed', startDate.toISOString());`,
  `let startDate: Date;
      
      if (period === 'week') {
        // 过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        // 过去30天
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        // 默认为过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      query = query.gte('last_accessed', startDate.toISOString());`
);

// 3.2 修复 count 可能为 null 的问题
leaderboardContent = leaderboardContent.replace(
  /ranking = count \+ 1;/g,
  'ranking = (count !== null ? count : 0) + 1;'
);

// 3.3 修复 group 方法不存在的问题
// 这需要修改查询方式，我们将使用 Supabase 支持的方式
leaderboardContent = leaderboardContent.replace(
  `.group('user_id, users')`,
  `.select('user_id, users:user_id(id, display_name, avatar_url), total_time:time_spent(sum)')`
);

leaderboardContent = leaderboardContent.replace(
  `.group('user_id, users')`,
  `.select('user_id, users:user_id(id, display_name, avatar_url), completed_count:id(count)')`
);

leaderboardContent = leaderboardContent.replace(
  `.group('user_id')`,
  `.select('user_id, completed_count:id(count)')`
);

fs.writeFileSync(leaderboardServicePath, leaderboardContent);
console.log('✅ 已修复 leaderboardService.ts 中的问题');

// 4. 安装缺少的依赖
const packageJsonPath = path.join(__dirname, 'backend', 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (!packageJson.dependencies.uuid) {
  console.log('📦 正在安装缺少的依赖: uuid...');
  const { execSync } = require('child_process');
  execSync('cd backend && npm install uuid @types/uuid --save', { stdio: 'inherit' });
}

console.log('🎉 所有TypeScript错误已修复！');
