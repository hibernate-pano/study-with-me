import type { Metadata } from "next";
import "./globals.css";
import VersionBadge from "@/components/VersionBadge";
import AppShell from "@/components/AppShell";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "概念深挖器 · 输入一个词，快速抓住重点",
  description:
    "输入任意概念（分布式锁、十五规划、费曼学习法…），AI 帮你厘清概念、拆解分析、找出重点与误区、规划进阶路径。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning：浏览器翻译/暗色扩展常在 hydration 前往 <html> 注入属性，避免误报
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Inter（拉丁字符，工具风 UI 主字体）；中文走系统 PingFang/雅黑 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Color+Emoji&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <VersionBadge />
        <CommandPalette />
      </body>
    </html>
  );
}
