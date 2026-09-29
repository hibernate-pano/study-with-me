import { describe, expect, it } from "vitest";
import {
  activeDays,
  calcStreak,
  calcStretchRates,
  shiftDays,
  todayStr,
  type Reflection,
  type Task,
  type Zone,
} from "./tasks";

describe("todayStr / shiftDays", () => {
  it("todayStr 用本地日期拼 YYYY-MM-DD", () => {
    expect(todayStr(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(todayStr(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("shiftDays 跨月", () => {
    expect(shiftDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(shiftDays("2025-03-01", -1)).toBe("2025-02-28");
  });
});

describe("calcStreak", () => {
  it("今天和昨天都有活动 → 从今天数 2 天", () => {
    const s = new Set(["2025-01-09", "2025-01-10"]);
    expect(calcStreak(s, "2025-01-10")).toBe(2);
  });

  it("今天没活动但昨天有 → 从昨天数", () => {
    const s = new Set(["2025-01-08", "2025-01-09"]);
    expect(calcStreak(s, "2025-01-10")).toBe(2);
  });

  it("今天昨天都没 → 0", () => {
    const s = new Set(["2025-01-01"]);
    expect(calcStreak(s, "2025-01-10")).toBe(0);
  });

  it("中间断了就停", () => {
    const s = new Set(["2025-01-08", "2025-01-09"]); // 1-10 是今天
    expect(calcStreak(s, "2025-01-10")).toBe(2); // 9 + 8
  });
});

describe("calcStretchRates", () => {
  const tasks = [
    { date: "2025-01-09", zone: "stretch" as const, done: 1 as const },
    { date: "2025-01-09", zone: "stretch" as const, done: 0 as const },
    { date: "2025-01-09", zone: "comfort" as const, done: 1 as const }, // 不计
    { date: "2025-01-08", zone: "stretch" as const, done: 1 as const },
    { date: "2025-01-07", zone: "stretch" as const, done: 0 as const },
  ];

  it("按 today 起回看 N 天，每天一条；非拉伸区任务不计", () => {
    const r = calcStretchRates(tasks, "2025-01-09", 3);
    expect(r).toEqual([
      { day: "2025-01-07", rate: 0 },
      { day: "2025-01-08", rate: 100 },
      { day: "2025-01-09", rate: 50 },
    ]);
  });

  it("当天无拉伸区任务 → rate=null", () => {
    const r = calcStretchRates([], "2025-01-09", 2);
    expect(r.map((x) => x.rate)).toEqual([null, null]);
  });
});

describe("activeDays", () => {
  it("任务和反思并集去重", () => {
    const s = activeDays(
      [{ date: "2025-01-01" }, { date: "2025-01-02" }],
      [
        { date: "2025-01-02", autopilot: "刷手机", stretch: "" },
        { date: "2025-01-03", autopilot: "", stretch: "写了大纲" },
      ]
    );
    expect([...s].sort()).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("反思两栏皆空/纯空白 → 不算打卡", () => {
    const s = activeDays(
      [],
      [
        { date: "2025-01-01", autopilot: "", stretch: "" },
        { date: "2025-01-02", autopilot: "   ", stretch: "\n" },
        { date: "2025-01-03", autopilot: "", stretch: "写了第一版大纲" },
      ]
    );
    expect([...s]).toEqual(["2025-01-03"]);
    expect(calcStreak(s, "2025-01-03")).toBe(1);
  });
});

/**
 * 空反思打卡：这是「点一下保存反思、🔥 凭空 +1」的根因所在。
 *
 * /today 修复前 onSaveReflection 没有「两栏皆空就 return」的守卫，空提交照样写一条
 * {autopilot:"", stretch:""} 进库；而 activeDays 当时只 map 出日期、根本不看内容，
 * 于是这一天被算作已打卡，顶部 🔥 和 /trends 的 🔥 一起 +1，/history 还多出一张空卡。
 */
const reflection = (date: string, autopilot: string, stretch: string): Reflection => ({
  date,
  autopilot,
  stretch,
  updatedAt: 1_736_467_200_000, // 真实的 IDB 记录形态：date 是主键，updatedAt 是保存时刻
});
const task = (date: string, content: string, zone: Zone = "stretch", done: 0 | 1 = 0): Task => ({
  id: 1,
  date,
  content,
  zone,
  done,
});

describe("activeDays：空反思不得被算作打卡", () => {
  it("两栏皆空的反思记录（修复前空提交写进去的那种）不产生 activeDay", () => {
    const s = activeDays([], [reflection("2025-01-10", "", "")]);
    expect([...s], "空反思不得计入连续签到").toEqual([]);
    expect(calcStreak(s, "2025-01-10"), "空反思不该让 🔥 凭空 +1").toBe(0);
  });

  it("纯空白（只有空格/换行/制表符）同样不算打卡", () => {
    const s = activeDays([], [reflection("2025-01-10", "   ", "\n\t ")]);
    expect([...s]).toEqual([]);
    expect(calcStreak(s, "2025-01-10")).toBe(0);
  });

  it("昨天有真实活动 + 今天只有一条空反思 → 连续签到不因今天凭空 +1", () => {
    const s = activeDays(
      [task("2025-01-09", "把明天的分享大纲写了第一版", "stretch", 1)],
      [reflection("2025-01-10", "", "")]
    );
    // 修复前：今天被 map 进 activeDays → streak=2；修复后：今天不算 → streak=1
    expect(calcStreak(s, "2025-01-10"), "空反思不该把今天算进来").toBe(1);
  });

  it("只填了两栏之一仍然算打卡（别把过滤做过头，把真实反思也滤掉）", () => {
    const s = activeDays(
      [],
      [
        reflection("2025-01-09", "午饭后刷了 40 分钟短视频，完全没意识到", ""),
        reflection("2025-01-10", "", "硬闯困难区：把状态机那章啃完了"),
      ]
    );
    expect([...s].sort()).toEqual(["2025-01-09", "2025-01-10"]);
    expect(calcStreak(s, "2025-01-10")).toBe(2);
  });

  it("空反思的过滤只针对反思：同一天有任务时照常算打卡", () => {
    const s = activeDays([task("2025-01-10", "补齐 tasks.ts 的回归测试")], [reflection("2025-01-10", "", "")]);
    expect([...s]).toEqual(["2025-01-10"]);
    expect(calcStreak(s, "2025-01-10")).toBe(1);
  });
});

/**
 * 今日页与趋势页共用的 streak 契约。
 *
 * 两页都用 calcStreak(activeDays(tasks, reflections), today)，所以只要数据一样，
 * 🔥 必须一样。这组把「加任务后一致 / 删掉今天唯一任务后归零」两条验收标准钉在数据层，
 * 与页面用 useState 还是 useMemo 无关（页面那一层由 app/today/contract.test.ts 守 AST 契约）。
 */
describe("今日页与趋势页共用的 streak 契约", () => {
  const streakOf = (tasks: Task[], reflections: Reflection[], today: string): number =>
    calcStreak(activeDays(tasks, reflections), today);

  const todayTask = task("2025-01-10", "补齐 tasks.ts 的回归测试");

  it("加一条任务后 streak 立刻 +1", () => {
    expect(streakOf([], [], "2025-01-10")).toBe(0);
    expect(streakOf([todayTask], [], "2025-01-10")).toBe(1);
  });

  it("删掉今天唯一任务且今天没反思 → streak 归零（双向偏差里的「多算」那一侧）", () => {
    expect(streakOf([todayTask], [], "2025-01-10")).toBe(1);
    expect(streakOf([], [], "2025-01-10")).toBe(0);
  });

  it("勾选完成与否不改变连续签到（activeDays 不读 done/zone，别在 onToggle 里刷 streak）", () => {
    const done = streakOf([{ ...todayTask, done: 1 }], [], "2025-01-10");
    const notDone = streakOf([{ ...todayTask, done: 0 }], [], "2025-01-10");
    expect(done).toBe(notDone);
  });
});