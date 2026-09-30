"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllReflections, getAllTasks } from "@/lib/storage";
import { ZONES, type Reflection, type Task } from "@/lib/tasks";

const ZONE_STYLES: Record<Task["zone"], string> = {
  comfort: "bg-slate-100 text-slate-600",
  stretch: "bg-emerald-50 text-emerald-700",
  difficult: "bg-amber-50 text-amber-700",
};

export default function HistoryPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);

  useEffect(() => {
    (async () => {
      const [ts, rs] = await Promise.all([getAllTasks(), getAllReflections()]);
      setTasks(ts);
      setReflections(rs);
    })();
  }, []);

  const days = useMemo(() => {
    const set = new Set<string>([
      ...tasks.map((t) => t.date),
      ...reflections.map((r) => r.date),
    ]);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [tasks, reflections]);

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
          <div className="text-[14px] font-bold text-slate-800">🕘 时间线</div>
          <div className="flex-1" />
          <button
            onClick={() => router.push("/today")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            今日
          </button>
          <button
            onClick={() => router.push("/trends")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            趋势
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 fade-up">
        <h1 className="font-disp text-[28px] font-semibold text-[var(--ink-deep)]">
          时间线
        </h1>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          按天回看所有任务与反思。
        </p>

        {days.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-slate-400">
            还没有任何记录。
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {days.map((day) => {
              const dayTasks = tasks.filter((t) => t.date === day);
              const dayReflections = reflections.filter((r) => r.date === day);
              const done = dayTasks.filter((t) => t.done === 1).length;
              return (
                <div key={day}>
                  <div className="mb-1.5 flex items-baseline gap-2 px-1">
                    <span className="font-disp text-[16px] font-semibold text-slate-700">
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[11.5px] text-slate-400">
                        完成 {done} / {dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
                    {dayTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--line)] text-[11px] ${t.done ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "text-slate-400"}`}
                        >
                          {t.done ? "✓" : "○"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${ZONE_STYLES[t.zone]}`}
                        >
                          {ZONES[t.zone]}
                        </span>
                        <span
                          className={`flex-1 text-[13.5px] ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}
                        >
                          {t.content}
                        </span>
                      </div>
                    ))}
                    {dayReflections.map((r) => (
                      <div
                        key={r.date}
                        className="mt-2 space-y-1 border-t border-[var(--line-soft)] pt-2 text-[13px] leading-relaxed text-slate-600"
                      >
                        {r.autopilot && (
                          <p>
                            <span className="font-bold text-slate-700">① 自动驾驶：</span>
                            {r.autopilot}
                          </p>
                        )}
                        {r.stretch && (
                          <p>
                            <span className="font-bold text-slate-700">② 拉伸区：</span>
                            {r.stretch}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
