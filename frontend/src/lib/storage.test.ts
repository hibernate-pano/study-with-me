import { describe, it, expect, beforeEach } from "vitest";
import {
  saveReport,
  getReport,
  getRecent,
  getAllReports,
  deleteReport,
  mainKey,
  drillKey,
  getCardsByTerm,
  getAllCards,
  putCard,
  deleteCard,
  syncCardsFromReport,
  purgeLegacyRepoData,
  cardReportHref,
  markTalkshowDone,
  isTalkshowDone,
  saveExamSet,
  getExamSet,
  getAllExamSets,
  deleteExamSet,
  type StoredReport,
} from "./storage";
import { newCard } from "./cards";
import type { ExamSet } from "./exams";

function makeReport(key: string, term: string, updatedAt: number): StoredReport {
  return {
    key,
    term,
    fullText: `## 🎯 一句话定义\n${term} 的定义`,
    related: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

beforeEach(async () => {
  // 清空（fake-indexeddb 内存库，测试间隔离）
  const all = await getAllReports();
  for (const r of all) await deleteReport(r.key);
  const exams = await getAllExamSets();
  for (const exam of exams) await deleteExamSet(exam.id);
  const cards = await getAllCards();
  for (const c of cards) await deleteCard(c.key);
});

describe("storage 基础读写", () => {
  it("save 后能 get 回来（roundtrip 无损）", async () => {
    await saveReport(makeReport("分布式锁", "分布式锁", 1000));
    const got = await getReport("分布式锁");
    expect(got?.term).toBe("分布式锁");
    expect(got?.fullText).toContain("分布式锁 的定义");
  });

  it("不存在的 key 返回 undefined", async () => {
    const got = await getReport("不存在");
    expect(got).toBeUndefined();
  });

  it("覆盖保存：createdAt 保留首次、updatedAt 由调用方决定", async () => {
    await saveReport(makeReport("k", "t", 1000));
    const first = (await getReport("k"))!;
    // 首次创建的两种时间初始一致
    expect(first.createdAt).toBeGreaterThan(0);
    // 覆盖保存（模拟重新生成）——updatedAt 由调用方显式传入，storage 不得覆盖成 now
    await new Promise((r) => setTimeout(r, 5));
    await saveReport(makeReport("k", "t", 5000));
    const got = (await getReport("k"))!;
    expect(got.createdAt).toBe(first.createdAt); // 首次创建时间保留
    expect(got.updatedAt).toBe(5000); // 尊重调用方传入的 updatedAt（云端拉取必须保留云端时间戳）
    expect(got.fullText).toContain("t 的定义");
  });

  it("updatedAt 缺省时才用 now（本地新建路径不受影响）", async () => {
    const before = Date.now();
    const { updatedAt: _omit, ...withoutTs } = makeReport("k2", "t2", 12345);
    await saveReport(withoutTs);
    const got = (await getReport("k2"))!;
    expect(got.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("删除后 get 不到", async () => {
    await saveReport(makeReport("k", "t", 1000));
    await deleteReport("k");
    expect(await getReport("k")).toBeUndefined();
  });
});

describe("related 归一化（修复：D1 JSON 字符串误入库导致的 .map 崩溃）", () => {
  it("旧版脏数据（related 为 JSON 字符串）读取时自动转数组", async () => {
    // 直接模拟"字符串相关数据"入库的脏数据：用底层 IndexedDB 写入字符串
    // 版本与生产对齐到当前 DB_VERSION（v4），验证 getReport 的归一化逻辑
    const req = indexedDB.open("concept-digger", 4);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const t = db.transaction("reports", "readwrite");
    await new Promise<void>((resolve, reject) => {
      t.objectStore("reports").put({
        key: "旧脏数据",
        term: "旧脏数据",
        fullText: "x",
        related: '[{"name":"A","description":"d"}]', // 字符串！
        createdAt: 1,
        updatedAt: 2,
      });
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });

    const got = await getReport("旧脏数据");
    expect(Array.isArray(got?.related)).toBe(true);
    expect(got?.related).toHaveLength(1);
    expect((got?.related as unknown as Array<{ name: string }>)[0].name).toBe("A");

    const all = await getAllReports();
    expect(Array.isArray(all[0].related)).toBe(true);
    db.close();
  });

  it("无法解析的字符串容错为空数组", async () => {
    const req = indexedDB.open("concept-digger", 4);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const t = db.transaction("reports", "readwrite");
    await new Promise<void>((resolve, reject) => {
      t.objectStore("reports").put({
        key: "坏数据",
        term: "坏数据",
        fullText: "x",
        related: "not-json{{{",
        createdAt: 1,
        updatedAt: 2,
      });
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    const got = await getReport("坏数据");
    expect(got?.related).toEqual([]);
    db.close();
  });
});

describe("getRecent 排序", () => {
  it("按 updatedAt 降序返回并尊重 limit", async () => {
    // saveReport 尊重调用方传入的 updatedAt（云端拉取要保留云端时间戳），
    // 排序直接由传入值决定，不再依赖保存先后
    await saveReport(makeReport("a", "a", 100));
    await saveReport(makeReport("b", "b", 300));
    await saveReport(makeReport("c", "c", 200));
    const recent = await getRecent(2);
    expect(recent.map((r) => r.term)).toEqual(["b", "c"]);
    // limit 生效
    const one = await getRecent(1);
    expect(one.map((r) => r.term)).toEqual(["b"]);
  });

  it("空库返回空数组", async () => {
    expect(await getRecent(5)).toEqual([]);
  });
});

describe("getAllReports", () => {
  it("返回全部（含深挖 key）", async () => {
    await saveReport(makeReport(mainKey("主题"), "主题", 100));
    await saveReport(makeReport(drillKey("主题", "展开"), "展开", 200));
    const all = await getAllReports();
    expect(all).toHaveLength(2);
  });
});

describe("key 约定", () => {
  it("mainKey 就是术语本身", () => {
    expect(mainKey("分布式锁")).toBe("分布式锁");
  });

  it("drillKey 带前缀且可区分父子", () => {
    const k = drillKey("父概念", "子概念");
    expect(k).toBe("drill:父概念::子概念");
    expect(k.startsWith("drill:")).toBe(true);
    expect(drillKey("父概念", "子概念")).toBe(k); // 稳定
  });
});

describe("purgeLegacyRepoData 清理已删功能（repo 学习）残留", () => {
  it("删 repo: 前缀的报告与卡片，保留正常数据；重复执行幂等", async () => {
    await saveReport(makeReport("repo:panbo/x", "panbo/x", 1));
    await saveReport(makeReport("repo:progress:panbo/x", "panbo/x 阅读进度", 1));
    await saveReport(makeReport("分布式锁", "分布式锁", 2));
    await putCard(newCard("repo:panbo/x", { question: "核心模块干嘛的？", answer: "a" }, 1));
    await putCard(newCard("分布式锁", { question: "什么是互斥锁？", answer: "a" }, 1));

    await purgeLegacyRepoData();

    expect((await getAllReports()).map((r) => r.key)).toEqual(["分布式锁"]);
    expect((await getAllCards()).map((c) => c.term)).toEqual(["分布式锁"]);

    await purgeLegacyRepoData(); // 幂等：再跑一次无副作用
    expect((await getAllReports()).length).toBe(1);
    expect((await getAllCards()).length).toBe(1);
  });
});

describe("syncCardsFromReport 卡源扩容", () => {
  const report = `## 🎯 一句话定义
分布式锁是**控制多个进程互斥访问共享资源**的锁。

## 🔍 深入追问
1. 为什么需要分布式锁？
思考方向：单机锁管不到跨进程。

2. Redis 怎么实现分布式锁？
思考方向：SETNX + 过期时间。`;

  it("定义卡 + 追问卡一起成卡，写入 reportKey", async () => {
    const added = await syncCardsFromReport("分布式锁", report, "drill:并发::分布式锁");
    expect(added).toBe(3);
    const cards = await getCardsByTerm("分布式锁");
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.reportKey === "drill:并发::分布式锁")).toBe(true);
    expect(cards.some((c) => c.question === "用一句话说清「分布式锁」")).toBe(true);
  });

  it("幂等：重复 sync 不新增，且不覆盖已有学习进度", async () => {
    await syncCardsFromReport("分布式锁", report);
    const first = await getCardsByTerm("分布式锁");
    const learned = { ...first[0], reps: 3, intervalDays: 8 };
    await putCard(learned);

    const again = await syncCardsFromReport("分布式锁", report);
    expect(again).toBe(0);
    const cards = await getCardsByTerm("分布式锁");
    expect(cards).toHaveLength(3);
    expect(cards.find((c) => c.key === learned.key)?.reps).toBe(3);
  });

  it("缺省 reportKey = 主报告 key（即 term）", async () => {
    await syncCardsFromReport("乐观锁", report);
    const cards = await getCardsByTerm("乐观锁");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.reportKey === "乐观锁")).toBe(true);
  });
});

describe("cardReportHref 卡片回链", () => {
  it("深挖卡 → /analyze/父?drill=子（URL 编码）", () => {
    expect(cardReportHref({ reportKey: "drill:并发编程::分布式锁", term: "分布式锁" })).toBe(
      `/analyze/${encodeURIComponent("并发编程")}?drill=${encodeURIComponent("分布式锁")}`
    );
  });

  it("主报告卡 → /analyze/reportKey", () => {
    expect(cardReportHref({ reportKey: "乐观锁", term: "乐观锁" })).toBe(
      `/analyze/${encodeURIComponent("乐观锁")}`
    );
  });

  it("旧数据无 reportKey → 回退 term 推导", () => {
    expect(cardReportHref({ term: "分布式锁" })).toBe(
      `/analyze/${encodeURIComponent("分布式锁")}`
    );
  });
});

describe("talkshow 已开讲标记", () => {
  it("默认未开讲；标记后可查；多概念互不影响", () => {
    expect(isTalkshowDone("分布式锁")).toBe(false);
    markTalkshowDone("分布式锁");
    markTalkshowDone("分布式锁"); // 幂等：重复标记不报错
    expect(isTalkshowDone("分布式锁")).toBe(true);
    expect(isTalkshowDone("CAP 定理")).toBe(false);
  });
});

describe("出题大师本地题库", () => {
  const makeExamSet = (id: string): ExamSet => ({
    id,
    title: `题库 ${id}`,
    sourceName: "课本.pdf",
    focus: "第一章",
    sourceText: "原文",
    difficulty: 2,
    questions: [
      {
        id: "q1",
        type: "single_choice",
        stem: "题目",
        options: ["A", "B"],
        answer: ["0"],
        keyPoints: [],
        explanation: "",
        knowledgePoint: "知识点",
        difficulty: 1,
      },
    ],
    papers: [],
    attempts: [],
    createdAt: 100,
    updatedAt: 100,
  });

  it("保存后可按 id 读回", async () => {
    await saveExamSet(makeExamSet("e1"));
    const got = await getExamSet("e1");
    expect(got?.title).toBe("题库 e1");
    expect(got?.questions).toHaveLength(1);
  });

  it("按更新时间倒序返回全部题库", async () => {
    await saveExamSet({ ...makeExamSet("old"), updatedAt: 100 });
    await saveExamSet({ ...makeExamSet("new"), updatedAt: 200 });
    const all = await getAllExamSets();
    expect(all.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("删除后读不到", async () => {
    await saveExamSet(makeExamSet("e1"));
    await deleteExamSet("e1");
    expect(await getExamSet("e1")).toBeUndefined();
  });
});
