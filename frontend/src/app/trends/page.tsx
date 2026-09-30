"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllReflections, getAllTasks } from "@/lib/storage";
import {
  activeDays,
  calcStreak,
  calcStretchRates,
  todayStr,
  type Reflection,
  type Task,
} from "@/lib/tasks";

const BAR_W = 14;
const BAR_GAP = 6;
const H = 140;

export default function TrendsPage() {
  const router = useRouter();
  const today = useMemo(() => todayStr(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);

  useEffect(() => {
    (async () => {
      const [ts, rs] = await Promise.all([getAllTasks(), getAllReflections()]);
      setTasks(ts);
      setReflections(rs);
    })();
  }, []);

  const bars = useMemo(() => calcStretchRates(tasks, today, 30), [tasks, today]);
  const streak = useMemo(
    () => calcStreak(activeDays(tasks, reflections), today),
    [tasks, reflections, today]
  );
  const rated = bars.filter((b) => b.rate !== null) as { day: string; rate: number }[];
  const avg =
    rated.length === 0
      ? 0
      : Math.round(rated.reduce((s, b) => s + b.rate, 0) / rated.length);

  const chartW = bars.length * (BAR_W + BAR_GAP);

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3">
          <button
            onClick={() => router.push("/")}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">📈 趋势</div>
          <div className="flex-1" />
          <button
            onClick={() => router.push("/today")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            今日
          </button>
          <button
            onClick={() => router.push("/history")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            时间线
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 fade-up">
        <div>
          <h1 className="font-disp text-[28px] font-semibold text-[var(--ink-deep)]">
            近 30 天
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            目标不是 100%，而是让柱子持续出现。
          </p>
        </div>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[12px] font-medium text-slate-500">连续签到</div>
              <div className="mt-1 font-disp text-[36px] font-semibold text-[var(--ink-deep)]">
                {streak}
                <span className="ml-1 text-[14px] font-normal text-slate-400">天</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] font-medium text-slate-500">
                拉伸区任务平均完成率
              </div>
              <div className="mt-1 font-disp text-[36px] font-semibold text-[var(--ink-deep)]">
                {avg}
                <span className="ml-1 text-[14px] font-normal text-slate-400">%</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
          <h2 className="text-[14px] font-bold text-slate-700">拉伸区完成率（%）</h2>
          <svg
            viewBox={`0 0 ${chartW} ${H + 20}`}
            className="mt-3 w-full"
            style={{ height: "auto" }}
            role="img"
            aria-label="近 30 天拉伸区任务完成率柱状图"
          >
            {bars.map((b, i) => {
              const h = b.rate === null ? 2 : (b.rate / 100) * H;
              const y = H - h;
              return (
                <g key={b.day}>
                  <rect
                    x={i * (BAR_W + BAR_GAP)}
                    y={y}
                    width={BAR_W}
                    height={h}
                    rx={3}
                    fill={b.rate === null ? "#e3e3df" : "#047857"}
                  >
                    <title>
                      {b.rate === null
                        ? `${b.day}：无拉伸区任务`
                        : `${b.day}：${b.rate}%`}
                    </title>
                  </rect>
                  {i % 5 === 0 && (
                    <text
                      x={i * (BAR_W + BAR_GAP) + BAR_W / 2}
                      y={H + 14}
                      textAnchor="middle"
                      fill="#5b6478"
                      style={{ fontSize: 9, fontFamily: "inherit" }}
                    >
                      {b.day.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-[11.5px] text-slate-400">
            灰色 = 当天没有拉伸区任务。{rated.length > 0
              ? `${rated.length} 天有记录`
              : "还没有记录"}
            ，去
            <button
              onClick={() => router.push("/today")}
              className="mx-1 underline underline-offset-2 hover:text-[var(--brand)] cursor-pointer"
            >
              今日
            </button>
            加一条吧。
          </p>
        </section>
      </main>
    </div>
  );
}
