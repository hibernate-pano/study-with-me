import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // 在生产构建期间忽略 ESLint 错误
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 在生产构建期间忽略 TypeScript 错误
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
