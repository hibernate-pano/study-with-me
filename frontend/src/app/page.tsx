"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import { getAllReports, getDueCards } from "@/lib/storage";

const EXAMPLES = ["分布式锁", "十五规划", "Kafka", "费曼学习法", "Raft 共识算法", "什么是CPI"];

const fmtRel = (ts: number): string => {
  const d = new Date(ts);
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

export default function HomePage() {
  const router = useRouter();
  const [dueCount, setDueCount] = useState(0);
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  const [recentConcepts, setRecentConcepts] = useState<{ term: string; updatedAt: number }[]>(
    []
  );
  const [stats, setStats] = useState({ mine: 0, total: 0 });

  const refresh = useCallback(() => {
    Promise.all([getAllReports(), getDueCards()])
      .then(([rs, cards]) => {
        const mains = rs.filter(
          (r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:")
        );
        setStats({
          mine: mains.length,
          total: mains.length + mains.reduce((acc, r) => acc + (r.related?.length ?? 0), 0),
        });
        setRecentConcepts(mains.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5));
        setDueCount(cards.length);
      })
      .catch(() => {});
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

  return (
    <WelcomeHome
      onStart={(q) => router.push(`/analyze/${encodeURIComponent(q)}`)}
      onOpenPalette={() => window.dispatchEvent(new CustomEvent("cd:open-palette"))}
      stats={stats}
      dueCount={dueCount}
      recentTerms={recentTerms}
      recentConcepts={recentConcepts}
      onGoMap={() => router.push("/map")}
      onGoReview={() => router.push("/review")}
    />
  );
}

/* ============== 首页（永远简单 · 不论有没有存档） ============== */
function WelcomeHome({
  onStart,
  onOpenPalette,
  stats,
  dueCount,
  recentTerms,
  recentConcepts,
  onGoMap,
  onGoReview,
}: {
  onStart: (q: string) => void;
  onOpenPalette: () => void;
  stats: { mine: number; total: number };
  dueCount: number;
  recentTerms: string[];
  recentConcepts: { term: string; updatedAt: number }[];
  onGoMap: () => void;
  onGoReview: () => void;
}) {
  const has = stats.mine > 0;

  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-7xl px-6 pt-16 pb-24 fade-up">
        {/* 品牌（左上角） */}
        <div className="flex items-center gap-2.5 mb-14">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
            <path d="M14 4l6 6" />
            <path d="M11 7l-7 7v4h4l7-7" />
            <path d="M5 19l4-4" />
            <path d="M14 9l1 1" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.04em] text-slate-700">
            概念深挖器
          </span>
        </div>

        {/* Hero：居中布局（视觉重心在屏幕中） */}
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif-zh text-[56px] md:text-[76px] leading-[1.05] tracking-[-0.015em]">
            <span className="ink-grad">输入一个词，</span>
            <br />
            <span className="text-slate-900">顺着网络，</span>
            <span className="text-slate-900">学下去。</span>
          </h1>

          <p className="mt-7 text-[17px] text-slate-600 leading-[1.7]">
            从「分布式锁」到「十五规划」，AI 流式给你一份深度解析，列出相关 / 相似 /
            相反 / 跨领域概念。
            <br />
            每个概念都是接力棒——<span className="font-semibold text-slate-800">
              点一下就深挖下一个
            </span>
            。
          </p>

          {/* 搜索框（居中，最大 640px） */}
          <div className="mt-10 mx-auto max-w-2xl">
            <SearchBox autoFocus />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => onStart(e)}
                  className="px-3 py-1.5 rounded-full border border-[var(--line)] bg-white/60 text-[13px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors cursor-pointer"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 完整段落示例（居中） */}
          <button
            onClick={() =>
              onStart("我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？")
            }
            className="mt-5 mx-auto flex max-w-2xl items-start gap-2.5 rounded-lg border border-dashed border-indigo-200 bg-white/40 px-4 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors cursor-pointer text-left"
          >
            <span className="text-[10.5px] font-bold tracking-[0.12em] text-indigo-500 mt-0.5 shrink-0">
              ✦
            </span>
            <span className="text-[13px] text-slate-600 leading-relaxed">
              也支持完整段落 ——{" "}
              <span className="text-slate-700">
                &ldquo;我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？&rdquo;
              </span>
            </span>
          </button>
        </section>

        {/* ── 分隔 ── */}
        <div className="mt-16 mx-auto max-w-3xl border-t border-[var(--line)]" />

        {/* 你的知识库（有存档时） */}
        {has && (
          <section className="mt-14 mx-auto max-w-4xl">
            <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
              <div>
                <div className="text-[10.5px] font-bold tracking-[0.16em] text-slate-400 mb-2">
                  你的知识库
                </div>
                <div className="flex items-baseline gap-3 flex-wrap text-slate-600">
                  <Stat n={stats.mine} label="个概念" emphasize />
                  <span className="text-slate-300">·</span>
                  <Stat n={stats.total - stats.mine} label="关联" />
                  {dueCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <button onClick={onGoReview} className="flex items-baseline gap-1.5 cursor-pointer hover:opacity-80">
                        <Stat n={dueCount} label="张到期复习" amber />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onGoMap}
                className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer"
              >
                <span>🗺</span>
                <span>知识网络地图</span>
                <span>→</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {recentConcepts.map((c) => (
                <button
                  key={c.term}
                  onClick={() => onStart(c.term)}
                  className="group flex items-baseline gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 hover:border-indigo-300 hover:bg-white cursor-pointer"
                >
                  <span className="text-[13px] font-medium text-slate-800 group-hover:text-indigo-700">
                    {c.term}
                  </span>
                  <span className="text-[10.5px] text-slate-400">{fmtRel(c.updatedAt)}</span>
                </button>
              ))}
            </div>

            {recentTerms.length > 0 && (
              <div className="mt-3 flex items-center gap-3 text-[11.5px] text-slate-400 flex-wrap">
                <span>最近搜索</span>
                <div className="flex flex-wrap items-center gap-x-3">
                  {recentTerms.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      onClick={() => onStart(t)}
                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 它能做什么（紧凑 typographic 列表，无分隔线） */}
        <section className={`mx-auto max-w-3xl ${has ? "mt-14" : "mt-16"}`}>
          <div className="text-[10.5px] font-bold tracking-[0.16em] text-slate-400 mb-4">
            它能做什么
          </div>
          <ul className="space-y-3">
            <Cap
              k="一份深度报告"
              v="8 个模块流式解析：一句话定义 / 核心重点 / 常见误区 / 拆解分析 / 进阶路径 / 知识网络 / 深入追问 / 推荐资料。"
            />
            <Cap
              k="自动入档 · 间隔复习"
              v="本地 IndexedDB 持久化；自测题自动变成复习卡，忘了明天再来，记住了间隔翻倍。"
            />
            <Cap
              k="串联成你自己的网络"
              v="每个概念带 5–10 个相关概念，点击接力深挖。登录 GitHub 后云端同步，跨设备可用。"
            />
          </ul>
        </section>

        {/* 底部：⌘K */}
        <div className="mt-12 flex items-center justify-center gap-3">
          <button
            onClick={onOpenPalette}
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3.5 py-1.5 text-[12px] text-slate-600 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer"
          >
            <span>搜索 / 跳转 / 对比 / 复习</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-mono text-slate-500">
              ⌘K
            </kbd>
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400/70 tracking-wide">
          内容由 AI 生成 · 请交叉验证关键信息
        </p>
      </main>
    </div>
  );
}

/* 小元件 */
function Stat({ n, label, emphasize, amber }: { n: number; label: string; emphasize?: boolean; amber?: boolean }) {
  const color = amber
    ? "text-amber-700"
    : emphasize
    ? "text-slate-900"
    : "text-slate-700";
  return (
    <>
      <span className={`font-serif-zh text-[22px] font-semibold tabular-nums leading-none ${color}`}>
        {n}
      </span>
      <span className={`text-[12.5px] ${amber ? "text-amber-700" : "text-slate-500"}`}>
        {label}
      </span>
    </>
  );
}

function Cap({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex gap-5">
      <span className="font-serif-zh text-[14.5px] font-medium text-slate-800 shrink-0 w-[9rem]">
        {k}
      </span>
      <span className="text-[13px] text-slate-500 leading-[1.7] flex-1">{v}</span>
    </li>
  );
}