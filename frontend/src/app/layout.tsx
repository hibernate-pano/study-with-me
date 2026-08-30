import type { Metadata } from "next";
import "./globals.css";
import VersionBadge from "@/components/VersionBadge";
import AuthBar from "@/components/AuthBar";
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
        {/* 中文衬线字体（hero 大引语、概念标题用） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Color+Emoji&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <AuthBar />
        <VersionBadge />
        <CommandPalette />
      </body>
    </html>
  );
}
