import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "出题大师 · 概念深挖器",
  description: "从 PDF、课程或知识点生成结构化题库，组装多套试卷并闭环复习。",
};

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
