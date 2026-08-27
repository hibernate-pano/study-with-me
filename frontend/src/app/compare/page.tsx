"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SectionCard from "@/components/SectionCard";
import { parseSections, extractSectionRaw, type Section } from "@/lib/stream";
import { parseNetworkMarkdown, flattenGroups } from "@/lib/network";
import { saveReport, getReport } from "@/lib/storage";

function compareKey(a: string, b: string): string {
  return `compare:${a}::${b}`;
}

/** 对比页：需要 Suspense 包裹 useSearchParams（Next.js 15 要求），避免静态预渲染失败 */
export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-slate-400">加载中…</div>}>
      <CompareInner />
    </Suspense>
  );
}

function CompareInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [a, setA] = useState(sp.get("a") || "");
  const [b, setB] = useState(sp.get("b") || "");
  const [fullText, setFullText] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const bufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genIdRef = useRef(0);
  const fullTextRef = useRef("");

  /** 限频把缓冲推到视图 */
  const flush = useCallback(() => {
    const text = bufferRef.current;
    if (text === fullTextRef.current) return;
    fullTextRef.current = text;
    setFullText(text);
    setSections(parseSections(text));
  }, []);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const start = useCallback(
    async (x: string, y: string) => {
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
      setSaved(false);
      setCachedAt(null);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term: x, compareWith: y }),
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
        timerRef.current = setInterval(() => flushRef.current(), 120);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bufferRef.current += decoder.decode(value, { stream: true });
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (myGen !== genIdRef.current) return;

        setStreaming(false);
        flushRef.current();

        // 完成才入库（对比报告也是知识库的一页）
        const text = bufferRef.current;
        const groups = parseNetworkMarkdown(extractSectionRaw(text, "知识网络"));
        await saveReport({
          key: compareKey(x, y),
          term: `${x} ⚖️ ${y}`,
          fullText: text,
          related: flattenGroups(groups),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).catch(() => {});
        setSaved(true);
      } catch (err: unknown) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (myGen !== genIdRef.current) return;
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (aborted) return;
        setStreaming(false);
        setError(err instanceof Error ? err.message : "生成失败");
      }
    },
    []
  );

  const submit = useCallback(
    (x: string, y: string) => {
      const t1 = x.trim();
      const t2 = y.trim();
      if (!t1 || !t2) {
        setError("请把两个概念都填上");
        return;
      }
      if (t1 === t2) {
        setError("对比的两个概念不能相同");
        return;
      }
      void start(t1, t2);
    },
    [start]
  );

  /** 尝试从本地存档读取对比报告；读到则展示（打开即读，不重复烧 token）并返回 true */
  const loadFromCache = useCallback(
    async (x: string, y: string): Promise<boolean> => {
      const key = compareKey(x.trim(), y.trim());
      const r = await getReport(key).catch(() => undefined);
      if (!r || !r.fullText) return false;
      genIdRef.current++; // 作废在途请求（防御：正常流程此时无请求）
      abortRef.current?.abort();
      bufferRef.current = "";
      fullTextRef.current = r.fullText;
      setFullText(r.fullText);
      setSections(parseSections(r.fullText));
      setStreaming(false);
      setError("");
      setSaved(true);
      setCachedAt(r.updatedAt);
      return true;
    },
    []
  );

  // URL 带 ?a/?b 时：缓存优先，无缓存才发起生成
  useEffect(() => {
    const x = (sp.get("a") || "").trim();
    const y = (sp.get("b") || "").trim();
    if (x && y) {
      setA(x);
      setB(y);
      void loadFromCache(x, y).then((hit) => {
        if (!hit) void start(x, y);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => abortRef.current?.abort();

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
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
          <div className="text-[14px] font-bold text-slate-800">⚖️ 概念对比</div>
          <div className="flex-1" />
          {cachedAt && (
            <span className="text-[11.5px] text-slate-400">
              📂 已加载对比存档（更新于{" "}
              {new Date(cachedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              ）
            </span>
          )}
          {fullText && !streaming && (
            <button
              onClick={() => submit(a, b)}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12.5px] font-medium text-violet-600 hover:bg-violet-100 transition-colors cursor-pointer"
            >
              重新生成
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-8">
        {/* 输入区 */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder="概念 A，如：乐观锁"
              className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              disabled={streaming}
              onKeyDown={(e) => e.key === "Enter" && submit(a, b)}
            />
            <div className="self-center text-[13px] font-bold text-slate-400">VS</div>
            <input
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="概念 B，如：悲观锁"
              className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              disabled={streaming}
              onKeyDown={(e) => e.key === "Enter" && submit(a, b)}
            />
            <button
              onClick={() => submit(a, b)}
              disabled={streaming}
              className="rounded-xl bg-violet-500 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {streaming ? "生成中…" : "生成对比"}
            </button>
          </div>
          <p className="mt-3 text-[11.5px] text-slate-400">
            适合对比相似/容易混淆的概念，比如「乐观锁 vs 悲观锁」「TCP vs UDP」「进程 vs 线程」。生成结果会存入你的本地知识库。
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-red-600">{error}</span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={stop}
                  className="rounded-lg px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  停止
                </button>
                <button
                  onClick={() => submit(a, b)}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-600 transition-colors cursor-pointer"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 流式正文 */}
        {fullText && (
          <div className="mt-6">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-[15px] font-bold text-violet-700">
                {a.trim()}
              </span>
              <span className="text-[13px] font-bold text-slate-400">⚖️</span>
              <span className="rounded-lg bg-teal-50 px-3 py-1.5 text-[15px] font-bold text-teal-700">
                {b.trim()}
              </span>
              {saved && !streaming && (
                <span className="text-[11.5px] text-emerald-600">✓ 已存入本地知识库</span>
              )}
              {streaming && (
                <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                  正在辨析…
                </span>
              )}
            </div>

            <div className="space-y-4">
              {sections.map((s) => (
                <SectionCard key={s.id} section={s} collapsed={false} streaming={streaming} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}