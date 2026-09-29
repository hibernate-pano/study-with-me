/** 每日学习：拉伸区任务 + 元认知反思。
 * 类型/纯逻辑（日期、连续签到、30 天统计）放这里；IDB CRUD 见 storage.ts。
 * 原则来自《认知觉醒》《学习觉醒》：
 *  - 舒适区边缘：成长发生在拉伸区（跳转够得着的挑战）
 *  - 元认知：固定问题的每日反思，把觉察变成低门槛动作
 */

export type Zone = "comfort" | "stretch" | "difficult";

export interface Task {
  id: number;
  date: string; // YYYY-MM-DD（本地）
  content: string;
  zone: Zone;
  done: 0 | 1;
}

export interface Reflection {
  date: string; // PK
  autopilot: string;
  stretch: string;
  updatedAt: number;
}

export const ZONES: Record<Zone, string> = {
  comfort: "舒适区",
  stretch: "拉伸区",
  difficult: "困难区",
};

export const ZONE_ORDER: Zone[] = ["comfort", "stretch", "difficult"];

/** 本地今天 YYYY-MM-DD（不依赖时区/UTC，避免跨日偏移） */
export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** dateStr +/- n 天，返回 YYYY-MM-DD */
export function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

/** 连续签到：从今天往前数，今天没记录则从昨天开始；连续断则停。
 *  activeDays：当天有任务或反思的日期集合。
 */
export function calcStreak(activeDays: ReadonlySet<string>, today: string): number {
  let start = activeDays.has(today) ? today : shiftDays(today, -1);
  let n = 0;
  // ponytail: 主动设置上限避免异常输入死循环；30 年够正常人用
  for (let i = 0; i < 30 * 365; i++) {
    if (!activeDays.has(start)) break;
    n++;
    start = shiftDays(start, -1);
  }
  return n;
}

/** 近 N 天（含今天）从旧到新，每天的拉伸区完成率（0-100；null = 当天没有拉伸区任务） */
export function calcStretchRates(
  tasks: ReadonlyArray<Pick<Task, "date" | "zone" | "done">>,
  today: string,
  days = 30
): { day: string; rate: number | null }[] {
  const out: { day: string; rate: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDays(today, -i);
    const dayStretch = tasks.filter((t) => t.date === day && t.zone === "stretch");
    const rate =
      dayStretch.length === 0
        ? null
        : Math.round((dayStretch.filter((t) => t.done === 1).length / dayStretch.length) * 100);
    out.push({ day, rate });
  }
  return out;
}

/** 一段时间内所有出现过的日期（去重）
 *  反思两栏皆空（空提交 / 纯空白）不算打卡，否则一次空保存就凭空多一天连续签到。 */
export function activeDays(
  tasks: ReadonlyArray<Pick<Task, "date">>,
  reflections: ReadonlyArray<Pick<Reflection, "date" | "autopilot" | "stretch">>
): Set<string> {
  return new Set([
    ...tasks.map((t) => t.date),
    ...reflections.filter((r) => r.autopilot?.trim() || r.stretch?.trim()).map((r) => r.date),
  ]);
}