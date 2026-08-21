"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import SectionCard from "@/components/SectionCard";
import DrillDownDrawer from "@/components/DrillDownDrawer";
import { parseSections, type Section } from "@/lib/stream";
import type { FlatConcept } from "@/lib/network";

export default function AnalyzePage() {
  const params = useParams<{ term: string }>();
  const router = useRouter();
  const term = decodeURIComponent(params.term);

  // 全文（markdown）与解析后的区块
  const [fullText, setFullText] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [drillConcept, setDrillConcept] = useState<FlatConcept | null>(null);

  const bufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genIdRef = useRef(0);

  /** 把当前缓冲渲染到页面（限频调用） */
  const flush = useCallback(() => {
    const text = bufferRef.current;
    if (text === fullTextRef.current) return;
    fullTextRef.current = text;
    setFullText(text);
    setSections(parseSections(text));
  }, []);
  const fullTextRef = useRef("");

  /** 发起流式请求 */
  const start = useCallback(
    async () => {
      const myGen = ++genIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      bufferRef.current = "";
      fullTextRef.current = "";

      setFullText("");
      setSections([]);
      setStreaming(true);
      setError("");

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `请求失败（${res.status}）`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) msg = data.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("空响应");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        timerRef.current = setInterval(flush, 120);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bufferRef.current += decoder.decode(value, { stream: true });
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (myGen !== genIdRef.current) return; // 已被新请求取代
        setStreaming(false);
        flush(); // 最终刷新
      } catch (err: unknown) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (myGen !== genIdRef.current) return; // 已被新请求取代
        const aborted =
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError";
        if (aborted) {
          setError("已停止生成");
        } else {
          setError(
            err instanceof Error ? err.message : "生成失败，请重试"
          );
        }
        setStreaming(false);
      }
    },
    [term, flush]
  );

  // 首次进入：记录最近搜索 + 开始生成
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cd-recent");
      const list = raw ? JSON.parse(raw) : [];
      const next = [term, ...list.filter((t: string) => t !== term)].slice(0, 8);
      localStorage.setItem("cd-recent", JSON.stringify(next));
    } catch {
      /* ignore */
    }

    start();
    return () => {
      // 在 cleanup 里递增 genIdRef，是用于让在途请求的回调自检过期。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      genIdRef.current++;
      abortRef.current?.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // term 变化时重置滚动跟随状态：开新报告默认跟随到最新
  useEffect(() => {
    setStickToBottom(true);
  }, [term]);

  /** 新区块出现时，若用户还在底部则自动滚动跟随 */
  useEffect(() => {
    if (sections.length === 0) return;
    const last = sections[sections.length - 1];
    const el = document.getElementById(last.id);
    if (el && streaming && stickToBottom) {
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      if (top > vh * 0.85) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [sections, streaming, stickToBottom]);

  /** 跟踪用户是否在底部（用来决定是否跟随滚动） */
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distanceToBottom =
          document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
        setStickToBottom(distanceToBottom < 120);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const regenerate = () => {
    abortRef.current?.abort();
    start();
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(
        `# ${term}\n\n${fullTextRef.current || fullText}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const headings = sections.filter((s) => s.id !== "sec-intro");

  return (
    <div className="min-h-screen">
      {/* 顶部操作栏 */}
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回首页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>

          <div className="flex-1 max-w-xl">
            <SearchBox initial={term} size="md" />
          </div>

          <button
            onClick={regenerate}
            disabled={streaming}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 cursor-pointer"
            title="重新生成"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {streaming ? "生成中…" : "重新生成"}
          </button>

          {streaming && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              title="停止生成"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              停止
            </button>
          )}

          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="复制全文"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* 正文列 */}
        <div className="min-w-0 flex-1">
          {/* 词条标题 */}
          <div className="mb-5 flex flex-wrap items-baseline gap-3">
            <h1 className="text-[26px] font-extrabold text-slate-900 break-all">
              {term}
            </h1>
            {streaming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                AI 正在深挖…
              </span>
            ) : error ? (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-500">
                生成失败
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-600">
                完成
              </span>
            )}
          </div>

          {/* 错误提示卡片 */}
          {error && !streaming && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="text-[14px] font-medium text-red-700">
                ⚠️ 报告生成失败
              </div>
              <div className="mt-1 text-[13px] text-red-600/90">{error}</div>
              <button
                onClick={regenerate}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
              >
                重试
              </button>
            </div>
          )}

          {/* 等待首个字符时的骨架 */}
          {sections.length === 0 && streaming && !error && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 space-y-3">
              <div className="shimmer h-5 w-1/3" />
              <div className="shimmer h-4 w-full" />
              <div className="shimmer h-4 w-11/12" />
              <div className="shimmer h-4 w-3/4" />
              <div className="shimmer h-4 w-2/3" />
            </div>
          )}

          {/* 区块列表 */}
          <div className="space-y-4">
            {sections.map((s) => (
              <SectionCard
                key={s.id}
                section={s}
                streaming={streaming}
                collapsed={!!collapsed[s.id]}
                onToggle={() => toggle(s.id)}
                onConceptDrillDown={setDrillConcept}
              />
            ))}
          </div>

          {/* 完成后追加操作 */}
          {!streaming && !error && fullText && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="rounded-xl border border-[var(--line)] bg-white px-5 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ↑ 回到顶部
              </button>
              <button
                onClick={regenerate}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-[13.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                ↻ 同词重新生成
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-xl border border-[var(--line)] bg-white px-5 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                换个词
              </button>
            </div>
          )}
        </div>

        {/* 目录侧栏 */}
        {headings.length > 1 && (
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20 rounded-2xl border border-[var(--line)] bg-white/80 p-4">
              <div className="text-[12px] font-bold tracking-wider text-slate-400 mb-3">
                报告目录
              </div>
              <nav className="space-y-1">
                {headings.map((s) => {
                  const active = streaming && s === sections[sections.length - 1];
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`block truncate rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-indigo-50 text-indigo-600 font-medium"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {s.title}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}
      </main>

      {/* 深挖抽屉 */}
      <DrillDownDrawer
        concept={drillConcept}
        parentTerm={term}
        onClose={() => setDrillConcept(null)}
      />
    </div>
  );
}
