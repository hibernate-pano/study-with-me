"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import SearchBox from "@/components/SearchBox";
import { getAllReports, getDueCards, type StoredReport } from "@/lib/storage";

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

  // —— 全局数据：所有存档 + 到期卡 ——
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [recentTerms, setRecentTerms] = useState<string[]>([]);

  // 命令面板状态（首页内置一个轻量入口：底部中央浮动按钮）
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSeed, setPaletteSeed] = useState("");

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
    // 监听云同步完成事件后刷新一次
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // 过滤掉深挖/对比报告作为「我的概念」统计
  const mineReports = useMemo(
    () => reports.filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:")),
    [reports]
  );
  const hasLibrary = loaded && mineReports.length > 0;

  // —— 有存档时：地图为主角的极简首页 ——
  if (hasLibrary) {
    return (
      <LibraryHome
        reports={reports}
        dueCount={dueCount}
        recentTerms={recentTerms}
        onSearchClick={() => {
          setPaletteSeed("");
          setPaletteOpen(true);
        }}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
        paletteSeed={paletteSeed}
      />
    );
  }

  // —— 无存档时：保留原有欢迎页（首次访问者引导） ——
  return <WelcomeHome onStart={(q) => router.push(`/analyze/${encodeURIComponent(q)}`)} />;
}

