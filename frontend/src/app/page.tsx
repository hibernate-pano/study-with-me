"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import ConceptPreview from "@/components/ConceptPreview";
import SearchBox from "@/components/SearchBox";
import { getAllReports, getDueCards, type StoredReport } from "@/lib/storage";
import type { MapNode } from "@/lib/map";

const EXAMPLES = ["分布式锁", "十五规划", "Kafka", "费曼学习法", "Raft 共识算法", "什么是CPI"];

const fmtArchiveTime = (ts: number): string => {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

export default function HomePage() {
  const router = useRouter();
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [recentTerms, setRecentTerms] = useState<string[]>([]);

  const refresh = useCallback(() => {
    Promise.all([getAllReports(), getDueCards()])
      .then(([rs, cards]) => {
        setReports(rs);
        setDueCount(cards.length);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cd-recent");
      if (raw) setRecentTerms(JSON.parse(raw).slice(0, 6));
    } catch {
      /* ignore */
    }
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const mineReports = useMemo(
    () => reports.filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:")),
    [reports]
  );
  const hasLibrary = loaded && mineReports.length > 0;

  if (hasLibrary) {
    return (
      <LibraryHome
        reports={reports}
        dueCount={dueCount}
        recentTerms={recentTerms}
      />
    );
  }
  return <WelcomeHome onStart={(q) => router.push(`/analyze/${encodeURIComponent(q)}`)} />;
}

/* ============== 有存档 · 地图为家 ============== */
function LibraryHome({
  reports,
  dueCount,
  recentTerms,
}: {
  reports: StoredReport[];
  dueCount: number;
  recentTerms: string[];
}) {
  const router = useRouter();
  const mineCount = reports.filter(
    (r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:")
  ).length;
  const totalNodes = mineCount + reports.reduce((acc, r) => acc + (r.related?.length ?? 0), 0);
  const openPaletteRef = useRef<(() => void) | null>(null);

  // 顶部 ⌘K 按钮：派发一个自定义事件，全局 CommandPalette 监听
  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("cd:open-palette"));
  };
  openPaletteRef.current = openPalette;

  // —— 节点预览抽屉状态 ——
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  const [previewReport, setPreviewReport] = useState<StoredReport | null>(null);

  const handlePreview = useCallback(
    (node: MapNode, report: StoredReport | null) => {
      setPreviewNode(node);
      setPreviewReport(report);
    },
    []
  );
  const closePreview = useCallback(() => {
    setPreviewNode(null);
    setPreviewReport(null);
  }, []);

  // 抽出"这个概念关联的其它概念"，用于预览面板
  const relatedFromHere = useMemo(() => {
    if (!previewReport) return [];
    return previewReport.related.map((c) => ({
      name: c.name,
      relationType: c.relationType,
      color: c.color,
    }));
  }, [previewReport]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--bg)]">
      {/* 顶部：单行 solid 表面（不浮空），整合品牌/数据/搜索/登录 */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-4">
          {/* 品牌 */}
          <button
            onClick={() => router.push("/")}
            className="surface flex items-center gap-2 rounded-full px-3.5 py-2 cursor-pointer"
            title="概念深挖器"
          >
            <span className="text-[15px] leading-none">⛏️</span>
            <span className="text-[13px] font-bold tracking-wide text-slate-800">
              概念深挖器
            </span>
          </button>

          {/* 数据条 */}
          <div className="surface hidden sm:flex items-center gap-3 rounded-full px-3.5 py-2 text-[12.5px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span>
                我的 <span className="font-bold text-slate-800">{mineCount}</span>
              </span>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>
                相关 <span className="font-bold text-slate-800">{totalNodes - mineCount}</span>
              </span>
            </span>
            {dueCount > 0 && (
              <>
                <span className="h-3 w-px bg-slate-200" />
                <button
                  onClick={() => router.push("/review")}
                  className="flex items-center gap-1.5 text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  <span>🗂</span>
                  <span className="font-bold">{dueCount}</span>
                  <span>到期</span>
                </button>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* ⌘K 触发器 */}
          <button
            onClick={openPalette}
            className="surface flex items-center gap-2 rounded-full px-3 py-2 text-[12.5px] text-slate-500 hover:text-slate-800 cursor-pointer"
            title="打开命令面板（⌘K）"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden md:inline">搜索或跳转</span>
            <kbd className="rounded border border-slate-200 bg-white/80 px-1.5 py-0 text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>
      </header>

      {/* 地图全屏 */}
      <MapView
        reports={reports}
        className="absolute inset-0"
        onPreview={handlePreview}
      />

      {/* 节点预览抽屉 */}
      {previewNode && (
        <ConceptPreview
          node={previewNode}
          report={previewReport}
          onClose={closePreview}
          relatedFromHere={relatedFromHere}
        />
      )}

      {/* 底部：单行操作提示 + 极简搜索（仅在用户主动需要时使用） */}
      <div className="absolute inset-x-0 bottom-6 z-20 pointer-events-none">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4">
          {/* 单行搜索条（仅当无最近搜索时显示，否则只显示提示） */}
          {recentTerms.length === 0 ? (
            <div
              className="surface pointer-events-auto flex w-full items-center gap-2 rounded-full px-4 py-2 cursor-text"
              onClick={openPalette}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="flex-1 text-[13px] text-slate-400">深挖一个新概念…</span>
              <kbd className="rounded border border-slate-200 bg-white/80 px-1.5 py-0 text-[10px] font-mono text-slate-400">
                ⌘K
              </kbd>
            </div>
          ) : (
            <div className="surface pointer-events-auto flex w-full items-center gap-2 rounded-full px-4 py-2 cursor-text" onClick={openPalette}>
              <span className="text-[12px] text-slate-400">最近：</span>
              <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                {recentTerms.slice(0, 4).map((t) => (
                  <button
                    key={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/analyze/${encodeURIComponent(t)}`);
                    }}
                    className="text-[12.5px] text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-300">按 ⌘K 搜索更多</span>
            </div>
          )}
          {/* 键盘提示行 */}
          <div className="text-[10.5px] text-slate-400/80 tracking-wide">
            滚轮缩放 · 拖拽平移 · 拖动节点 · 点击深挖 · ⌘K 命令面板
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 无存档 · 欢迎首页 ============== */
function WelcomeHome({ onStart }: { onStart: (q: string) => void }) {
  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-4xl px-5 pt-16 pb-24">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-2xl">⛏️</span>
          <span className="text-[15px] font-bold tracking-wide text-slate-700">
            概念深挖器
          </span>
        </div>

        <h1 className="text-center text-[36px] md:text-[44px] font-extrabold leading-[1.15] tracking-tight">
          <span className="ink-grad">输入一个词，</span>
          <br />
          抓住重点，搞懂概念
        </h1>
        <p className="mt-5 text-center text-[15px] text-slate-500 leading-relaxed max-w-xl mx-auto">
          从「分布式锁」到「十五规划」——AI 帮你厘清概念、拆解分析、找出重点与误区，
          并把它挂到一张<span className="font-semibold text-slate-700">你自己的知识网络</span>上。
        </p>

        <div className="mt-10">
          <SearchBox autoFocus />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => onStart(e)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--line)] bg-white/80 text-[13px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-5 max-w-2xl mx-auto">
          <button
            onClick={() => onStart("我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？")}
            className="w-full text-left rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-3 transition-colors cursor-pointer"
          >
            <div className="text-[11.5px] font-bold tracking-wider text-indigo-500 mb-1">
              ✨ 也支持完整段落
            </div>
            <div className="text-[13.5px] text-slate-600 leading-relaxed">
              &ldquo;我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？&rdquo;
              <span className="ml-1 text-slate-400">→ 点这里试一下</span>
            </div>
          </button>
        </div>

        <p className="mt-3 text-center text-[11.5px] text-slate-400">
          按 <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd> 随时唤起命令面板
        </p>

        <div className="mt-16">
          <h2 className="text-center text-[19px] font-bold text-slate-800">
            一份报告，<span className="text-indigo-600">8</span> 个模块
          </h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="flex items-start gap-3.5 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3.5"
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
                  style={{ background: m.color + "1a" }}
                >
                  {m.icon}
                </span>
                <div>
                  <div className="text-[14px] font-bold text-slate-800">{m.title}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-14 text-center text-[12px] text-slate-400">
          支持技术术语、政策名词、学科概念、人物事件等任意词 · 内容由 AI 生成，请交叉验证关键信息
        </p>
      </main>
    </div>
  );
}

const MODULES = [
  { icon: "🎯", title: "一句话定义", desc: "1-2 句话秒懂概念", color: "#6366f1" },
  { icon: "📌", title: "核心重点", desc: "最重要的事、先抓什么", color: "#f59e0b" },
  { icon: "⚠️", title: "常见误区", desc: "易错点、错误认知→正确理解", color: "#ef4444" },
  { icon: "🧩", title: "拆解分析", desc: "拆成部分，讲清关联", color: "#8b5cf6" },
  { icon: "🧭", title: "进阶路径", desc: "从零到精通的阶段路线", color: "#10b981" },
  { icon: "🌐", title: "知识网络 ⭐", desc: "相关/相似/相反/跨领域，构建你的知识网", color: "#06b6d4" },
  { icon: "🔍", title: "深入追问", desc: "自测题检验真懂假懂", color: "#ec4899" },
  { icon: "📚", title: "推荐资料", desc: "书/文章/课程 + 联网检索", color: "#0ea5e9" },
];