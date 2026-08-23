/** 报告本地持久化：IndexedDB 封装。
 * 让报告从"刷新即失"变成"你的个人知识库"。
 * - reports store：每条记录以「语境化术语」为 key（主报告 = term；深挖 = drill:parent::term）
 * - cards store：从报告「🔍 深入追问」自动生成的复习卡片（间隔重复）
 */

import type { FlatConcept } from "./network";
import { parseQuizSection, newCard, type Card } from "./cards";
import { extractSectionRaw } from "./stream";

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
const REPORTS_STORE = "reports";
const CARDS_STORE = "cards";
const DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains(REPORTS_STORE)) {
        const store = db.createObjectStore(REPORTS_STORE, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(CARDS_STORE)) {
        const cards = db.createObjectStore(CARDS_STORE, { keyPath: "key" });
        cards.createIndex("dueAt", "dueAt");
        cards.createIndex("term", "term");
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

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---------------- cloud bridge ----------------

export interface CloudPushPayload {
  reports?: Array<{
    key: string;
    term: string;
    parent_term: string | null;
    relation_type: string | null;
    full_text: string;
    related: unknown[];
  }>;
  cards?: Array<{
    key: string;
    term: string;
    question: string;
    answer: string;
    due_at: number;
    interval_days: number;
    reps: number;
    status: string;
  }>;
  deleteReports?: string[];
  deleteCards?: string[];
}

/** 本地报告 → 云端格式 */
export function reportToCloud(r: StoredReport): NonNullable<CloudPushPayload["reports"]>[number] {
  return {
    key: r.key,
    term: r.term,
    parent_term: r.parentTerm ?? null,
    relation_type: r.relationType ?? null,
    full_text: r.fullText,
    related: r.related,
  };
}

/** 本地卡片 → 云端格式 */
export function cardToCloud(c: Card): NonNullable<CloudPushPayload["cards"]>[number] {
  return {
    key: c.key,
    term: c.term,
    question: c.question,
    answer: c.answer,
    due_at: c.dueAt,
    interval_days: c.intervalDays,
    reps: c.reps,
    status: c.status,
  };
}

/** 云推送钩子：app 启动时由 sync 模块注入；所有本地写操作完成后回调（防抖推送由注入方负责）。 */
let cloudPusher: ((payload: CloudPushPayload) => void) | null = null;

export function setCloudPusher(fn: ((payload: CloudPushPayload) => void) | null): void {
  cloudPusher = fn;
}

/** 拉取入库等"本地是被动同步"场景，临时抑制推送，避免回环 */
let suppressNotify = false;
export function setCloudSuppress(v: boolean): void {
  suppressNotify = v;
}

/** 本地写操作后调用：把变更交给云推送钩子（未登录/未设置/被动同步时为空操作）。 */
function notifyCloud(payload: CloudPushPayload): void {
  if (suppressNotify) return;
  if (cloudPusher) cloudPusher(payload);
}

// ---------------- reports ----------------

/** 保存/覆盖一份报告（写入本地 + 触发云推送） */
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
    const t = db.transaction(REPORTS_STORE, "readwrite");
    t.objectStore(REPORTS_STORE).put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyCloud({ reports: [reportToCloud(record)] });
}

/** 按 key 读取报告 */
export function getReport(key: string): Promise<StoredReport | undefined> {
  return tx(REPORTS_STORE, "readonly", (store) => store.get(key)).then(
    (r) => r as StoredReport | undefined
  );
}

/** 最近更新的 N 份报告（含深挖） */
export async function getRecent(limit: number): Promise<StoredReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(REPORTS_STORE, "readonly");
    const idx = t.objectStore(REPORTS_STORE).index("updatedAt");
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
  return tx(REPORTS_STORE, "readonly", (store) => store.getAll()).then(
    (r) => r as StoredReport[]
  );
}

/** 删除一份报告（本地 + 云） */
export async function deleteReport(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(REPORTS_STORE, "readwrite");
    t.objectStore(REPORTS_STORE).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyCloud({ deleteReports: [key] });
}

/** 主报告保存 key：直接是术语本身 */
export function mainKey(term: string): string {
  return term;
}

/** 深挖抽屉报告 key：记录它是在追问哪个主概念时产生的 */
export function drillKey(parentTerm: string, term: string): string {
  return `drill:${parentTerm}::${term}`;
}

// ---------------- cards ----------------

export function getCard(key: string): Promise<Card | undefined> {
  return tx(CARDS_STORE, "readonly", (store) => store.get(key)).then(
    (r) => r as Card | undefined
  );
}

export async function putCard(card: Card): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(CARDS_STORE, "readwrite");
    t.objectStore(CARDS_STORE).put(card);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyCloud({ cards: [cardToCloud(card)] });
}

export async function deleteCard(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(CARDS_STORE, "readwrite");
    t.objectStore(CARDS_STORE).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyCloud({ deleteCards: [key] });
}

/** 全部卡片 */
export async function getAllCards(): Promise<Card[]> {
  return tx(CARDS_STORE, "readonly", (store) => store.getAll()).then(
    (r) => r as Card[]
  );
}

/** 当前到期的卡片（dueAt <= now），按到期先后排序。新卡 dueAt=now 立即可复习。 */
export async function getDueCards(now = Date.now()): Promise<Card[]> {
  const all = await getAllCards();
  return all
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

/** 某概念名下的卡片（用于分析页展示"该概念有几张卡"） */
export async function getCardsByTerm(term: string): Promise<Card[]> {
  const all = await getAllCards();
  return all.filter((c) => c.term === term);
}

/**
 * 报告生成/加载后调用：把「🔍 深入追问」解析成复习卡。
 * 已有同 key 的卡保留学习进度（不覆盖）；只新增从未见过的题。
 * 返回本次新增数量。
 */
export async function syncCardsFromReport(
  term: string,
  fullText: string
): Promise<number> {
  const raw = extractSectionRaw(fullText, "追问");
  if (!raw.trim()) return 0;
  const quiz = parseQuizSection(raw);
  if (quiz.length === 0) return 0;
  const now = Date.now();
  let added = 0;
  for (const q of quiz) {
    const card = newCard(term, q, now);
    const existing = await getCard(card.key);
    if (!existing) {
      await putCard(card);
      added++;
    }
  }
  return added;
}

/** 删除某概念的全部卡片（"不再复习这个概念"） */
export async function deleteTermCards(term: string): Promise<void> {
  const cards = await getCardsByTerm(term);
  for (const c of cards) await deleteCard(c.key);
}

/** 清空全部本地数据（reports + cards；用于测试重置，也可供"退出登录清空"类功能使用） */
export async function clearAllLocalData(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([REPORTS_STORE, CARDS_STORE], "readwrite");
    t.objectStore(REPORTS_STORE).clear();
    t.objectStore(CARDS_STORE).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}