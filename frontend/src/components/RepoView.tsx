"use client";

/**
 * Repo 学习视图：项目地图探索器（与概念管线 AnalyzeView 完全分开的展示形态）。
 *
 * 数据来自 /api/repo 的结构化 JSON（lib/atlas.ts schema），UI 是「地图 + 路线 + 卡片」：
 * - 项目名片：是什么、牛在哪；
 * - 可交互架构图：模块节点 + 数据流箭头（手写 SVG 圆形布局，零依赖）；
 * - 阅读路线：跟读模式，进度存 localStorage；
 * - 模块卡片：点节点/路线站展开——职责、关键文件、协作、自测题。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAtlas, type Atlas, type AtlasModule } from "@/lib/atlas";
import { getReport, saveReport, getRepoProgress, saveRepoProgress, syncRepoCards } from "@/lib/storage";
import RepoModuleDrawer from "./RepoModuleDrawer";
import AtlasGraph from "./AtlasGraph";

function fmtStars(n?: number): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** 地图生成/加载后统一后置处理：自测题 → 复习卡（幂等，失败静默） */
function ingestAtlas(title: string, atlas: Atlas): void {
  syncRepoCards(title, atlas).catch(() => {});
}

export default function RepoView({ owner, repo }: { owner: string; repo: string }) {
  const router = useRouter();
  const title = `${owner}/${repo}`;
  const storageKey = `repo:${title}`;

  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [deepDive, setDeepDive] = useState<AtlasModule | null>(null);
  // —— L2 下钻：模块内部地图 ——
  const [drillModule, setDrillModule] = useState<AtlasModule | null>(null);
  const [moduleAtlas, setModuleAtlas] = useState<Atlas | null>(null);
  const [moduleMapState, setModuleMapState] = useState<"idle" | "loading" | "error">("idle");
  const [moduleMapError, setModuleMapError] = useState("");
  const [subSelected, setSubSelected] = useState<string | null>(null);

  const bufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const genIdRef = useRef(0);
  const drillAbortRef = useRef<AbortController | null>(null);
  const drillGenRef = useRef(0);

  /** L2：加载模块内部地图（本地存档优先，否则现抓模块源码生成） */
  const openDrill = useCallback(
    (mod: AtlasModule) => {
      const myGen = ++drillGenRef.current;
      drillAbortRef.current?.abort();
      const controller = new AbortController();
      drillAbortRef.current = controller;
      setDrillModule(mod);
      setModuleAtlas(null);
      setSubSelected(null);
      setModuleMapState("loading");
      setModuleMapError("");
      const mapKey = `${storageKey}::${mod.id}#map`;

      (async () => {
        try {
          const cached = await getReport(mapKey);
          if (myGen !== drillGenRef.current) return;
          if (cached?.fullText) {
            const parsed = parseAtlas(cached.fullText);
            if (parsed) {
              setModuleAtlas(parsed);
              setSubSelected(parsed.path[0]?.moduleId ?? parsed.modules[0]?.id ?? null);
              setModuleMapState("idle");
              return;
            }
          }
          const res = await fetch("/api/repo/module/atlas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ term: title, name: mod.name, dir: mod.dir, role: mod.role, keyFiles: mod.keyFiles }),
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
            if (myGen !== drillGenRef.current) return;
            buf += decoder.decode(value, { stream: true });
          }
          if (myGen !== drillGenRef.current) return;
          if (buf.includes("生成过程中连接中断")) throw new Error("生成中断，请重试");
          const parsed = parseAtlas(buf);
          if (!parsed) throw new Error("内部地图解析失败，请重试");
          setModuleAtlas(parsed);
          setSubSelected(parsed.path[0]?.moduleId ?? parsed.modules[0]?.id ?? null);
          setModuleMapState("idle");
          saveReport({ key: mapKey, term: `${title} · ${mod.name} 内部地图`, fullText: buf, related: [], createdAt: Date.now(), updatedAt: Date.now() }).catch(() => {});
        } catch (err: unknown) {
          if (myGen !== drillGenRef.current) return;
          if (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError") return;
          setModuleMapError(err instanceof Error ? err.message : "加载失败");
          setModuleMapState("error");
        }
      })();
    },
    [storageKey, title]
  );

  const closeDrill = useCallback(() => {
    drillGenRef.current++;
    drillAbortRef.current?.abort();
    setDrillModule(null);
    setModuleAtlas(null);
    setSubSelected(null);
    setModuleMapState("idle");
  }, []);

  const start = useCallback(async () => {
    const myGen = ++genIdRef.current;
    // 并发防护：掐掉上一个在途请求（快速重复点「重新绘制地图」时两个流会交错污染同一 buffer）
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    bufferRef.current = "";
    setAtlas(null);
    setStreaming(true);
    setError("");
    setSelected(null);

    try {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: title }),
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
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bufferRef.current += decoder.decode(value, { stream: true });
      }
      if (myGen !== genIdRef.current) return;

      const parsed = parseAtlas(bufferRef.current);
      if (!parsed) throw new Error("生成内容解析失败（模型未返回合法的项目地图），请重新生成");

      setAtlas(parsed);
      setSelected(parsed.path[0]?.moduleId ?? parsed.modules[0]?.id ?? null);
      setStreaming(false);
      setCachedAt(Date.now());
      saveReport({ key: storageKey, term: title, fullText: bufferRef.current, related: [], createdAt: Date.now(), updatedAt: Date.now() }).catch(() => {});
      // 路线内容已变：旧进度按索引对不上，重置（进度本身也同步重置到云端）
      setDoneSteps(new Set());
      void saveRepoProgress(storageKey, new Set()).catch(() => {});
      ingestAtlas(title, parsed);
    } catch (err: unknown) {
      if (myGen !== genIdRef.current) return;
      const aborted = typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError";
      setError(aborted ? "已停止生成" : err instanceof Error ? err.message : "生成失败，请重试");
      setStreaming(false);
    }
  }, [title, storageKey]);

  // 首次进入：先载进度再载地图（顺序化，避免慢到的进度覆盖用户已点的状态）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getRepoProgress(storageKey);
        if (!cancelled) setDoneSteps(s);
      } catch {
        /* ignore */
      }
      try {
        const r = await getReport(storageKey);
        if (cancelled) return;
        if (r?.fullText) {
          const parsed = parseAtlas(r.fullText);
          if (parsed) {
            setAtlas(parsed);
            setSelected(parsed.path[0]?.moduleId ?? parsed.modules[0]?.id ?? null);
            setCachedAt(r.updatedAt);
            ingestAtlas(title, parsed);
            return;
          }
        }
        void start();
      } catch {
        if (!cancelled) void start();
      }
    })();
    return () => {
      cancelled = true;
      genIdRef.current++;
      abortRef.current?.abort();
      drillAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const toggleStep = (i: number) => {
    // 在 updater 外算好再 setState，避免 StrictMode 下 updater 双调触发双次云推送
    const next = new Set(doneSteps);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDoneSteps(next);
    void saveRepoProgress(storageKey, next).catch(() => {});
  };

  if (streaming) {
    return (
      <Shell owner={owner} repo={repo} onHome={() => router.push("/")}>
        <div className="mx-auto max-w-3xl py-20 text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full bg-indigo-50 px-4 py-2 text-[13px] font-medium text-indigo-600">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            正在抓取仓库结构，绘制项目地图…
          </div>
          <div className="mt-8 space-y-3 text-left">
            <div className="shimmer h-5 w-2/5" />
            <div className="shimmer h-4 w-full" />
            <div className="shimmer h-4 w-11/12" />
            <div className="shimmer h-40 w-full" />
            <div className="shimmer h-4 w-3/4" />
          </div>
          <button onClick={() => abortRef.current?.abort()} className="btn-ghost mt-6 px-4 py-2 text-[13px]">
            停止生成
          </button>
        </div>
      </Shell>
    );
  }

  if (error && !atlas) {
    return (
      <Shell owner={owner} repo={repo} onHome={() => router.push("/")}>
        <div className="mx-auto max-w-xl py-20">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="text-[14px] font-medium text-red-700">⚠️ 项目地图生成失败</div>
            <div className="mt-1 text-[13px] text-red-600/90">{error}</div>
            <button onClick={start} className="mt-3 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer">
              重试
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!atlas) return null;

  const byId = new Map(atlas.modules.map((m) => [m.id, m]));
  const mod: AtlasModule | null = (selected && byId.get(selected)) || atlas.modules[0] || null;
  // L2 下钻视图的当前节点（仅 drill 模式用）
  const subNode =
    drillModule && moduleAtlas
      ? moduleAtlas.modules.find((m) => m.id === subSelected) ?? moduleAtlas.modules[0] ?? null
      : null;

  return (
    <Shell owner={owner} repo={repo} onHome={() => router.push("/")}>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* —— 项目名片 —— */}
        <div className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-serif-zh text-[30px] md:text-[38px] font-bold ink-grad leading-tight tracking-tight">{title}</h1>
            {atlas.stats?.language && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11.5px] font-medium text-indigo-600">{atlas.stats.language}</span>
            )}
            {fmtStars(atlas.stats?.stars) && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-600">⭐ {fmtStars(atlas.stats?.stars)}</span>
            )}
            {cachedAt && (
              <span className="text-[11.5px] text-slate-500">本地存档 · 已生成地图</span>
            )}
          </div>
          <p className="mt-3 text-[15.5px] leading-relaxed text-slate-700">{atlas.pitch}</p>
          {atlas.why.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {atlas.why.map((w, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-slate-600">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  {w}
                </li>
              ))}
            </ul>
          )}
          {atlas.stats?.topics && atlas.stats.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {atlas.stats.topics.map((t) => (
                <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* —— 地图 + 路线 —— */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* 架构图 */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                {drillModule && (
                  <button
                    onClick={closeDrill}
                    className="rounded-lg px-2 py-0.5 text-[12.5px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="返回项目全景地图"
                  >
                    ← 全景
                  </button>
                )}
                <h2 className="text-[15px] font-bold text-slate-800">
                  {drillModule ? `🔍 ${drillModule.name} · 内部地图` : "🏗 架构地图"}
                </h2>
              </div>
              <span className="text-[11.5px] text-slate-500">
                {drillModule ? "点文件节点可源码走读" : "点模块看详解 · 「钻入内部」逐层深入"}
              </span>
            </div>

            {drillModule ? (
              moduleMapState === "loading" ? (
                <div className="space-y-3 py-10">
                  <div className="text-center text-[12.5px] text-indigo-500 animate-pulse">
                    正在抓取「{drillModule.name}」的源码，绘制内部地图…（约 30-60s）
                  </div>
                  <div className="shimmer mx-auto h-40 w-4/5" />
                </div>
              ) : moduleMapState === "error" ? (
                <div className="py-10 text-center">
                  <div className="text-[13px] text-red-600">⚠️ {moduleMapError}</div>
                  <button onClick={() => openDrill(drillModule)} className="btn-ghost mt-3 px-4 py-2 text-[12.5px]">重试</button>
                </div>
              ) : moduleAtlas ? (
                <>
                  {moduleAtlas.pitch && <p className="mb-3 text-[13px] leading-relaxed text-slate-600">{moduleAtlas.pitch}</p>}
                  <AtlasGraph
                    modules={moduleAtlas.modules}
                    selected={subSelected}
                    onSelect={setSubSelected}
                    emptyEdgeHint="这次没有标注模块内部的依赖关系"
                  />
                  {moduleAtlas.why.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="text-[11.5px] font-bold tracking-wider text-slate-500 mb-1">内部机关</div>
                      <ul className="space-y-1">
                        {moduleAtlas.why.map((w, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-600">
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null
            ) : (
              <AtlasGraph modules={atlas.modules} selected={selected} onSelect={setSelected} />
            )}
          </div>

          {/* 阅读路线 */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold text-slate-800">🧭 阅读路线</h2>
              <span className="text-[11.5px] text-slate-500">{doneSteps.size}/{atlas.path.length} 站</span>
            </div>
            {atlas.path.length === 0 ? (
              <p className="text-[13px] text-slate-500">（这次没有生成路线，直接点架构图模块看详解吧）</p>
            ) : (
              <ol className="space-y-2.5">
                {atlas.path.map((step, i) => {
                  const done = doneSteps.has(i);
                  const m = byId.get(step.moduleId);
                  const active = mod?.id === step.moduleId;
                  return (
                    <li key={i} className={`flex gap-2.5 rounded-xl border p-2.5 transition-colors ${active ? "border-indigo-200 bg-indigo-50/60" : "border-transparent hover:bg-slate-50"}`}>
                      <button
                        onClick={() => toggleStep(i)}
                        title={done ? "标记为未读" : "标记为已懂"}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                          done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </button>
                      <button
                        onClick={() => setSelected(step.moduleId)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className={`text-[13px] font-medium leading-snug ${done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                          {step.title || m?.name || step.moduleId}
                        </div>
                        {step.goal && <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{step.goal}</div>}
                        {m?.dir && <div className="mt-1 font-mono text-[10.5px] text-slate-500 truncate">{m.dir}</div>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {/* —— 模块卡片（L1） / 内部节点卡（L2） —— */}
        {drillModule && subNode ? (
          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-[19px] font-bold text-slate-900">{subNode.name}</h2>
              {subNode.dir && <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] text-slate-500">{subNode.dir}</code>}
            </div>
            <p className="mt-2.5 text-[14px] leading-relaxed text-slate-700">{subNode.role}</p>
            {(() => {
              const file = subNode.keyFiles[0] || subNode.dir;
              if (!file) return null;
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setDeepDive({ id: subNode.id, name: subNode.name, dir: file, role: subNode.role, keyFiles: [file], talksTo: [], questions: [] })
                    }
                    className="btn-primary px-3.5 py-1.5 text-[12.5px]"
                    title="现抓这个文件的源码，逐段走读讲解（右侧抽屉）"
                  >
                    深挖此文件 · 逐段走读
                  </button>
                  <a
                    href={`https://github.com/${title}/blob/HEAD/${file}`}
                    target="_blank"
                    rel="noopener"
                    className="btn-ghost px-3.5 py-1.5 text-[12.5px]"
                  >
                    在 GitHub 打开原文 ↗
                  </a>
                </div>
              );
            })()}
            {subNode.talksTo.filter((t) => moduleAtlas?.modules.some((m) => m.id === t)).length > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold tracking-wider text-slate-500 mb-1.5">和内部谁协作</div>
                <div className="flex flex-wrap gap-1.5">
                  {subNode.talksTo
                    .filter((t) => moduleAtlas?.modules.some((m) => m.id === t))
                    .map((t) => (
                      <button key={t} onClick={() => setSubSelected(t)} className="rounded-lg border border-[var(--line-soft)] bg-white px-2.5 py-1 text-[12.5px] text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer">
                        {moduleAtlas!.modules.find((m) => m.id === t)!.name} →
                      </button>
                    ))}
                </div>
              </div>
            )}
            {subNode.questions.length > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold tracking-wider text-slate-500 mb-1.5">自测：读完该能答上</div>
                <ul className="space-y-1.5">
                  {subNode.questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-slate-600">
                      <span className="text-slate-300">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          mod && (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-[19px] font-bold text-slate-900">{mod.name}</h2>
              {mod.dir && <code className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-500">{mod.dir}</code>}
            </div>
            <p className="mt-2.5 text-[14px] leading-relaxed text-slate-700">{mod.role}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setDeepDive(mod)}
                className="btn-primary px-3.5 py-1.5 text-[12.5px]"
                title="现抓该模块源码，逐段走读讲解（新窗口抽屉）"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                深挖源码 · 逐段走读
              </button>
              <button
                onClick={() => openDrill(mod)}
                className="btn-ghost px-3.5 py-1.5 text-[12.5px]"
                title="看这个模块内部由哪些文件组成、怎么协作（层层深入第二层）"
              >
                钻入内部地图 ↓
              </button>
            </div>

            {mod.keyFiles.length > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold tracking-wider text-slate-500 mb-1.5">该读的文件 <span className="font-normal text-slate-300">· AI 生成，以 GitHub 原文为准</span></div>
                <ul className="space-y-1">
                  {mod.keyFiles.map((f) => (
                    <li key={f} className="font-mono text-[12.5px] text-slate-600">
                      <a href={`https://github.com/${title}/blob/HEAD/${f}`} target="_blank" rel="noopener" className="hover:text-indigo-600 hover:underline break-all">
                        {f} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mod.talksTo.filter((t) => byId.has(t)).length > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold tracking-wider text-slate-500 mb-1.5">和谁协作</div>
                <div className="flex flex-wrap gap-1.5">
                  {mod.talksTo.filter((t) => byId.has(t)).map((t) => (
                    <button key={t} onClick={() => setSelected(t)} className="rounded-lg border border-[var(--line-soft)] bg-white px-2.5 py-1 text-[12.5px] text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer">
                      {byId.get(t)!.name} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mod.questions.length > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold tracking-wider text-slate-500 mb-1.5">自测：读完该能答上</div>
                <ul className="space-y-1.5">
                  {mod.questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-slate-600">
                      <span className="text-slate-300">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          )
        )}

        {/* —— 模块深挖抽屉 —— */}
        <RepoModuleDrawer module={deepDive} repoTitle={title} onClose={() => setDeepDive(null)} />

        {/* 底部操作 */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={start} className="btn-primary px-5 py-2.5 text-[13.5px]">↻ 重新绘制地图</button>
          <a href={`https://github.com/${title}`} target="_blank" rel="noopener" className="btn-ghost px-5 py-2.5 text-[13.5px]">去 GitHub 看仓库 ↗</a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ owner, repo, onHome, children }: { owner: string; repo: string; onHome: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-2.5">
          <button onClick={onHome} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-500 hover:bg-[var(--bg-soft)] transition-colors cursor-pointer" title="返回首页">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            首页
          </button>
          <div className="h-5 w-px bg-[var(--line)] mx-1" />
          <span className="text-[12.5px] text-slate-500">Repo 学习模式 · <span className="font-mono">{owner}/{repo}</span></span>
        </div>
      </header>
      {children}
    </div>
  );
}
