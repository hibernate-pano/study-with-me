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
      {/* 顶部：单行 typographic 表面 */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-5 pt-4">
          {/* 品牌（typographic，少 chrome） */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-1 py-1.5 cursor-pointer"
            title="概念深挖器"
          >
            <span className="text-[18px] leading-none">⛏️</span>
            <span className="text-[14px] font-bold tracking-[0.04em] text-slate-800">
              概念深挖器
            </span>
          </button>

          {/* typographic 数据条：serif 数字 + 小标 */}
          <div className="hidden md:flex items-baseline gap-4 ml-3 text-slate-600">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif-zh text-[22px] font-semibold tabular-nums text-slate-900 leading-none">
                {mineCount}
              </span>
              <span className="text-[11.5px] text-slate-500">学过的</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif-zh text-[22px] font-semibold tabular-nums text-slate-700 leading-none">
                {totalNodes - mineCount}
              </span>
              <span className="text-[11.5px] text-slate-500">关联</span>
            </div>
            {dueCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => router.push("/review")}
                  className="flex items-baseline gap-1.5 cursor-pointer"
                >
                  <span className="font-serif-zh text-[22px] font-semibold tabular-nums text-amber-700 leading-none">
                    {dueCount}
                  </span>
                  <span className="text-[11.5px] text-amber-700">到期复习</span>
                </button>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* + 新概念 按钮（无键盘用户） */}
          <button
            onClick={openPalette}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/70 backdrop-blur px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/60 cursor-pointer"
            title="深挖一个新概念（⌘K）"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新概念
          </button>

          {/* ⌘K 触发器 */}
          <button
            onClick={openPalette}
            className="surface flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] text-slate-500 hover:text-slate-800 cursor-pointer"
            title="打开命令面板（⌘K）"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden md:inline">搜索</span>
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

      {/* 底部：仅一行键盘提示（极简） */}
      <div className="absolute inset-x-0 bottom-4 z-20 pointer-events-none">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="text-[10.5px] text-slate-400/70 tracking-[0.05em]">
            滚轮缩放 · 拖拽平移 · 拖动节点 · 点击深挖
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 无存档 · 欢迎首页（typographic 重设计） ============== */
function WelcomeHome({ onStart }: { onStart: (q: string) => void }) {
  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-3xl px-6 pt-20 pb-24 fade-up">
        {/* 品牌：打字机风 */}
        <div className="flex items-center gap-2.5 mb-12">
          <span className="text-[20px] leading-none">⛏️</span>
          <span className="text-[14px] font-bold tracking-[0.04em] text-slate-700">
            概念深挖器
          </span>
        </div>

        {/* 大 serif 引语作 hero */}
        <h1 className="font-serif-zh text-[44px] md:text-[60px] leading-[1.1] tracking-tight">
          <span className="ink-grad">输入一个词，</span>
          <br />
          <span className="text-slate-900">顺着网络，</span>
          <span className="text-slate-900">学下去。</span>
        </h1>

        <p className="mt-6 text-[16px] text-slate-600 leading-[1.7] max-w-lg">
          从「分布式锁」到「十五规划」，AI 流式给你一份深度解析，列出相关 / 相似 /
          相反 / 跨领域概念。<br />
          每个概念都是接力棒——<span className="font-semibold text-slate-800">点一下就深挖下一个</span>。
        </p>

        <div className="mt-10">
          <SearchBox autoFocus />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => onStart(e)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--line)] bg-white/60 text-[13px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-4 max-w-xl">
          <button
            onClick={() => onStart("我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？")}
            className="w-full text-left rounded-xl border border-dashed border-indigo-200 bg-white/40 hover:bg-indigo-50/50 hover:border-indigo-300 px-4 py-3 transition-colors cursor-pointer"
          >
            <div className="text-[10.5px] font-bold tracking-[0.12em] text-indigo-500 mb-1.5">
              ✦ 完整段落输入
            </div>
            <div className="text-[13px] text-slate-600 leading-relaxed">
              &ldquo;我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？&rdquo;
            </div>
          </button>
        </div>

        {/* 三件套说明（typographic 列表） */}
        <div className="mt-20 pt-10 border-t border-[var(--line)]">
          <div className="text-[11px] font-bold tracking-[0.16em] text-slate-400 mb-6">
            一份报告 · 八个模块
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
            {MODULES.map((m) => (
              <div key={m.title} className="flex items-baseline gap-3">
                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums w-6 shrink-0">
                  {m.no}
                </span>
                <span className="font-serif-zh text-[15.5px] font-medium text-slate-800 shrink-0">
                  {m.title}
                </span>
                <span className="text-[12.5px] text-slate-500 leading-snug">
                  {m.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 三个落地能力 */}
        <div className="mt-16 pt-10 border-t border-[var(--line)]">
          <div className="text-[11px] font-bold tracking-[0.16em] text-slate-400 mb-6">
            不只生成 · 还能记住
          </div>
          <div className="space-y-4">
            <Feature
              icon="🗂"
              title="间隔重复复习卡"
              desc="报告里的自测题自动变成复习卡，忘了明天再来，记住了间隔翻倍。"
            />
            <Feature
              icon="⚖️"
              title="概念对比"
              desc="把两个容易混淆的概念放一起辨析，五条关键差异一目了然。"
            />
            <Feature
              icon="🗺"
              title="你的知识网络地图"
              desc="所有报告里的「🌐 知识网络」自动聚合成一张图，学得越多网越密。"
            />
          </div>
        </div>

        <p className="mt-20 text-center text-[11.5px] text-slate-400/80 tracking-wide">
          内容由 AI 生成 · 请交叉验证关键信息 · 数据保存在你的浏览器本地
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-[18px] mt-0.5">{icon}</span>
      <div>
        <div className="font-serif-zh text-[15px] font-medium text-slate-800">
          {title}
        </div>
        <div className="text-[13px] text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

const MODULES = [
  { no: "01", title: "一句话定义", desc: "1-2 句话秒懂", color: "#6366f1" },
  { no: "02", title: "核心重点", desc: "先抓什么", color: "#f59e0b" },
  { no: "03", title: "常见误区", desc: "错误认知→正确理解", color: "#ef4444" },
  { no: "04", title: "拆解分析", desc: "拆成部分，讲清关联", color: "#8b5cf6" },
  { no: "05", title: "进阶路径", desc: "从零到精通", color: "#10b981" },
  { no: "06", title: "知识网络", desc: "构建你的知识网", color: "#06b6d4" },
  { no: "07", title: "深入追问", desc: "自测题检验", color: "#ec4899" },
  { no: "08", title: "推荐资料", desc: "书/联网检索", color: "#0ea5e9" },
];