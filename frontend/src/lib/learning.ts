/** 学习统计（趋势页数据层）：从 IndexedDB 已有的真实学习数据计算，零手动输入。
 *
 * 数据口径（都是"最后时间"近似，注释说明局限，UI 不夸大精度）：
 * - 深挖事件 = 报告 createdAt（主报告 / 深挖 / 对比按 key 前缀分类）
 * - 复习事件 = 卡片 reps>0 时的 updatedAt（卡片只存最后一次复习时间，
 *   同一张卡多次复习会归并到最后一次，是"当天复习过的卡数"不是复习动作数）
 * - 考试事件 = ExamAttempt.submittedAt，正确率 = score/maxScore
 *
 * 纯函数、无 IndexedDB 依赖，与 UI 解耦便于测试（同 lib/tasks.ts 的分层原则）。
 */

import type { StoredReport } from "./storage";
import type { Card } from "./cards";
import type { ExamSet } from "./exams";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 本地时区的 YYYY-MM-DD（不用 toISOString：那是 UTC，会划错日界线） */
export function localDayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface LearningDay {
  date: string;
  deeps: number; // 新报告（主概念 + 深挖 + 对比）
  reviews: number; // 当天最后复习的卡片数
  exams: number; // 提交的试卷份数
  total: number;
}

export interface LearningStats {
  terms: number; // 主概念数
  drills: number; // 深挖报告数
  compares: number; // 概念对比数
  cards: number; // 复习卡总数
  cardsReviewed: number; // 至少复习过一次（reps>0）的卡数
  examSets: number; // 题库套数
  attempts: number; // 参考份数
  avgAccuracy: number | null; // 平均正确率 0-100；没考过为 null
  newTerms30: number;
  reviews30: number;
  activeDays30: number;
  streak: number; // 连续学习天数：从今天往回数，今天还没学则从昨天起算
  calendar: LearningDay[]; // 最近 calendarDays 天（含今天），日期升序
  accuracyTrend: { date: string; pct: number }[]; // 按提交时间升序
}

export function computeLearningStats(
  reports: StoredReport[],
  cards: Card[],
  examSets: ExamSet[],
  now: number = Date.now(),
  calendarDays = 91
): LearningStats {
  const todayKey = localDayKey(now);

  // ---- 日历桶：最近 calendarDays 天 ----
  const startKey = localDayKey(now - (calendarDays - 1) * DAY_MS);
  const byDay = new Map<string, LearningDay>();
  for (let ts = now - (calendarDays - 1) * DAY_MS; ; ts += DAY_MS) {
    const key = localDayKey(ts);
    byDay.set(key, { date: key, deeps: 0, reviews: 0, exams: 0, total: 0 });
    if (key >= todayKey) break; // 按 dayKey 比较终止，避免夏令时导致的次数偏差
  }
  const bump = (ts: number, field: "deeps" | "reviews" | "exams") => {
    const key = localDayKey(ts);
    const day = byDay.get(key);
    if (day) {
      day[field] += 1;
      day.total += 1;
    }
  };

  let terms = 0;
  let drills = 0;
  let compares = 0;
  let newTerms30 = 0;
  const cutoff30 = localDayKey(now - 29 * DAY_MS);
  for (const r of reports) {
    if (r.key.startsWith("drill:")) drills += 1;
    else if (r.key.startsWith("compare:")) compares += 1;
    else {
      terms += 1;
      if (localDayKey(r.createdAt) >= cutoff30) newTerms30 += 1;
    }
    if (localDayKey(r.createdAt) >= startKey) bump(r.createdAt, "deeps");
  }

  let reviews30 = 0;
  let cardsReviewed = 0;
  for (const c of cards) {
    // reps>0 才算复习过；新卡的 updatedAt 等于创建时间，不能混入
    if (c.reps > 0) {
      cardsReviewed += 1;
      if (localDayKey(c.updatedAt) >= startKey) bump(c.updatedAt, "reviews");
      if (localDayKey(c.updatedAt) >= cutoff30) reviews30 += 1;
    }
  }

  const attempts = examSets.flatMap((s) => s.attempts);
  let avgAccuracy: number | null = null;
  let accuracyTrend: { date: string; pct: number }[] = [];
  if (attempts.length > 0) {
    const pctOf = (a: { score: number; maxScore: number }) =>
      a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
    avgAccuracy = attempts.reduce((sum, a) => sum + pctOf(a), 0) / attempts.length;
    accuracyTrend = [...attempts]
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map((a) => ({ date: localDayKey(a.submittedAt), pct: pctOf(a) }));
    for (const a of attempts) {
      if (localDayKey(a.submittedAt) >= startKey) bump(a.submittedAt, "exams");
    }
  }

  // ---- 汇总指标 ----
  const calendar = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const activeDays30 = calendar
    .filter((d) => d.date >= cutoff30)
    .filter((d) => d.total > 0).length;
  const streak = computeStreak(
    new Set(calendar.filter((d) => d.total > 0).map((d) => d.date)),
    todayKey
  );

  return {
    terms,
    drills,
    compares,
    cards: cards.length,
    cardsReviewed,
    examSets: examSets.length,
    attempts: attempts.length,
    avgAccuracy,
    newTerms30,
    reviews30,
    activeDays30,
    streak,
    calendar,
    accuracyTrend,
  };
}

/** 连续学习天数：从 today 往回数连续活跃天；今天还没学不算断，从昨天起算。 */
export function computeStreak(activeDays: Set<string>, todayKey: string): number {
  let cursor = todayKey;
  if (!activeDays.has(cursor)) {
    cursor = localDayKey(new Date(`${cursor}T12:00:00`).getTime() - DAY_MS);
    if (!activeDays.has(cursor)) return 0;
  }
  let n = 0;
  while (activeDays.has(cursor)) {
    n += 1;
    cursor = localDayKey(new Date(`${cursor}T12:00:00`).getTime() - DAY_MS);
  }
  return n;
}