/* ============== 有存档 · 地图为家 ============== */
function LibraryHome({
  reports,
  dueCount,
  recentTerms,
  onSearchClick,
  paletteOpen,
  setPaletteOpen,
  paletteSeed,
}: {
  reports: StoredReport[];
  dueCount: number;
  recentTerms: string[];
  onSearchClick: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  paletteSeed: string;
}) {
  const router = useRouter();
  const mineCount = reports.filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:")).length;
  const totalNodes = mineCount + reports.reduce((acc, r) => acc + (r.related?.length ?? 0), 0);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--bg)]">
      {/* 顶部信息条 */}
      <header className="absolute inset-x-0 top-0 z-20 pointer-events-none">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-5">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3.5 py-1.5 backdrop-blur shadow-[0_4px_14px_-4px_rgba(30,40,90,0.12)]">
            <span className="text-base leading-none">⛏️</span>
            <span className="text-[13px] font-bold tracking-wide text-slate-700">概念深挖器</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3.5 py-1.5 backdrop-blur text-[12.5px] text-slate-600 shadow-[0_4px_14px_-4px_rgba(30,40,90,0.12)]">
            <span>我的知识网络</span>
            <span className="font-bold text-indigo-600">{mineCount}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{totalNodes} 个节点</span>
          </div>
          {dueCount > 0 && (
            <button
              onClick={() => router.push("/review")}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-[12.5px] font-medium text-amber-700 backdrop-blur shadow-[0_4px_14px_-4px_rgba(30,40,90,0.12)] hover:bg-amber-50 cursor-pointer"
              title="有复习卡到期"
            >
              <span>🗂</span>
              <span className="font-bold">{dueCount}</span>
              <span>张到期</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onSearchClick}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/40 bg-white/80 px-3 py-1.5 text-[12.5px] text-slate-600 backdrop-blur shadow-[0_4px_14px_-4px_rgba(30,40,90,0.12)] hover:bg-white cursor-pointer"
            title="打开命令面板（⌘K）"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            搜索或跳转
            <kbd className="ml-1 rounded border border-slate-200 bg-white px-1 py-0 text-[10px] font-mono text-slate-400">⌘K</kbd>
          </button>
          <button
            onClick={() => router.push("/map")}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-3 py-1.5 text-[12.5px] text-slate-600 backdrop-blur shadow-[0_4px_14px_-4px_rgba(30,40,90,0.12)] hover:bg-white cursor-pointer"
            title="全屏焦点地图"
          >
            <span>🗺</span>
            <span>全屏</span>
          </button>
        </div>
      </header>

      {/* 地图占满整屏 */}
      <MapView reports={reports} dotted className="absolute inset-0" />

      {/* 底部：浮动搜索条 */}
      <div className="absolute inset-x-0 bottom-8 z-20 pointer-events-none">
        <div className="mx-auto max-w-2xl px-4">
          <div
            className="pointer-events-auto mx-auto rounded-2xl border border-white/40 bg-white/85 backdrop-blur-md shadow-[0_20px_50px_-15px_rgba(15,23,42,0.25)]"
          >
            <SearchBox size="md" />
          </div>
          {/* 最近搜索 / 提示 */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-slate-500">
            <span className="text-slate-400">最近：</span>
            {recentTerms.slice(0, 5).map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/analyze/${encodeURIComponent(t)}`)}
                className="rounded-full border border-white/40 bg-white/70 px-2.5 py-0.5 backdrop-blur hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内置一个迷你命令面板（避免空指针） */}
      {paletteOpen && (
        <MiniPalette
          reports={reports}
          seed={paletteSeed}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}

/* ============== 内置迷你命令面板（首页浮动条触发） ============== */
function MiniPalette({
  reports,
  seed,
  onClose,
}: {
  reports: StoredReport[];
  seed: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(seed);
  const [active, setActive] = useState(0);

  const mains = useMemo(
    () =>
      reports
        .filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:"))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6),
    [reports]
  );

  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const matched = qq
      ? mains.filter((r) => r.term.toLowerCase().includes(qq))
      : mains;
    const acts = [
      { id: "review", title: "去复习", icon: "🗂" },
      { id: "map", title: "全屏地图", icon: "🗺" },
      { id: "compare", title: "概念对比", icon: "⚖️" },
    ];
    return [
      ...matched.map((r) => ({ kind: "report" as const, term: r.term, updatedAt: r.updatedAt })),
      ...acts.map((a) => ({ kind: "action" as const, ...a })),
    ];
  }, [q, mains]);

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(items.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = items[active];
        if (!it) {
          if (q.trim()) {
            onClose();
            router.push(`/analyze/${encodeURIComponent(q.trim())}`);
          }
          return;
        }
        onClose();
        if (it.kind === "report") router.push(`/analyze/${encodeURIComponent(it.term)}`);
        else if (it.id === "review") router.push("/review");
        else if (it.id === "map") router.push("/map");
        else if (it.id === "compare" && mains[0])
          router.push(`/compare?a=${encodeURIComponent(mains[0].term)}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, active, q, mains, router, onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-start pt-[12vh] kbar-backdrop fade-up"
      onClick={onClose}
    >
      <div
        className="kbar-panel mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="搜索你学过的概念，或深挖一个新概念…"
            className="w-full bg-transparent text-[18px] outline-none placeholder:text-slate-400 text-slate-800"
          />
        </div>
        <div className="max-h-[44vh] overflow-y-auto scroll-thin py-1">
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">
              {q.trim() ? `按 Enter 深挖「${q.trim()}」` : "还没有存档"}
            </div>
          ) : (
            items.map((it, i) => {
              const isActive = i === active;
              const title = it.kind === "report" ? it.term : it.title;
              return (
                <button
                  key={(it.kind === "report" ? "r:" : "a:") + (it.kind === "report" ? it.term : it.id)}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    onClose();
                    if (it.kind === "report") router.push(`/analyze/${encodeURIComponent(it.term)}`);
                    else if (it.id === "review") router.push("/review");
                    else if (it.id === "map") router.push("/map");
                    else if (it.id === "compare" && mains[0])
                      router.push(`/compare?a=${encodeURIComponent(mains[0].term)}`);
                  }}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left ${
                    isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-[13px]">
                    {it.kind === "report" ? it.term.slice(0, 1) : it.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-[14px] ${isActive ? "text-indigo-700 font-semibold" : "text-slate-800"}`}>
                      {title}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-400">
                      {it.kind === "report" ? `学过的概念 · ${fmtArchiveTime(it.updatedAt)}` : "内置动作"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-[11px] text-slate-500">
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">↑↓</kbd> 移动</span>
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">↵</kbd> 选择</span>
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}

/* ============== 无存档 · 欢迎首页（首次访问） ============== */
function WelcomeHome({ onStart }: { onStart: (q: string) => void }) {
  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-4xl px-5 pt-16 pb-24">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-2xl">⛏️</span>
          <span className="text-[15px] font-bold tracking-wide text-slate-700">概念深挖器</span>
        </div>

        <h1 className="text-center text-[34px] md:text-[42px] font-extrabold leading-tight tracking-tight text-slate-900">
          输入一个词，
          <br className="md:hidden" />
          快速<span className="text-indigo-600">抓住重点</span>、搞懂概念
        </h1>
        <p className="mt-4 text-center text-[15px] text-slate-500 leading-relaxed">
          从「分布式锁」到「十五规划」——AI 帮你厘清概念、拆解分析、找出重点与误区，
          <br className="hidden md:block" />
          并帮你把它挂到一张知识网络上：相关、相似、相反、跨领域类比，一网打尽。
        </p>

        <div className="mt-9">
          <SearchBox autoFocus />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => onStart(e)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--line)] bg-white text-[13px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors cursor-pointer"
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
          提示：按 <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd> 随时唤起命令面板
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