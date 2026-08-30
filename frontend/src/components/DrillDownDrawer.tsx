"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { parseSections, extractSectionRaw, styleForTitle, type Section } from "@/lib/stream";
import { parseNetworkMarkdown, flattenGroups, type FlatConcept } from "@/lib/network";
import { saveReport, drillKey } from "@/lib/storage";

/**
 * 右侧抽屉：承载某个被点击概念的流式深挖报告。
 * - 不离开当前主报告（在右侧滑入）
 * - 顶部显示当前在主概念什么上下文下被问到的
 * - 同样的 8 模块渲染
 *
 * 复用同 /api/analyze 接口，body 多传一个 parentTerm 作为上下文。
 */

interface DrawerProps {
  concept: FlatConcept | null;
  parentTerm: string;
  onClose: () => void;
}

export default function DrillDownDrawer({ concept, parentTerm, onClose }: DrawerProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  // dialog 无障碍：Esc 关闭、锁 body 滚动、焦点移入/关闭归还。
  // 两个 window keydown 监听互斥：命令面板打开时它浮在最上层，Esc 归面板，
  // 抽屉不响应，避免一次 Esc 把抽屉和面板同时关掉。
  useEffect(() => {
    if (!concept) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
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
      prevFocus?.focus?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.name, concept?.relationType]);

  useEffect(() => {
    if (!concept) {
      setText("");
      setStreaming(false);
      setError("");
      return;
    }

    // 关闭上一次的请求
    abortCtrl?.abort();

    setText("");
    setStreaming(true);
    setError("");

    const controller = new AbortController();
    setAbortCtrl(controller);

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
        const final = buf;
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

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.name, concept?.relationType]);

  if (!concept) return null;

  const sections = parseSections(text);
  const visibleSections = sections.filter((s) => s.id !== "sec-intro");

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30"
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
        className="fixed top-0 right-0 h-screen w-full sm:w-[560px] bg-white shadow-2xl z-40 flex flex-col outline-none animate-[slideInRight_0.25s_ease-out]"
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
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="关闭抽屉"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4">
          {/* 错误 */}
          {error && !streaming && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-[13.5px] font-medium text-red-700">⚠️ 深挖失败</div>
              <div className="text-[12.5px] text-red-600/90 mt-0.5">{error}</div>
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
          {visibleSections.map((s) => (
            <DrawerSection key={s.id} section={s} streaming={streaming} />
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
function DrawerSection({ section, streaming }: { section: Section; streaming: boolean }) {
  const s = styleForTitle(section.title);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span className="h-6 w-1 rounded-full shrink-0" style={{ background: s.accent }} />
        <h3 className="text-[14px] font-bold text-slate-800 flex-1">{section.title}</h3>
        {streaming && section.content && (
          <span className="text-[10.5px] text-slate-500 animate-pulse">生成中…</span>
        )}
      </div>
      <div className={`px-4 pb-4 pt-1 md ${streaming ? "caret" : ""}`}>
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