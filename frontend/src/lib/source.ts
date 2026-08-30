/**
 * 输入识别：粘贴 GitHub 仓库地址时跳转到 repo 学习模式（/repo/[owner]/[repo]）。
 * repo 与概念是两条完全独立的管线（/api/repo + RepoView vs /api/analyze + AnalyzeView）。
 */

/** GitHub URL（可选 scheme / www）：捕获 owner 与 repo，忽略后续路径 /?# 锚点 */
const GITHUB_URL = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|#|\?|$)/i;

/**
 * 从输入中解析 GitHub 仓库标识（仅完整 URL，避免把 "TCP/IP"、"/" 开头的概念误判）。
 * 返回 null 表示不是 GitHub 仓库输入。
 */
export function parseGithubRef(input: string): { owner: string; repo: string } | null {
  const m = input.trim().match(GITHUB_URL);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}
