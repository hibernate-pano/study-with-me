"use client";

import ReactMarkdown from "react-markdown";
import { styleForTitle, type Section } from "@/lib/stream";
import KnowledgeNetworkCard from "./KnowledgeNetworkCard";
import type { FlatConcept } from "@/lib/network";

/**
 * 单个报告区块卡片（v1.7 类型差异化版）
 *
 * 不同 section 类型走不同视觉：
 * - 一句话定义/辨析：serif 引语 + 引号装饰（hero）
 * - 常见误区：红色边 + 浅红底（警示感）
 * - 知识网络：KnowledgeNetworkCard（分组 chips）
 * - 其它：标准卡片（保留 accent stripe）
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
  const isQuote = section.title.includes("一句话定义") || section.title.includes("一句话辨析");
  const isPitfall = section.title.includes("误区") || section.title.includes("易错");

  // —— 类型差异化壳层 ——
  const wrapperClass = (() => {
    if (isPitfall) {
      return "card scroll-mt-24 overflow-hidden shadow-[0_4px_20px_-8px_rgba(185,28,0,0.10)] border-red-100";
    }
    if (isQuote) {
      // 引语段：不要 chrome，纯靠排版撑场
      return "scroll-mt-24";
    }
    return "card scroll-mt-24 overflow-hidden hover:shadow-[0_8px_28px_-10px_rgba(15,23,42,0.12)] transition-shadow";
  })();

  return (
    <section id={section.id} className={wrapperClass}>
      {isQuote ? (
        // 引语：标题 + 内容并列，无 card chrome
        !collapsed && (
          <div className="px-5 pb-5 pt-1 md">
            {section.content ? (
              <QuoteMarkdown content={section.content} streaming={streaming} />
            ) : streaming ? (
              <div className="space-y-2.5 mt-3">
                <div className="shimmer h-7 w-3/4" />
                <div className="shimmer h-7 w-2/3" />
              </div>
            ) : null}
          </div>
        )
      ) : (
        <>
          <button
            onClick={onToggle}
            className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors cursor-pointer ${
              isPitfall ? "hover:bg-red-50/40" : "hover:bg-[var(--bg-soft)]/60"
            }`}
          >
            <span
              className="h-8 w-1.5 rounded-full shrink-0"
              style={{ background: style.accent }}
            />
            <h2 className="flex-1 text-[16px] font-bold text-slate-800">
              {section.title}
            </h2>
            {streaming && section.content && (
              <span className="shrink-0 text-[11px] text-slate-400 animate-pulse">
                生成中…
              </span>
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
              style={streaming ? { minHeight: 40 } : undefined}
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
        </>
      )}
    </section>
  );
}

/** 一句话定义/辨析：serif 大字号 + 引号视觉装饰 */
function QuoteMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="relative pl-7 py-3">
      {/* 大引号装饰 */}
      <span
        aria-hidden
        className="absolute left-0 top-[-6px] font-serif-zh text-[56px] leading-none text-indigo-300/70 select-none"
      >
        &ldquo;
      </span>
      <div className={`lead-quote ${streaming ? "caret" : ""}`}>
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