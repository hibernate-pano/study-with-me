"use client";

import ReactMarkdown from "react-markdown";
import { styleForTitle, type Section } from "@/lib/stream";
import { sectionMeta } from "./sectionMeta";
import KnowledgeNetworkCard from "./KnowledgeNetworkCard";
import { markdownCodeComponents } from "./codeRenderer";
import type { FlatConcept } from "@/lib/network";
import { IconChevronDown } from "./icons";

/**
 * 单个报告区块卡片。
 *
 * 类型差异化：
 * - 一句话定义/辨析：无 card chrome 的大引语（hero），靠排版撑场；
 * - 知识网络：KnowledgeNetworkCard；
 * - 其它：标准卡片（左侧语义强调条 + SVG 语义图标）。
 *
 * 标题里的 emoji 只用于解析协议，显示前一律剥掉并换成 SVG 图标（sectionMeta）。
 */

interface Props {
  section: Section;
  streaming: boolean;
  /** 是否正在生成这一段（仅最后一段为真）——决定是否显示"生成中…"与流式光标 */
  active?: boolean;
  collapsed: boolean;
  onToggle?: () => void;
  onConceptDrillDown?: (concept: FlatConcept) => void;
}

export default function SectionCard({
  section,
  streaming,
  active = false,
  collapsed,
  onToggle,
  onConceptDrillDown,
}: Props) {
  const style = styleForTitle(section.title);
  const isIntro = section.id === "sec-intro";
  const isNetwork = section.title.includes("知识网络");
  const isQuote = section.title.includes("一句话定义") || section.title.includes("一句话辨析");
  const isPitfall = section.title.includes("误区") || section.title.includes("易错");
  const meta = sectionMeta(section.title, 15);

  // 只有"正在生成这一段"才显示流式光标 / 生成中标签：已完成的历史模块不该一直闪。
  const generating = streaming && active;

  const wrapperClass = isQuote
    ? "scroll-mt-24 fade-up"
    : "card scroll-mt-24 fade-up overflow-hidden transition-colors hover:border-[var(--line-strong)]";

  return (
    <section id={section.id} className={wrapperClass}>
      {isQuote ? (
        !collapsed && (
          <div className="px-5 pb-5 pt-1">
            {section.content ? (
              <QuoteMarkdown content={section.content} streaming={streaming} />
            ) : streaming ? (
              <div className="mt-3 space-y-2.5">
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
            className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors cursor-pointer ${
              isPitfall ? "hover:bg-[var(--st-err-bg)]/50" : "hover:bg-[var(--bg-soft)]/60"
            }`}
          >
            <span
              className="h-7 w-1 shrink-0 rounded-full"
              style={{ background: style.accent }}
            />
            <span className="shrink-0 text-ink-400">{meta.icon}</span>
            <h2 className="flex-1 text-[15.5px] font-bold tracking-[-0.005em] text-ink-800">
              {meta.label}
            </h2>
            {generating && section.content && (
              <span className="shrink-0 text-[11px] text-ink-faint animate-pulse">生成中…</span>
            )}
            {onToggle && (
              <IconChevronDown
                size={16}
                className={`shrink-0 text-ink-faint transition-transform ${
                  collapsed ? "" : "rotate-180"
                }`}
              />
            )}
          </button>

          {!collapsed && (
            <div
              className={`px-5 pb-5 pt-0.5 md ${generating ? "caret" : ""}`}
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
                    ...markdownCodeComponents,
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

/**
 * 一句话定义 / 辨析：大引语。
 * 注意必须保留 `.md` —— 否则行内 `**加粗**` 会失去对比（引语本身的 font-weight
 * 已经是 600，裸 strong 无法再突出）。这里让 .md strong 升到 800 + 墨黑。
 */
function QuoteMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="relative pl-8 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-0 select-none font-disp text-[52px] leading-none text-ink-200"
      >
        &ldquo;
      </span>
      <div className={`md !text-[24px] leading-[1.55] ${streaming ? "caret" : ""}`}>
        <ReactMarkdown
          components={{
            a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            p: ({ children }) => (
              <p className="!my-0 font-disp font-semibold tracking-[-0.01em] text-ink-950">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-extrabold !text-ink-950">{children}</strong>
            ),
            code: ({ children }) => (
              <code className="rounded border border-[var(--line)] bg-[var(--card-sunken)] px-1.5 py-0.5 font-mono text-[0.7em] text-ink-700">
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
