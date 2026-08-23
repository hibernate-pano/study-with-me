import { describe, it, expect, beforeEach } from "vitest";
import {
  saveReport,
  getReport,
  getRecent,
  getAllReports,
  deleteReport,
  mainKey,
  drillKey,
  type StoredReport,
} from "./storage";

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

  it("覆盖保存：createdAt 保留首次、updatedAt 更新", async () => {
    await saveReport(makeReport("k", "t", 1000));
    const first = (await getReport("k"))!;
    // 首次创建的两种时间初始一致
    expect(first.createdAt).toBeGreaterThan(0);
    // 覆盖保存（模拟重新生成）
    await new Promise((r) => setTimeout(r, 5));
    await saveReport(makeReport("k", "t", 5000));
    const got = (await getReport("k"))!;
    expect(got.createdAt).toBe(first.createdAt); // 首次创建时间保留
    expect(got.updatedAt).toBeGreaterThan(first.updatedAt); // 更新时间前进
    expect(got.fullText).toContain("t 的定义");
  });

  it("删除后 get 不到", async () => {
    await saveReport(makeReport("k", "t", 1000));
    await deleteReport("k");
    expect(await getReport("k")).toBeUndefined();
  });
});

describe("related 归一化（修复：D1 JSON 字符串误入库导致的 .map 崩溃）", () => {
  it("旧版脏数据（related 为 JSON 字符串）读取时自动转数组", async () => {
    // 直接模拟"字符串相关数据"入库的旧版本路径：用底层 IndexedDB 写入字符串
    const req = indexedDB.open("concept-digger", 2);
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
    const req = indexedDB.open("concept-digger", 2);
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
    // saveReport 用真实时间戳，按保存先后排序
    await saveReport(makeReport("a", "a", 100));
    await new Promise((r) => setTimeout(r, 5));
    await saveReport(makeReport("b", "b", 300));
    await new Promise((r) => setTimeout(r, 5));
    await saveReport(makeReport("c", "c", 200));
    const recent = await getRecent(2);
    expect(recent.map((r) => r.term)).toEqual(["c", "b"]);
    // limit 生效
    const one = await getRecent(1);
    expect(one.map((r) => r.term)).toEqual(["c"]);
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