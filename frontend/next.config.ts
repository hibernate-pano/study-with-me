import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import type { NextConfig } from "next";

const pkg = JSON.parse(
  readFileSync(process.cwd() + "/package.json", "utf-8")
) as { version: string };

/** 构建时注入当前 commit（前 7 位）。Vercel 有专用环境变量，本地/其他部署用 git。 */
function commitSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
  },
};

export default nextConfig;