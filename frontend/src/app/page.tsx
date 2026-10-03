"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import {
  IconArrowRight,
  IconBook,
  IconClock,
  IconExam,
  IconNetwork,
  IconSpark,
  IconTrends,
} from "@/components/icons";
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
      onGoTrends={() => router.push("/trends")}
      onGoReview={() => router.push("/review")}
      onGoExam={() => router.push("/exam")}
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
  onGoTrends,
  onGoReview,
  onGoExam,
}: {
  onStart: (q: string) => void;
  onOpenPalette: () => void;
  stats: { mine: number; total: number };
  dueCount: number;
  recentTerms: string[];
  recentConcepts: { term: string; updatedAt: number }[];
  onGoMap: () => void;
  onGoTrends: () => void;
  onGoReview: () => void;
  onGoExam: () => void;
}) {
  const has = stats.mine > 0;

  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-7xl px-6 pt-16 pb-24 fade-up">
        {/* Hero：居中布局（视觉重心在屏幕中） */}
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-disp text-[40px] md:text-[64px] leading-[1.06] tracking-[-0.025em] text-ink-950 text-balance">
            输入一个词，
            <br className="hidden sm:block" />
            顺着网络，学下去。
          </h1>

          <p className="mx-auto mt-6 max-w-xl t-lead text-ink-soft">
            从「分布式锁」到「十五规划」，AI 流式生成一份深度解析，
            并列出相关 / 相似 / 相反 / 跨领域概念——
            <span className="font-semibold text-ink-800">每个概念都是接力棒</span>，
            点一下就继续深挖。
          </p>

          {/* 搜索框与所有交互元素共用一条 672px 轴——整页只有这一条对齐轴 */}
          <div className="mt-10 mx-auto max-w-2xl">
            <SearchBox autoFocus />
            <RelayStrip onStart={onStart} />
          </div>

          {/* 完整段落示例（与搜索框同轴同宽） */}
          <button
            onClick={() =>
              onStart("我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？")
            }
            className="mt-3 mx-auto flex w-full max-w-2xl items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-white/60 px-4 py-2.5 text-left transition-colors hover:border-ink-300 hover:bg-white cursor-pointer"
          >
            <IconSpark size={13} className="shrink-0 text-ink-400" />
            <span className="text-[13px] text-ink-soft leading-relaxed">
              也支持完整段落，例如{" "}
              <span className="text-ink-700">
                &ldquo;我在学分布式系统设计，分布式锁该怎么理解？&rdquo;
              </span>
            </span>
          </button>

          <button
            onClick={onGoExam}
            className="mt-3 mx-auto flex w-full max-w-2xl items-center justify-center gap-2.5 rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3 text-[13px] font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-white"
          >
            <IconExam size={15} className="text-ink-500" />
            <span>出题大师</span>
            <span className="text-ink-300">·</span>
            <span className="text-ink-soft">上传课本，生成多套试卷</span>
            <IconArrowRight size={14} className="text-ink-400" />
          </button>
        </section>

        {/* 今日到期复习提醒（dueCount > 0 时才出现，hero 下方第一触点） */}
        {dueCount > 0 && (
          <button
            onClick={onGoReview}
            className="mx-auto mt-3 flex w-full max-w-2xl items-center justify-center gap-2 rounded-xl border border-[var(--st-warn-line)] bg-[var(--st-warn-bg)] px-5 py-3 text-[14px] font-medium text-[var(--st-warn)] transition-colors hover:brightness-[0.985] cursor-pointer"
          >
            <IconClock size={15} />
            <span>
              你今天有 <span className="font-bold nums">{dueCount}</span> 张概念卡到期复习
            </span>
            <IconArrowRight size={14} />
          </button>
        )}

        {/* ── 分隔 ── */}
        <div className="mt-14 mx-auto max-w-2xl border-t border-[var(--line)]" />

        {/* 你的知识库（有存档时）——与 hero 同轴 */}
        {has && (
          <section className="mt-10 mx-auto max-w-2xl">
            <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
              <div>
                <div className="label mb-2">你的知识库</div>
                <div className="flex items-baseline gap-3 flex-wrap text-ink-soft">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={onGoMap}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-300 hover:text-ink-700 cursor-pointer"
                >
                  <IconNetwork size={13} />
                  <span>知识网络地图</span>
                </button>
                <button
                  onClick={onGoTrends}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-300 hover:text-ink-700 cursor-pointer"
                >
                  <IconTrends size={13} />
                  <span>学习统计</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {recentConcepts.map((c) => (
                <button
                  key={c.term}
                  onClick={() => onStart(c.term)}
                  className="group flex items-baseline gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 hover:border-ink-300 hover:bg-white cursor-pointer"
                >
                  <span className="text-[13px] font-medium text-slate-800 group-hover:text-ink-700">
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
                      className="text-slate-500 hover:text-ink-600 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 它能做什么（三张轻卡片，同轴） */}
        <section className={`mx-auto max-w-2xl ${has ? "mt-10" : "mt-12"}`}>
          <div className="label mb-4">它能做什么</div>
          <ul className="grid gap-3 sm:grid-cols-3">
            <Cap
              icon={<IconBook size={14} />}
              k="一份深度报告"
              v="8 个模块流式解析：一句话定义 / 核心重点 / 常见误区 / 拆解分析 / 进阶路径 / 知识网络 / 深入追问 / 推荐资料。"
            />
            <Cap
              icon={<IconClock size={14} />}
              k="自动入档 · 间隔复习"
              v="本地 IndexedDB 持久化；自测题自动变成复习卡，自评三档：忘了明天重来、模糊温和推进、记住了间隔翻倍。"
            />
            <Cap
              icon={<IconNetwork size={14} />}
              k="串联成你自己的网络"
              v="每个概念带 5–10 个相关概念，点击接力深挖。登录 GitHub 后云端同步，跨设备可用。"
            />
          </ul>
        </section>

        {/* 底部：⌘K */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            onClick={onOpenPalette}
            className="chip text-[12px]"
          >
            <span>搜索 / 跳转 / 对比 / 复习</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
        </div>

        {/* AI 免责声明在侧栏底部常驻（AppShell），首页不再重复 */}
      </main>
    </div>
  );
}

/* 概念接力带：虚线轨道上串起的接力胶囊，让"顺着网络学下去"看得见。
 * 左对齐 wrap：与全页唯一对齐轴一致，第二行不再孤零零居中。
 * 不再逐颗浮动——动画只留给真正改变状态的元素（生成中 / 翻面 / 完成）。 */
function RelayStrip({ onStart }: { onStart: (q: string) => void }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {EXAMPLES.map((e) => (
        <button key={e} onClick={() => onStart(e)} className="chip text-[12.5px]">
          {e}
        </button>
      ))}
    </div>
  );
}

/* 小元件 */
function Stat({ n, label, emphasize, amber }: { n: number; label: string; emphasize?: boolean; amber?: boolean }) {
  const color = amber
    ? "text-[var(--st-warn)]"
    : emphasize
    ? "text-ink-900"
    : "text-ink-700";
  return (
    <>
      <span className={`font-disp text-[22px] font-semibold nums leading-none ${color}`}>
        {n}
      </span>
      <span className={`text-[12.5px] ${amber ? "text-[var(--st-warn)]" : "text-ink-faint"}`}>
        {label}
      </span>
    </>
  );
}

function Cap({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <li className="card lift cursor-default p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-600">
          {icon}
        </span>
        <span className="font-disp text-[14.5px] font-semibold text-ink-800">
          {k}
        </span>
      </div>
      <p className="mt-2.5 text-[13px] leading-[1.75] text-ink-soft">{v}</p>
    </li>
  );
}
