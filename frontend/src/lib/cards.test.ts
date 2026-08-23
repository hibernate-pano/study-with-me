import { describe, it, expect } from "vitest";
import {
  parseQuizSection,
  nextCard,
  newCard,
  hashString,
  fmtCardInfo,
  type Card,
} from "./cards";

const fullQuizMd = `
## 🔍 深入追问
1. 什么是乐观锁？
思考方向：从「版本号」的角度想。

2. 悲观锁和乐观锁的核心区别在哪？
从「冲突检测时机」想：是先锁还是先写。
`;

describe("parseQuizSection", () => {
  it("解析编号列表，思考方向归入答案", () => {
    const items = parseQuizSection(fullQuizMd);
    expect(items).toHaveLength(2);
    expect(items[0].question).toBe("什么是乐观锁？");
    expect(items[0].answer).toContain("版本号");
    expect(items[1].question).toBe("悲观锁和乐观锁的核心区别在哪？");
    expect(items[1].answer).toContain("冲突检测时机");
  });

  it("解析加粗 Q 标题式", () => {
    const md = `
**Q1：Raft 的选主过程是怎样的？**
从「心跳超时」开始想。

**Q2：为什么日志必须多数派提交？**
`;
    const items = parseQuizSection(md);
    expect(items).toHaveLength(2);
    expect(items[0].question).toBe("Raft 的选主过程是怎样的？");
    expect(items[0].answer).toContain("心跳超时");
    expect(items[1].question).toBe("为什么日志必须多数派提交？");
    expect(items[1].answer).toBe("");
  });

  it("解析无序列表", () => {
    const md = `- 什么是进程？\n- 线程和进程的区别？\n`;
    const items = parseQuizSection(md);
    expect(items.map((i) => i.question)).toEqual([
      "什么是进程？",
      "线程和进程的区别？",
    ]);
    expect(items[1].answer).toBe("");
  });

  it("无特征行的纯段落：整块兜底为一张卡", () => {
    const md = `请用自己的话解释一下责任链模式，并举两个实际例子。参考方向：事件处理、日志过滤。`;
    const items = parseQuizSection(md);
    expect(items).toHaveLength(1);
    expect(items[0].question).toContain("责任链模式");
  });

  it("空内容返回空数组", () => {
    expect(parseQuizSection("")).toEqual([]);
    expect(parseQuizSection("   \n  ")).toEqual([]);
  });

  it("清洗：去掉序号 / 星号 / Q1: 前缀", () => {
    const items = parseQuizSection(`**问题 3**：如何保证幂等？`);
    expect(items[0].question).toBe("如何保证幂等？");
  });

  it("多行问题合并为一句", () => {
    const md = `- 什么是\n乐观锁？\n  看版本号`;
    const items = parseQuizSection(md);
    expect(items[0].question).toContain("乐观锁");
    expect(items[0].answer).toContain("版本号");
  });
});

describe("nextCard 调度", () => {
  const base: Card = {
    key: "t::h",
    term: "t",
    question: "q?",
    answer: "a",
    dueAt: 0,
    intervalDays: 0,
    reps: 0,
    status: "new",
    createdAt: 0,
    updatedAt: 0,
  };

  it("新卡第一次记住 → 间隔 1 天", () => {
    const next = nextCard(base, true);
    expect(next.intervalDays).toBe(1);
    expect(next.reps).toBe(1);
    expect(next.status).toBe("reviewing");
  });

  it("2 天后记住 → 间隔 4 天", () => {
    const next = nextCard({ ...base, intervalDays: 2, reps: 2 }, true);
    expect(next.intervalDays).toBe(4);
    expect(next.reps).toBe(3);
  });

  it("间隔封顶 30 天", () => {
    const next = nextCard({ ...base, intervalDays: 30, reps: 6 }, true);
    expect(next.intervalDays).toBe(30);
  });

  it("忘了 → 明天再来、次数清零", () => {
    const next = nextCard({ ...base, intervalDays: 8, reps: 3 }, false);
    expect(next.intervalDays).toBe(1);
    expect(next.reps).toBe(0);
    expect(next.status).toBe("learning");
  });

  it("dueAt 按间隔推进（约 1 天后）", () => {
    const now = Date.now();
    const next = nextCard(base, true);
    const diff = next.dueAt - now;
    expect(diff).toBeGreaterThanOrEqual(24 * 3600 * 1000);
    expect(diff).toBeLessThan(25 * 3600 * 1000);
  });
});

describe("newCard / hash", () => {
  it("key 稳定：同问题同 key，不同问题不同 key", () => {
    const a = newCard("分布式锁", { question: "问？", answer: "" }, 1000);
    const b = newCard("分布式锁", { question: "问？", answer: "" }, 2000);
    const c = newCard("分布式锁", { question: "另一个？", answer: "" }, 1000);
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(a.key).toContain("分布式锁");
  });

  it("新卡立即可复习", () => {
    const c = newCard("t", { question: "q", answer: "" }, 12345);
    expect(c.dueAt).toBe(12345);
    expect(c.status).toBe("new");
  });

  it("fmtCardInfo 文案", () => {
    const c = newCard("t", { question: "q", answer: "" }, 1);
    expect(fmtCardInfo(c)).toBe("新卡");
    expect(fmtCardInfo({ ...c, reps: 3, intervalDays: 4 })).toBe(
      "已学 3 次 · 间隔 4 天"
    );
  });

  it("hashString 确定性且不碰撞于常见输入", () => {
    expect(hashString("a")).toBe(hashString("a"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});