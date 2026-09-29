/**
 * 今日打卡的数据层回归：走真实的 IndexedDB CRUD（fake-indexeddb），验证
 * 「空反思不算打卡」在**真实落库记录**上成立，而不只是纯函数里成立。
 *
 * 为什么纯函数之外还要这一层：修复前 /today 的一次空提交会真的往 IDB 写一条
 * {autopilot:"", stretch:""}。页面层加了守卫只能挡住新增，**已经写进去的脏记录还在库里**，
 * 靠 activeDays 过滤才彻底不参与连续签到计算。这组用真实 saveReflection 写入空记录，
 * 断言它经 activeDays 之后不产生任何 activeDay。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { activeDays, calcStreak } from "./tasks";
import { addTask, deleteTask, getAllReflections, getAllTasks, saveReflection } from "./storage";

/** 与 /today、/trends 两页完全同源的一条计算：数据一样，两页的 🔥 就必须一样 */
const streakFromDb = async (today: string): Promise<number> =>
  calcStreak(activeDays(await getAllTasks(), await getAllReflections()), today);

beforeEach(async () => {
  for (const t of await getAllTasks()) await deleteTask(t.id);
  // 反思没有 delete 导出，用空记录覆盖测试用到的日期。
  // 这本身就是「空记录不该算打卡」的一个隐含前提，下面有用例把它显式钉住。
  for (const r of await getAllReflections()) {
    await saveReflection({ date: r.date, autopilot: "", stretch: "", updatedAt: 0 });
  }
});

describe("已落库的空反思不得把当天算作打卡", () => {
  it("写一条两栏皆空的反思后，连续签到仍是 0", async () => {
    const today = "2025-01-10";
    await saveReflection({ date: today, autopilot: "", stretch: "", updatedAt: 1_736_467_200_000 });

    expect((await getAllReflections()).filter((r) => r.date === today), "空反思确实写进库了（模拟修复前的脏数据）").toHaveLength(1);
    expect(await streakFromDb(today), "空反思不该让 🔥 凭空 +1").toBe(0);
  });

  it("空反思 + 今天有一条真实任务 → 今天照常算打卡（过滤只针对反思）", async () => {
    const today = "2025-03-04";
    await saveReflection({ date: today, autopilot: "", stretch: "", updatedAt: 0 });
    await addTask(today, "把 Mermaid 的失败态可恢复性补上回归测试", "stretch");

    expect(await streakFromDb(today)).toBe(1);
  });

  it("清场用的空记录本身不会把 streak 抬上去（测试前提，不能靠脏数据蒙对）", async () => {
    const today = "2025-05-06";
    await saveReflection({ date: today, autopilot: "", stretch: "", updatedAt: 0 });
    expect(await streakFromDb(today)).toBe(0);

    await saveReflection({ date: today, autopilot: "午饭后刷了 40 分钟短视频，完全没意识到", stretch: "", updatedAt: 0 });
    expect(await streakFromDb(today), "补上真实内容后才算打卡").toBe(1);
  });
});

describe("加/删任务后 streak 立刻跟随（今日页与趋势页必须一致）", () => {
  it("加一条任务 streak 1，删掉它立刻归零", async () => {
    const today = "2025-06-07";
    expect(await streakFromDb(today), "起点是 0").toBe(0);

    const id = await addTask(today, "给 /today 的 streak 派生补回归测试", "stretch");
    expect(await streakFromDb(today), "加任务后应立刻 +1").toBe(1);

    await deleteTask(id);
    expect(await streakFromDb(today), "删掉今天唯一任务且今天没反思 → 归零").toBe(0);
  });

  it("昨天有任务时，删掉今天唯一任务只回落到昨天，不会停在陈旧的高值", async () => {
    const today = "2025-07-08";
    const yesterday = "2025-07-07";
    await addTask(yesterday, "写完深挖报告的模块拆解", "stretch");
    const todayId = await addTask(today, "补齐 tasksStorage 的回归测试", "difficult");

    expect(await streakFromDb(today), "两天都活跃 → 2").toBe(2);

    await deleteTask(todayId);
    expect(await streakFromDb(today), "今天空了，应从昨天接着数 = 1").toBe(1);
  });
});
