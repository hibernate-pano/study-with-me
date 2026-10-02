import { describe, expect, it } from "vitest";
import { computeLearningStats, computeStreak, localDayKey } from "./learning";
import type { StoredReport } from "./storage";
import type { Card } from "./cards";
import type { ExamSet } from "./exams";

const DAY = 24 * 60 * 60 * 1000;

// 统一用本地时间构造时刻，测试在任何时区都成立
const NOW = new Date(2026, 9, 2, 12, 0).getTime(); // 2026-10-02 12:00 本地
const DAY5_AGO = NOW - 5 * DAY;
const DAY10_AGO = NOW - 10 * DAY;
const DAY40_AGO = NOW - 40 * DAY;

function report(key: string, createdAt: number): StoredReport {
  return {
    key,
    term: key,
    fullText: "",
    related: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function card(partial: Partial<Card>): Card {
  return {
    key: "k",
    term: "t",
    question: "q",
    answer: "a",
    dueAt: 0,
    intervalDays: 0,
    reps: 0,
    status: "new",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function examSet(attempts: ExamSet["attempts"]): ExamSet {
  return {
    id: "set-1",
    title: "s",
    sourceName: "src",
    focus: "",
    sourceText: "",
    difficulty: 1,
    questions: [],
    papers: [],
    attempts,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("localDayKey", () => {
  it("按本地时区取日期，不受 UTC 偏移影响", () => {
    expect(localDayKey(new Date(2026, 9, 2, 13, 45).getTime())).toBe("2026-10-02");
    // 本地零点刚过：toISOString（UTC）在这里会划到别的日期
    expect(localDayKey(new Date(2026, 9, 2, 0, 30).getTime())).toBe("2026-10-02");
    expect(localDayKey(new Date(2026, 9, 2, 23, 59).getTime())).toBe("2026-10-02");
  });
});

describe("computeStreak", () => {
  const today = "2026-10-02";
  it("今天活跃：从今天往回连续计数", () => {
    const days = new Set(["2026-10-02", "2026-10-01", "2026-09-30"]);
    expect(computeStreak(days, today)).toBe(3);
  });
  it("今天还没学：从昨天起算，不算断", () => {
    const days = new Set(["2026-10-01", "2026-09-30"]);
    expect(computeStreak(days, today)).toBe(2);
  });
  it("昨天也断了：归零", () => {
    expect(computeStreak(new Set(["2026-09-30"]), today)).toBe(0);
    expect(computeStreak(new Set(), today)).toBe(0);
  });
});

describe("computeLearningStats", () => {
  it("空数据：全零、无正确率、日历 91 格全空", () => {
    const s = computeLearningStats([], [], [], NOW);
    expect(s.terms).toBe(0);
    expect(s.avgAccuracy).toBeNull();
    expect(s.streak).toBe(0);
    expect(s.calendar).toHaveLength(91);
    expect(s.calendar.every((d) => d.total === 0)).toBe(true);
    expect(s.calendar[s.calendar.length - 1].date).toBe("2026-10-02");
  });

  it("按 key 前缀分类报告，30 天窗口与日历分桶正确", () => {
    const reports = [
      report("分布式锁", NOW),
      report("对比报告不受新概念数影响", DAY40_AGO), // 主报告（无前缀），40 天前
      report("drill:分布式锁::一致性哈希", NOW),
      report("compare:A::B", NOW),
    ];
    const s = computeLearningStats(reports, [], [], NOW);
    expect(s.terms).toBe(2);
    expect(s.drills).toBe(1);
    expect(s.compares).toBe(1);
    expect(s.newTerms30).toBe(1); // 40 天前的不进 30 天窗口
    const today = s.calendar[s.calendar.length - 1];
    expect(today).toMatchObject({ deeps: 3, reviews: 0, exams: 0, total: 3 });
    const day40 = s.calendar[s.calendar.length - 1 - 40]; // 91 天窗口含 40 天前
    expect(day40.deeps).toBe(1);
  });

  it("只有复习过的卡（reps>0）才算复习事件，按最后复习时间落桶", () => {
    const cards = [
      card({ key: "new-1", reps: 0, createdAt: NOW, updatedAt: NOW }),
      card({ key: "rev-1", reps: 3, createdAt: DAY10_AGO, updatedAt: NOW }),
      card({ key: "rev-2", reps: 1, createdAt: DAY10_AGO, updatedAt: DAY5_AGO }),
    ];
    const s = computeLearningStats([], cards, [], NOW);
    expect(s.cards).toBe(3);
    expect(s.cardsReviewed).toBe(2);
    expect(s.reviews30).toBe(2);
    const today = s.calendar[s.calendar.length - 1];
    const day5 = s.calendar[s.calendar.length - 6];
    expect(today.reviews).toBe(1);
    expect(day5.reviews).toBe(1);
  });

  it("考试：正确率 = score/maxScore，趋势按提交时间升序，空卷不产生 NaN", () => {
    const sets = [
      examSet([
        {
          id: "a2",
          paperId: "p1",
          answers: {},
          selfGrades: {},
          startedAt: NOW,
          submittedAt: NOW,
          score: 8,
          maxScore: 10,
          results: {},
        },
        {
          id: "a1",
          paperId: "p1",
          answers: {},
          selfGrades: {},
          startedAt: DAY5_AGO,
          submittedAt: DAY5_AGO,
          score: 6,
          maxScore: 10,
          results: {},
        },
      ]),
      examSet([
        {
          id: "a3",
          paperId: "p2",
          answers: {},
          selfGrades: {},
          startedAt: NOW,
          submittedAt: NOW,
          score: 0,
          maxScore: 0, // 防御：maxScore 为 0 不产生 NaN
          results: {},
        },
      ]),
    ];
    const s = computeLearningStats([], [], sets, NOW);
    expect(s.examSets).toBe(2);
    expect(s.attempts).toBe(3);
    expect(s.avgAccuracy).not.toBeNull();
    expect(s.avgAccuracy!).toBeCloseTo(((80 + 60 + 0) / 3), 6);
    expect(s.accuracyTrend.map((t) => t.pct)).toEqual([60, 80, 0]);
    expect(s.accuracyTrend[0].date).toBe("2026-09-27");
    const today = s.calendar[s.calendar.length - 1];
    expect(today.exams).toBe(2);
  });

  it("活跃天与连续天数：只由真实事件构成", () => {
    const reports = [report("主概念A", NOW), report("主概念B", DAY10_AGO)];
    const s = computeLearningStats(reports, [], [], NOW);
    expect(s.activeDays30).toBe(2); // 今天 + 10 天前
    expect(s.streak).toBe(1); // 今天活跃，昨天断了
  });
});
