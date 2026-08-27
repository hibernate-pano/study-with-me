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
  const [recentConcepts, setRecentConcepts] = useState<{ term: string; updatedAt: number }[]>([]);
  const [stats, setStats] = useState({ mine: 0, total: 0 });

  const refresh = useCallback(() => {
    Promise.all([getAllReports(), getDueCards()])
      .then(([rs, cards]) => {
        const mains = rs.filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:"));
        setStats({
          mine: mains.length,
          total: mains.length + mains.reduce((acc, r) => acc + (r.related?.length ?? 0), 0),
        });
        setRecentConcepts(
          mains.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
        );
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
      <main className="mx-auto max-w-3xl px-6 pt-14 pb-20 fade-up">
        {/* 品牌 */}
        <div className="flex items-center gap-2.5 mb-12">
          <span className="text-[20px] leading-none">⛏️</span>
          <span className="text-[14px] font-bold tracking-[0.04em] text-slate-700">
            概念深挖器
          </span>
        </div>

        {/* serif hero */}
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

        {/* 我的存档（仅在有存档时出现 · 不抢戏） */}
        {has && (
          <div className="mt-16 pt-10 border-t border-[var(--line)]">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <div className="text-[11px] font-bold tracking-[0.16em] text-slate-400 mb-1">
                  你的知识库
                </div>
                <div className="flex items-baseline gap-3 text-slate-600">
                  <span className="font-serif-zh text-[20px] font-semibold tabular-nums text-slate-900">
                    {stats.mine}
                  </span>
                  <span className="text-[12.5px] text-slate-500">个概念</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-serif-zh text-[20px] font-semibold tabular-nums text-slate-700">
                    {stats.total - stats.mine}
                  </span>
                  <span className="text-[12.5px] text-slate-500">关联</span>
                  {dueCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        onClick={onGoReview}
                        className="font-serif-zh text-[20px] font-semibold tabular-nums text-amber-700 cursor-pointer hover:text-amber-800"
                      >
                        {dueCount}
                      </button>
                      <button
                        onClick={onGoReview}
                        className="text-[12.5px] text-amber-700 hover:text-amber-800 cursor-pointer"
                      >
                        张到期复习 →
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
                <span>打开知识网络地图</span>
                <span>→</span>
              </button>
            </div>

            {/* 最近学过的概念（横向 chips） */}
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
                  <span className="text-[10.5px] text-slate-400">
                    {fmtRel(c.updatedAt)}
                  </span>
                </button>
              ))}
            </div>

            {recentTerms.length > 0 && (
              <div className="mt-4 flex items-center gap-3 text-[11.5px] text-slate-400">
                <span>最近搜索：</span>
                <div className="flex flex-wrap items-center gap-x-3">
                  {recentTerms.slice(0, 6).map((t) => (
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
          </div>
        )}

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

        {/* ⌘K 提示 + footer */}
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <button
            onClick={onOpenPalette}
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-[12.5px] text-slate-600 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer"
          >
            <span>按</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-mono text-slate-500">
              ⌘K
            </kbd>
            <span>唤起命令面板 · 搜索 / 跳转 / 对比 / 复习</span>
          </button>
          <p className="text-[11px] text-slate-400/70 tracking-wide">
            内容由 AI 生成 · 请交叉验证关键信息 · 数据保存在你的浏览器本地
          </p>
        </div>
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