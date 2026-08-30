"use client";

/**
 * repo 模块深挖抽屉（Phase 2）：点模块卡「深挖源码」→ 现抓该模块源码流式讲解。
 *
 * 结构照搬 DrillDownDrawer 的模式（遮罩 + 右滑抽屉 + "## " 切卡渲染），
 * 但走独立端点 /api/repo/module，入库 key = repo:<owner/repo>::<moduleId>，
 * 现有过滤（repo: 前缀）保证它不污染概念存档/知识地图。
 * 深挖报告是文章形态，与地图的 JSON 形态各自独立。
 */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { parseSections, styleForTitle, type Section } from "@/lib/stream";
import { getReport, saveReport } from "@/lib/storage";
import type { AtlasModule } from "@/lib/atlas";
import CodeBlock from "./CodeBlock";

interface Props {
  module: AtlasModule | null;
  repoTitle: string;
  onClose: () => void;
}

function moduleKey(repoTitle: string, moduleId: string): string {
  return `repo:${repoTitle}::${moduleId}`;
}

export default function RepoModuleDrawer({ module, repoTitle, onClose }: Props) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [loadingCache, setLoadingCache] = useState(false);
  const [attempt, setAttempt] = useState(0); // 错误态的「重试」用：变更以重新触发拉取
  // —— 追问（side-chat 轻量版）：基于已生成的报告续问一轮，追加为新章节 ——
  const [followQ, setFollowQ] = useState("");
  const [appending, setAppending] = useState(false);
  const [followError, setFollowError] = useState("");
  const followAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!module) {
      setText("");
      setStreaming(false);
      setError("");
      setFollowQ("");
      setFollowError("");
      setAppending(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setText("");
    setStreaming(false);
    setError("");
    setLoadingCache(true);

    (async () => {
      // 1) 本地存档优先：深挖过就直接展示，不重复烧 token
      try {
        const cached = await getReport(moduleKey(repoTitle, module.id));
        if (cancelled) return;
        if (cached?.fullText) {
          setText(cached.fullText);
          setLoadingCache(false);
          return;
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setLoadingCache(false);
      setStreaming(true);

      try {
        const res = await fetch("/api/repo/module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: repoTitle,
            moduleId: module.id,
            name: module.name,
            dir: module.dir,
            role: module.role,
            keyFiles: module.keyFiles,
            talksToNames: module.talksTo,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `请求失败（${res.status}）`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) msg = data.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) return;
          buf += decoder.decode(value, { stream: true });
          setText(buf);
        }
        setStreaming(false);
        // 服务端流中断时会把「⚠️ 生成过程中连接中断」拼进正文——这份残缺内容不能入库，
        // 否则缓存永远指向残缺报告且无任何自愈入口
        if (buf.includes("生成过程中连接中断")) {
          setError("生成过程中连接中断，请重试。");
          return;
        }
        if (buf) {
          saveReport({
            key: moduleKey(repoTitle, module.id),
            term: module.name,
            parentTerm: repoTitle,
            fullText: buf,
            related: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "生成失败");
        setStreaming(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      followAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.id, repoTitle, attempt]);

  /** 提交追问：流式拿答案，以 "## 💬 追问：…" 章节追加到报告并重新入库 */
  const submitFollowUp = async () => {
    const q = followQ.trim();
    if (!q || !module || appending || streaming) return;
    followAbortRef.current?.abort();
    const controller = new AbortController();
    followAbortRef.current = controller;
    setAppending(true);
    setFollowError("");
    const baseText = text;
    let answer = "";
    try {
      const res = await fetch("/api/repo/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: repoTitle,
          moduleId: module.id,
          name: module.name,
          followUpQuestion: q,
          priorReport: baseText,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `请求失败（${res.status}）`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const header = `\n\n## 💬 追问：${q}\n\n`;
      let appended = header;
      setText(baseText + header); // 先占位出章节标题
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        appended = header + answer;
        setText(baseText + appended);
      }
      if (answer.includes("生成过程中连接中断")) {
        setText(baseText); // 回滚占位，不入库残缺内容
        setFollowError("生成中断，请重试");
        return;
      }
      const finalText = baseText + appended.replace(/<!-- DONE -->/, "").trimEnd();
      setText(finalText);
      setFollowQ("");
      saveReport({
        key: moduleKey(repoTitle, module.id),
        term: module.name,
        parentTerm: repoTitle,
        fullText: finalText,
        related: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError") return;
      setFollowError(err instanceof Error ? err.message : "追问失败");
    } finally {
      setAppending(false);
    }
  };

  if (!module) return null;

  const sections = parseSections(text).filter((s) => s.id !== "sec-intro");

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 h-screen w-full sm:w-[580px] bg-white shadow-2xl z-40 flex flex-col animate-[slideInRight_0.25s_ease-out]">
        <header className="shrink-0 border-b border-[var(--line)] px-5 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold tracking-wide uppercase text-indigo-500 mb-1">
              模块深挖 · 源码走读
            </div>
            <h2 className="text-[20px] font-extrabold text-slate-900 break-all">{module.name}</h2>
            {module.dir && <code className="mt-0.5 inline-block font-mono text-[11px] text-slate-500 truncate max-w-full">{module.dir}</code>}
          </div>
          <button onClick={onClose} className="shrink-0 p-2.5 -m-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer" aria-label="关闭抽屉">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
          {error && !streaming && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-[13.5px] font-medium text-red-700">⚠️ 模块深挖失败</div>
              <div className="text-[12.5px] text-red-600/90 mt-0.5">{error}</div>
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-2.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
              >
                重试
              </button>
            </div>
          )}

          {sections.length === 0 && (streaming || loadingCache) && (
            <div className="space-y-3">
              <div className="text-[12px] text-indigo-500 animate-pulse">
                {loadingCache ? "检查本地存档…" : "正在抓取该模块的源码文件，逐段走读…"}
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="shimmer h-4 w-1/3 mb-3" />
                  <div className="shimmer h-3 w-full" />
                  <div className="shimmer h-3 w-11/12 mt-2" />
                </div>
              ))}
            </div>
          )}

          {!streaming && !loadingCache && !error && sections.length === 0 && (
            <p className="py-10 text-center text-[13px] text-slate-500">
              这份讲解没有解析出章节，试试关闭后重新深挖
            </p>
          )}

          {sections.map((s) => (
            <DrawerSection key={s.id} section={s} streaming={streaming} />
          ))}

          {streaming && sections.length > 0 && (
            <div className="text-[11.5px] text-slate-500 text-center py-2 animate-pulse">仍在生成…</div>
          )}

          {followError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">{followError}</div>
          )}

          {/* 追问输入（side-chat 轻量版）：基于本报告续问一轮 */}
          {!streaming && !loadingCache && sections.length > 0 && (
            <div className="sticky bottom-0 -mx-5 border-t border-[var(--line)] bg-white/95 px-5 py-3 backdrop-blur">
              <div className="flex items-end gap-2">
                <textarea
                  value={followQ}
                  onChange={(e) => setFollowQ(e.target.value.slice(0, 300))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void submitFollowUp();
                    }
                  }}
                  rows={1}
                  placeholder="针对这份讲解追问一句…（Enter 发送）"
                  className="min-h-[36px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 scroll-thin"
                />
                <button
                  onClick={() => void submitFollowUp()}
                  disabled={appending || !followQ.trim()}
                  className="btn-primary shrink-0 px-3.5 py-2 text-[12.5px] disabled:opacity-40"
                >
                  {appending ? "回答中…" : "追问"}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

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
              // 行内 `code` 与块级代码块分开渲染：CodeBlock 会包 <pre>，行内代码若也走它会把段落切碎
              code: ({ className, children, ...rest }) =>
                className || String(children).includes("\n") ? (
                  <CodeBlock className={className}>{children}</CodeBlock>
                ) : (
                  <code className="font-mono text-[12.5px] bg-[var(--bg-soft)] border border-[var(--line)] rounded px-1 py-0.5 text-slate-700" {...rest}>
                    {children}
                  </code>
                ),
            }}
          >
            {section.content}
          </ReactMarkdown>
        ) : streaming ? (
          <div className="space-y-2">
            <div className="shimmer h-3 w-full" />
            <div className="shimmer h-3 w-11/12" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
