import type { Metadata } from "next";
import "./globals.css";
import VersionBadge from "@/components/VersionBadge";

export const metadata: Metadata = {
  title: "概念深挖器 · 输入一个词，快速抓住重点",
  description:
    "输入任意概念（分布式锁、十五规划、费曼学习法…），AI 帮你厘清概念、拆解分析、找出重点与误区、规划进阶路径。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}
