"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { parseSections, extractSectionRaw, styleForTitle, stripStreamMarkers, type Section } from "@/lib/stream";
import { sectionMeta } from "@/components/sectionMeta";
import { parseNetworkMarkdown, flattenGroups, type FlatConcept } from "@/lib/network";
import { useFocusTrap } from "@/components/useFocusTrap";
import { saveReport, getReport, drillKey, syncCardsFromReport } from "@/lib/storage";
import {
  IconClose,
  IconRefresh,
  IconWarn,
} from "@/components/icons";

/**
 * 右侧抽屉：承载某个被点击概念的流式深挖报告。
 * - 不离开当前主报告（在右侧滑入）
 * - 顶部显示当前在主概念什么上下文下被问到的
 * - 同样的 8 模块渲染
 *
 * 复用同 /api/analyze 接口，body 多传一个 parentTerm 作为上下文。
 * 缓存约定与主报告一致（wiki 化）：打开先读 IndexedDB（drill:parent::term），
 * 命中即渲染不烧 token，头部提供「重新生成」显式覆盖；未命中才流式生成。
 */

interface DrawerProps {
  concept: FlatConcept | null;
  parentTerm: string;
  onClose: () => void;
  /** 深挖报告首次成卡后回调（父组件刷新复习徽标） */
  onCardsSynced?: () => void;
}

