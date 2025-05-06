import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Study With Me - AI辅助学习平台",
  description: "使用AI技术帮助学习，对学习内容进行拆解和制定标准的学习计划",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={roboto.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
