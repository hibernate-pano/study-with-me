"use client";

import ReactMarkdown from "react-markdown";
import { styleForTitle, type Section } from "@/lib/stream";
import KnowledgeNetworkCard from "./KnowledgeNetworkCard";
import type { FlatConcept } from "@/lib/network";

/**
 * 单个报告区块卡片（v1.6 设计语言应用版）
 * - 标题：emoji + 中文标签，色块 accent
 * - "一句话定义"卡片：serif 大引语 + 暖色背景（语言学意味的引语）
 * - 其它卡片：默认 typography，hover 时轻微抬起
 * - "🌐 知识网络"卡片：渲染为分组的概念 chips
 */

interface Props {
  section: Section;
  streaming: boolean;
  collapsed: boolean;
  onToggle?: () => void;
  onConceptDrillDown?: (concept: FlatConcept) => void;
}

export default function SectionCard({
  section,
  streaming,
  collapsed,
  onToggle,
  onConceptDrillDown,
}: Props) {
  const style = styleForTitle(section.title);
  const isIntro = section.id === "sec-intro";
  const isNetwork = section.title.includes("知识网络");
  // "一句话定义" / "一句话辨析" 走 serif 引语样式（首发段落的仪式感）
  const isQuote = section.title.includes("一句话定义") || section.title.includes("一句话辨析");

  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--card)] overflow-hidden shadow-[0_4px_20px_-8px_rgba(30,40,90,0.08)] transition-shadow hover:shadow-[0_8px_28px_-10px_rgba(30,40,90,0.12)]"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: style.accent }} />
        <h2 className="flex-1 text-[16px] font-bold text-slate-800">{section.title}</h2>
        {streaming && section.content && (
          <span className="shrink-0 text-[11px] text-slate-400 animate-pulse">生成中…</span>
        )}
        {onToggle && (
          <svg
            className={`shrink-0 text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {!collapsed && (
        <div
          className={`px-5 pb-5 pt-1 md ${isIntro || isQuote ? "" : "caret"}`}
          style={streaming ? { minHeight: 40 } : undefined}
        >
          {isNetwork ? (
            <KnowledgeNetworkCard
              markdown={section.content}
              streaming={streaming}
              onConceptClick={onConceptDrillDown}
            />
          ) : section.content ? (
            isQuote ? (
              <QuoteMarkdown content={section.content} />
            ) : (
              <ReactMarkdown
                components={{
                  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {section.content}
              </ReactMarkdown>
            )
          ) : streaming ? (
            <div className="space-y-2.5">
              <div className="shimmer h-4 w-full" />
              <div className="shimmer h-4 w-11/12" />
              <div className="shimmer h-4 w-4/6" />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** 一句话定义/辨析：用 serif 大字号 + 引号视觉装饰（仪式感） */
function QuoteMarkdown({ content }: { content: string }) {
  return (
    <div className="relative pl-5">
      <span
        aria-hidden
        className="absolute left-0 top-[-2px] font-serif-zh text-[40px] leading-none text-indigo-300/70 select-none"
      >
        "
      </span>
      <div className="lead-quote">
        <ReactMarkdown
          components={{
            a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            p: ({ children }) => <p className="!my-0">{children}</p>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}