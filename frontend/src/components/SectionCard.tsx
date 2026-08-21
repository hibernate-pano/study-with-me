"use client";

import ReactMarkdown from "react-markdown";
import { styleForTitle, type Section } from "@/lib/stream";
import KnowledgeNetworkCard from "./KnowledgeNetworkCard";
import type { FlatConcept } from "@/lib/network";

/**
 * 单个报告区块卡片。
 * 当标题是"🌐 知识网络"时，渲染 KnowledgeNetworkCard（按关联类型分组的卡片）。
 * 点击卡片里的概念 chip → 触发 onConceptDrillDown（在右侧抽屉里深挖，不离开当前报告）。
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

  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--card)] overflow-hidden shadow-[0_4px_20px_-8px_rgba(30,40,90,0.08)]"
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
          className={`px-5 pb-5 pt-1 md ${isIntro ? "" : "caret"}`}
          style={streaming ? { minHeight: 40 } : undefined }
        >
          {isNetwork ? (
            <KnowledgeNetworkCard
              markdown={section.content}
              streaming={streaming}
              onConceptClick={onConceptDrillDown}
            />
          ) : section.content ? (
            <ReactMarkdown
              components={{
                a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
              }}
            >
              {section.content}
            </ReactMarkdown>
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