"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getAllCards,
  getAllExamSets,
  getAllReports,
  type StoredReport,
} from "@/lib/storage";
import type { Card } from "@/lib/cards";
import type { ExamSet } from "@/lib/exams";
import { computeLearningStats, type LearningStats } from "@/lib/learning";

/** 学习统计（趋势页 v2）：全部指标由 IndexedDB 里的真实学习数据计算——
 * 深挖报告、复习卡的间隔重复进度、出题大师的作答记录。
 * 没有任何手动打卡输入（v2 迭代：旧 trends 页吃手动 tasks 数据，已随打卡组删除）。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function heatClass(total: number): string {
  if (total <= 0) return "bg-slate-100";
  if (total <= 2) return "bg-ink-200";
  if (total <= 5) return "bg-ink-500";
  return "bg-ink-800";
}

function dayTitle(d: LearningStats["calendar"][number]): string {
  const parts = [`${d.date}`];
  if (d.deeps) parts.push(`深挖 ${d.deeps}`);
  if (d.reviews) parts.push(`复习 ${d.reviews}`);
  if (d.exams) parts.push(`考试 ${d.exams}`);
  return parts.length > 1 ? parts.join(" · ") : "无学习记录";
}

function StatCell({
  n,
  label,
  sub,
  emphasize,
}: {
  n: number | string;
  label: string;
  sub?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={`tabular-nums leading-none ${
          emphasize ? "text-[30px] font-bold text-ink-900" : "text-[24px] font-semibold text-slate-800"
        }`}
      >
        {n}
      </span>
      <span className="mt-1.5 text-[12.5px] text-slate-600">{label}</span>
      {sub && <span className="mt-0.5 text-[11px] text-slate-400">{sub}</span>}
    </div>
  );
}

export default function TrendsPage() {
  const [stats, setStats] = useState<LearningStats | null>(null);

  useEffect(() => {
    (async () => {
      const [reports, cards, examSets] = await Promise.all([
        getAllReports().catch(() => [] as StoredReport[]),
        getAllCards().catch(() => [] as Card[]),
        getAllExamSets().catch(() => [] as ExamSet[]),
      ]);
      setStats(computeLearningStats(reports, cards, examSets));
    })();
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen px-6 pt-24 text-center text-[13px] text-slate-400">
        正在读取学习记录…
      </div>
    );
  }

  const empty =
    stats.terms + stats.drills + stats.compares === 0 &&
    stats.cards === 0 &&
    stats.examSets === 0;

  // 热力图：第一格对齐到星期，按 7 个一列分周
  const firstOffset = new Date(`${stats.calendar[0].date}T12:00:00`).getDay();
  const cells: (LearningStats["calendar"][number] | null)[] = [
    ...Array.from({ length: firstOffset }, () => null),
    ...stats.calendar,
  ];
  const weeks: (LearningStats["calendar"][number] | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const recentAccuracy = stats.accuracyTrend.slice(-10);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 pt-12 pb-24">
        <div className="fade-up">
          <h1 className="font-disp text-[28px] font-bold tracking-[-0.01em] text-ink-900">
            学习统计
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
            全部由你的真实学习数据自动计算：深挖报告、复习卡的间隔重复进度、出题大师的作答记录。无需打卡。
          </p>
        </div>

        {empty ? (
          <div className="mt-14 rounded-xl border border-dashed border-[var(--line)] bg-white/60 px-6 py-14 text-center">
            <p className="text-[14px] text-slate-500">
              还没有学习记录——深挖第一个概念，这里就会开始长出你的曲线。
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-700"
            >
              去深挖 <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* 总览 */}
            <section className="mt-8 rounded-xl border border-[var(--line)] bg-white px-6 py-5">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <StatCell n={stats.terms} label="个概念" sub={`深挖 ${stats.drills} · 对比 ${stats.compares}`} emphasize />
                <StatCell n={stats.cards} label="张复习卡" sub={`已复习过 ${stats.cardsReviewed} 张`} />
                <StatCell
                  n={stats.attempts}
                  label="份试卷作答"
                  sub={stats.avgAccuracy === null ? "还没考过" : `平均正确率 ${Math.round(stats.avgAccuracy)}%`}
                />
                <StatCell n={stats.streak} label="天连续学习" sub="从今天往回连续有记录" emphasize />
              </div>
              <div className="mt-5 border-t border-[var(--line)] pt-4 text-[12.5px] text-slate-500">
                近 30 天：活跃 {stats.activeDays30} 天 · 新概念 {stats.newTerms30} 个 ·{" "}
                复习 {stats.reviews30} 张卡
              </div>
            </section>

            {/* 学习日历热力图 */}
            <section className="mt-6 rounded-xl border border-[var(--line)] bg-white px-6 py-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold text-slate-800">学习日历 · 最近 91 天</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>少</span>
                  {["bg-slate-100", "bg-ink-200", "bg-ink-500", "bg-ink-800"].map((c) => (
                    <span key={c} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
                  ))}
                  <span>多</span>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex gap-[4px]">
                  <div className="mr-1 flex flex-col gap-[3px] pt-[1px] text-[9.5px] leading-[14px] text-slate-400">
                    {WEEKDAYS.map((w, i) => (
                      <span key={i} className="h-[14px]">
                        {i % 2 === 1 ? w : ""}
                      </span>
                    ))}
                  </div>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((day, di) =>
                        day ? (
                          <span
                            key={day.date}
                            title={dayTitle(day)}
                            className={`h-[14px] w-[14px] rounded-[3px] ${heatClass(day.total)}`}
                          />
                        ) : (
                          <span key={`blank-${wi}-${di}`} className="h-[14px] w-[14px]" />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[11.5px] text-slate-400">
                每格 = 一天的学习事件数（深挖新报告 + 复习卡片 + 考试作答）。悬停看明细。
              </p>
            </section>

            {/* 考试正确率趋势 */}
            {recentAccuracy.length > 0 && (
              <section className="mt-6 rounded-xl border border-[var(--line)] bg-white px-6 py-5">
                <h2 className="text-[13px] font-semibold text-slate-800">考试正确率 · 最近 {recentAccuracy.length} 份</h2>
                <div className="mt-4 flex flex-col gap-2.5">
                  {recentAccuracy.map((a, i) => (
                    <div key={`${a.date}-${i}`} className="flex items-center gap-3">
                      <span className="w-[52px] shrink-0 text-[11.5px] tabular-nums text-slate-400">
                        {a.date.slice(5).replace("-", "/")}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        {/* 数据标记统一数据蓝（Lioran 图表语言），对错语义只落在数字上 */}
                        <div
                          className="h-full rounded-full bg-[var(--data)]"
                          style={{ width: `${Math.max(2, Math.round(a.pct))}%` }}
                        />
                      </div>
                      <span
                        className={`w-[42px] shrink-0 text-right text-[12px] font-medium tabular-nums ${
                          a.pct < 40
                            ? "text-[var(--st-err)]"
                            : a.pct < 60
                              ? "text-[var(--st-warn)]"
                              : "text-slate-700"
                        }`}
                      >
                        {Math.round(a.pct)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
