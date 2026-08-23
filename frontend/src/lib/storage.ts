/** 报告本地持久化：IndexedDB 封装。
 * 让报告从"刷新即失"变成"你的个人知识库"。
 * - 每条记录以「语境化术语」为 key（主报告 = term；深挖 = drill:parent::term）
 * - 附带解析好的关联概念（knowledge network），供首页存档预览与侧栏"我的存档"聚合
 */

import type { FlatConcept } from "./network";

export interface StoredReport {
  key: string;
  term: string; // 展示用的概念名
  parentTerm?: string; // 深挖报告：在追问哪个主概念时产生的
  relationType?: string; // 深挖报告：从哪个关系维度进入的
  fullText: string;
  related: FlatConcept[]; // 从本报告知识网络解析出的关联概念
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "concept-digger";
const STORE = "reports";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // 失败后允许重试（如隐私模式下的 IndexedDB 异常）
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** 保存/覆盖一份报告 */
export async function saveReport(report: StoredReport): Promise<void> {
  const now = Date.now();
  const existing = await getReport(report.key);
  const record: StoredReport = {
    ...report,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  // 写操作需要完整事务，不能用上面的简写 tx；连接保持复用，不 close（单页应用常态）
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** 按 key 读取报告 */
export function getReport(key: string): Promise<StoredReport | undefined> {
  return tx("readonly", (store) => store.get(key)).then(
    (r) => r as StoredReport | undefined
  );
}

/** 最近更新的 N 份报告（含深挖） */
export async function getRecent(limit: number): Promise<StoredReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const idx = t.objectStore(STORE).index("updatedAt");
    const req = idx.openCursor(null, "prev");
    const out: StoredReport[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && out.length < limit) {
        out.push(cursor.value as StoredReport);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** 全部报告（供"我的存档/网络"聚合） */
export async function getAllReports(): Promise<StoredReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredReport[]);
    req.onerror = () => reject(req.error);
  });
}

/** 删除一份报告 */
export async function deleteReport(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** 主报告保存 key：直接是术语本身 */
export function mainKey(term: string): string {
  return term;
}

/** 深挖抽屉报告 key：记录它是在追问哪个主概念时产生的 */
export function drillKey(parentTerm: string, term: string): string {
  return `drill:${parentTerm}::${term}`;
}

export const REPORT_KEY_PREFIX = "drill:";