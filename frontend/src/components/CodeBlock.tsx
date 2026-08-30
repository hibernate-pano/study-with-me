"use client";

import dynamic from "next/dynamic";

const Mermaid = dynamic(() => import("./Mermaid"), {
  ssr: false,
  loading: () => <div className="shimmer h-32 my-3" />,
});

/**
 * ReactMarkdown 的 code 渲染器：mermaid 代码块 → 懒加载画图；其它 → 普通 <pre>。
 * 让「架构模块」里模型输出的 mermaid 能真实渲染成架构图。
 */
export default function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const lang = /language-(\S+)/.exec(className || "")?.[1];
  const text = String(children ?? "").replace(/\n$/, "");

  if (lang === "mermaid") {
    return <Mermaid code={text} />;
  }

  return (
    <pre className="rounded-md bg-slate-50 border border-slate-200 p-3 text-[12.5px] leading-relaxed overflow-x-auto">
      <code className={className}>{children}</code>
    </pre>
  );
}
