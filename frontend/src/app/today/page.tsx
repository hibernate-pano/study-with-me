"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTask,
  deleteTask,
  getAllReflections,
  getAllTasks,
  getReflection,
  getTasksByDate,
  normalizeZone,
  saveReflection,
  toggleTask,
} from "@/lib/storage";
import {
  activeDays,
  calcStreak,
  todayStr,
  ZONES,
  ZONE_ORDER,
  type Reflection,
  type Task,
  type Zone,
} from "@/lib/tasks";

const ZONE_STYLES: Record<Zone, string> = {
  comfort: "bg-slate-100 text-slate-600",
  stretch: "bg-emerald-50 text-emerald-700",
  difficult: "bg-amber-50 text-amber-700",
};

export default function TodayPage() {
  const router = useRouter();
  const today = useMemo(() => todayStr(), []);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [autopilot, setAutopilot] = useState("");
  const [stretch, setStretch] = useState("");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);

  // 🔥 由数据派生而不是手动同步：加/删任务、保存反思后不用记得「再刷一次」，
  // 天数只跟着 tasks/reflections 变（与趋势页同一套写法）。
  const streak = useMemo(
    () => calcStreak(activeDays(allTasks, reflections), today),
    [allTasks, reflections, today]
  );

  const refreshData = async () => {
    const [ts, rs] = await Promise.all([getAllTasks(), getAllReflections()]);
    setAllTasks(ts);
    setReflections(rs);
  };

  useEffect(() => {
    (async () => {
      const [ts, r] = await Promise.all([getTasksByDate(today), getReflection(today)]);
      setTasks(ts);
      setAutopilot(r.autopilot);
      setStretch(r.stretch);
      void refreshData();
    })();
  }, [today]);

  const onAdd = async (formData: FormData) => {
    const content = String(formData.get("content") || "").trim();
    if (!content) return;
    const zone = normalizeZone(formData.get("zone"));
    await addTask(today, content, zone);
    setTasks(await getTasksByDate(today));
    void refreshData();
  };

  const onToggle = async (id: number, done: 0 | 1) => {
    await toggleTask(id, done);
    setTasks(await getTasksByDate(today));
    // 不需要刷新 streak：activeDays 只看日期，勾选完成与否算不出连续签到
  };

  const onDelete = async (id: number) => {
    await deleteTask(id);
    setTasks(await getTasksByDate(today));
    void refreshData();
  };

  const onSaveReflection = async (formData: FormData) => {
    const a = String(formData.get("autopilot") || "").trim();
    const s = String(formData.get("stretch") || "").trim();
    // 两栏都空就不写库：空反思会被 activeDays 算成一次打卡，凭空 +1 天
    if (!a && !s) return;
    await saveReflection({ date: today, autopilot: a, stretch: s, updatedAt: Date.now() });
    void refreshData();
  };

  const doneCount = tasks?.filter((t) => t.done === 1).length ?? 0;
  const totalCount = tasks?.length ?? 0;
  const stretchCount = tasks?.filter((t) => t.zone === "stretch" && t.done === 1).length ?? 0;
  const stretchTotal = tasks?.filter((t) => t.zone === "stretch").length ?? 0;

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer lg:hidden"
            title="返回首页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">📅 今日</div>
          <div className="flex-1" />
          <button
            onClick={() => router.push("/history")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            时间线
          </button>
          <button
            onClick={() => router.push("/trends")}
            className="rounded-lg px-2.5 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            趋势
          </button>
          {streak > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
              🔥 {streak} 天
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 fade-up">
        <div>
          <h1 className="font-disp text-[28px] font-semibold text-[var(--ink-deep)]">
            {today}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            成长只发生在拉伸区——跳一跳够得着的挑战，才值得放进今天。
          </p>
          {tasks !== null && totalCount > 0 && (
            <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
              今日完成 {doneCount} / {totalCount} · 拉伸区 {stretchCount} / {stretchTotal}
            </p>
          )}
        </div>

        {/* 拉伸区任务 */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
          <h2 className="text-[15px] font-bold text-slate-800">拉伸区任务</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            按难度分三区（舒适 / 拉伸 / 困难），趋势页只统计拉伸区完成率。
          </p>

          <div className="mt-4 space-y-2">
            {tasks === null && (
              <p className="text-[13px] text-slate-400">加载中…</p>
            )}
            {tasks !== null && tasks.length === 0 && (
              <p className="text-[13px] text-slate-400">今天还没有任务，先加一个吧。</p>
            )}
            {tasks?.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--bg)]/40 px-3 py-2.5"
              >
                <button
                  onClick={() => onToggle(t.id, t.done)}
                  aria-label="切换完成"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t.done ? "✓" : "○"}
                </button>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ZONE_STYLES[t.zone]}`}
                >
                  {ZONES[t.zone]}
                </span>
                <span
                  className={`flex-1 text-[14px] ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}
                >
                  {t.content}
                </span>
                <button
                  onClick={() => onDelete(t.id)}
                  aria-label="删除"
                  className="text-[12px] text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <form action={onAdd} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              name="content"
              placeholder="今天要做的任务…"
              required
              maxLength={120}
              className="min-h-11 flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[16px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--brand)] focus:outline-none sm:text-[13.5px]"
            />
            <div className="flex gap-2">
              <select
                name="zone"
                defaultValue="stretch"
                className="min-h-11 flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-[16px] text-slate-700 focus:border-[var(--brand)] focus:outline-none cursor-pointer sm:flex-none sm:text-[13px]"
              >
                {ZONE_ORDER.map((z) => (
                  <option key={z} value={z}>
                    {ZONES[z]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-[var(--brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--brand-deep)] transition-colors cursor-pointer"
              >
                添加
              </button>
            </div>
          </form>
        </section>

        {/* 每日反思 */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
          <h2 className="text-[15px] font-bold text-slate-800">每日反思 · 3 分钟</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            元认知 = 「觉察我在做什么」。两条问题，每天花 3 分钟，就够了。
          </p>

          <form action={onSaveReflection} className="mt-4 space-y-4">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">
                ① 今天什么时刻我在「自动驾驶」（本能脑/情绪脑接管）？我当时觉察到了吗？
              </p>
              <textarea
                name="autopilot"
                value={autopilot}
                onChange={(e) => setAutopilot(e.target.value)}
                rows={3}
                placeholder="例：午饭后刷了 40 分钟短视频，完全没意识到…"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--brand)] focus:outline-none resize-y"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">
                ② 今天我在拉伸区做了什么？还是缩回了舒适区/硬闯了困难区？
              </p>
              <textarea
                name="stretch"
                value={stretch}
                onChange={(e) => setStretch(e.target.value)}
                rows={3}
                placeholder="例：把明天的分享大纲写了第一版，比想象中顺利…"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--brand)] focus:outline-none resize-y"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!autopilot.trim() && !stretch.trim()}
                className="rounded-lg bg-[var(--brand)] px-5 py-2 text-[13px] font-medium text-white hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                保存反思
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