export default function DrillDownDrawer({ concept, parentTerm, onClose, onCardsSynced }: DrawerProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  // 非 null = 当前展示的是本地缓存报告（updatedAt），头部据此显示缓存态与重新生成
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  // 重新生成按钮要能再次触发流式生成；生成逻辑随 effect 闭包建立，经 ref 暴露
  const streamRef = useRef<(() => void) | null>(null);

  // 模态无障碍：焦点移入/归还、Tab 循环、背景 inert 隔离（统一走 useFocusTrap）。
  // 焦点落点保持「抽屉自身」——沿用上一轮的行为，抽屉内容是流式长文，
  // 直接把焦点丢到关闭按钮上会和它逐段生长的内容打架。
  useFocusTrap(drawerRef, !!concept, { initialFocus: "container" });

  // Esc 关闭 + 锁 body 滚动。
  // 两个 window keydown 监听互斥：命令面板打开时它浮在最上层，Esc 归面板，
  // 抽屉不响应，避免一次 Esc 把抽屉和面板同时关掉。
  useEffect(() => {
    if (!concept) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".kbar-backdrop")) return; // 命令面板开着，让面板先吃掉这次 Esc
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.name, concept?.relationType]);

  useEffect(() => {
    if (!concept) {
      setText("");
      setStreaming(false);
      setError("");
      setCachedAt(null);
      streamRef.current = null;
      return;
    }

    // 关闭上一次的请求
    abortCtrl?.abort();

    const controller = new AbortController();
    setAbortCtrl(controller);
    let alive = true;

    const stream = () => {
      setText("");
      setStreaming(true);
      setError("");
      setCachedAt(null);

      (async () => {
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              term: concept.name,
              parentTerm,
              relationType: concept.relationType,
              relationLabel: concept.groupLabel,
            }),
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            let msg = `请求失败（${res.status}）`;
            try {
              const data = (await res.json()) as { error?: string };
              if (data?.error) msg = data.error;
            } catch { /* ignore */ }
            throw new Error(msg);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          // 抽屉里我们不要节流（流速本来慢），每一帧直接渲染
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            setText(buf);
          }

          setStreaming(false);

          // 深挖报告也入库：让每次追问都沉淀为知识库的一页
          // 入库前剥掉 <!-- DONE --> 等流式标记，否则会随全文进 IndexedDB / 云端
          const final = stripStreamMarkers(buf);
          if (final) {
            const groups = parseNetworkMarkdown(extractSectionRaw(final, "知识网络"));
            saveReport({
              key: drillKey(parentTerm, concept.name),
              term: concept.name,
              parentTerm,
              relationType: concept.relationType,
              fullText: final,
              related: flattenGroups(groups),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }).catch(() => {
              /* 隐私模式等场景写失败就静默 */
            });
            // 深挖报告的定义卡与追问卡也进复习闭环（幂等，同 key 跳过）
            syncCardsFromReport(concept.name, final, drillKey(parentTerm, concept.name))
              .then((n) => {
                if (n > 0) onCardsSynced?.();
              })
              .catch(() => {});
          }
        } catch (err: unknown) {
          if (
            typeof err === "object" &&
            err !== null &&
            "name" in err &&
            (err as { name?: string }).name === "AbortError"
          ) {
            // 抽屉关闭触发的 abort，不算错误
            return;
          }
          setError(err instanceof Error ? err.message : "生成失败");
          setStreaming(false);
        }
      })();
    };
    streamRef.current = stream;

    // 缓存优先：同一概念在同一上下文下问过，就直接回放，不重复烧 token
    getReport(drillKey(parentTerm, concept.name))
      .then((r) => {
        if (!alive) return;
        if (r && r.fullText) {
          setText(r.fullText);
          setStreaming(false);
          setCachedAt(r.updatedAt);
          // 缓存回放也补成卡（幂等：老报告升级后首次打开时把定义卡/追问卡补齐）
          syncCardsFromReport(concept.name, r.fullText, drillKey(parentTerm, concept.name))
            .then((n) => {
              if (n > 0) onCardsSynced?.();
            })
            .catch(() => {});
        } else {
          stream();
        }
      })
      .catch(() => {
        if (alive) stream();
      });

    return () => {
      alive = false;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.name, concept?.relationType]);

  if (!concept) return null;

  const sections = parseSections(text);
  const visibleSections = sections.filter((s) => s.id !== "sec-intro");

  return (
    <>
      {/* 遮罩。aria-hidden 同时让 useFocusTrap 的背景隔离跳过它——
          这层要保持可点，否则「点击空白处关闭」会被 inert 吃掉。 */}
      <div
        className="fixed inset-0 z-30 bg-ink-950/25 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 抽屉 */}
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`深挖：${concept.name}`}
        className="fixed top-0 right-0 z-40 flex h-screen w-full flex-col bg-white shadow-[var(--shadow-pop)] outline-none sm:w-[560px] animate-[slideInRight_0.25s_ease-out]"
      >
        <header className="shrink-0 border-b border-[var(--line)] px-5 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: concept.color }}
              />
              <span className="text-[11.5px] font-bold tracking-wide uppercase" style={{ color: concept.color }}>
                {concept.groupLabel}
              </span>
              <span className="text-[11px] text-slate-500">
                · 你正在追问 <span className="font-bold text-slate-600">{parentTerm}</span> 时遇到的
              </span>
            </div>
            <h2 className="text-[20px] font-extrabold text-slate-900 break-all">
              {concept.name}
            </h2>
            {concept.description && (
              <p className="mt-1 text-[12.5px] text-slate-500 leading-relaxed line-clamp-3">
                {concept.description}
              </p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2 self-start">
            {cachedAt !== null && !streaming && (
              <>
                <span className="state-chip state-info" title="上次生成于本地缓存，未消耗模型调用">
                  本地缓存
                </span>
                <button
                  onClick={() => streamRef.current?.()}
                  className="flex items-center gap-1 rounded-md border border-[var(--line-strong)] px-2 py-1 text-[11.5px] text-ink-soft transition-colors hover:border-ink-400 hover:bg-ink-50 hover:text-ink-700 cursor-pointer"
                  title="忽略缓存，重新生成这份深挖报告"
                >
                  <IconRefresh size={12} />
                  重新生成
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="btn-icon shrink-0 !h-8 !w-8"
              aria-label="关闭抽屉"
            >
              <IconClose size={17} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4">
          {/* 错误 */}
          {error && !streaming && (
            <div className="rounded-2xl border border-[var(--st-err-line)] bg-[var(--st-err-bg)] px-4 py-3" role="alert">
              <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--st-err)]">
                <IconWarn size={14} />
                深挖失败
              </div>
              <div className="mt-0.5 text-[12.5px] text-[var(--st-err)]/90">{error}</div>
            </div>
          )}

          {/* 等待 */}
          {visibleSections.length === 0 && streaming && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="shimmer h-4 w-1/3 mb-3" />
                  <div className="shimmer h-3 w-full" />
                  <div className="shimmer h-3 w-11/12 mt-2" />
                </div>
              ))}
            </div>
          )}

          {/* 报告 */}
          {visibleSections.map((s, i) => (
            <DrawerSection
              key={s.id}
              section={s}
              streaming={streaming}
              active={i === visibleSections.length - 1}
            />
          ))}

          {streaming && visibleSections.length > 0 && (
            <div className="text-[11.5px] text-slate-500 text-center py-2 animate-pulse">
              仍在生成…
            </div>
          )}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

/** 抽屉内 section —— 用同 styleForTitle 但版面紧凑 */
function DrawerSection({
  section,
  streaming,
  active,
}: {
  section: Section;
  streaming: boolean;
  active: boolean;
}) {
  const s = styleForTitle(section.title);
  const meta = sectionMeta(section.title, 14);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: s.accent }} />
        <span className="shrink-0 text-ink-400">{meta.icon}</span>
        <h3 className="flex-1 text-[14px] font-bold text-ink-800">{meta.label}</h3>
        {streaming && section.content && (
          <span className="text-[10.5px] text-ink-faint animate-pulse">生成中…</span>
        )}
      </div>
      {/* 只有正在生成的那一段（最后一段）显示流式光标 */}
      <div className={`px-4 pb-4 pt-1 md ${streaming && active ? "caret" : ""}`}>
        {section.content ? (
          <ReactMarkdown
            components={{
              a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >
            {section.content}
          </ReactMarkdown>
        ) : streaming ? (
          <div className="space-y-2">
            <div className="shimmer h-3 w-full" />
            <div className="shimmer h-3 w-11/12" />
            <div className="shimmer h-3 w-4/6" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
