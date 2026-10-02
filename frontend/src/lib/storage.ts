/** 报告本地持久化：IndexedDB 封装。
 * 让报告从"刷新即失"变成"你的个人知识库"。
 * - reports store：每条记录以「语境化术语」为 key（主报告 = term；深挖 = drill:parent::term）
 * - cards store：从报告「🔍 深入追问」自动生成的复习卡片（间隔重复）
 */

import type { FlatConcept } from "./network";
import { parseQuizSection, newCard, buildDefinitionQuiz, type Card } from "./cards";
import { extractSectionRaw } from "./stream";
import type { ExamSet } from "./exams";

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
const EXAM_SETS_STORE = "exam_sets"; // 出题大师：题库 + 试卷 + 作答记录
const DB_VERSION = 4;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(e);
    };
    // 5s 兜底：正常路径（连接关闭）会立即 resolve，挂死说明连接泄漏/浏览器异常，
    // 给出可读错误，配合下面的重置逻辑允许重试。
    timer = setTimeout(
      () => fail(new Error("IndexedDB 打开超时，请关闭其他页面后刷新")),
      5000
    );
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // onblocked：升级被其他标签页的旧连接挡住。连接一旦关闭挂起的 open 会立刻 resolve，
    // 所以不处理只是「无提示地卡住」；显式 reject 让调用方能报错并重试。
    req.onblocked = () =>
      fail(new Error("IndexedDB 升级被其他标签页阻塞，请关闭其他页面后刷新"));
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
      if (!db.objectStoreNames.contains(EXAM_SETS_STORE)) {
        const exams = db.createObjectStore(EXAM_SETS_STORE, { keyPath: "id" });
        exams.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 其他标签页要升版本时主动让路，否则它们会一直停在 onblocked
      db.onversionchange = () => db.close();
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(db);
    };
    req.onerror = () => fail(req.error ?? new Error("indexedDB open failed"));
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

/**
 * related 字段清洗：早期同步版本把 D1 的 JSON 字符串原样存入 IndexedDB，
 * 导致首页 `r.related.slice().map()` 崩溃（字符串无 .map）。统一在此归一化，
 * 所有读取路径（首页/地图/存档/分析页）拿到的一定是数组。
 */
function normalizeRelated(v: unknown): FlatConcept[] {
  if (Array.isArray(v)) return v as FlatConcept[];
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as FlatConcept[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStoredReport(r?: StoredReport): StoredReport | undefined {
  if (!r) return r;
  return { ...r, related: normalizeRelated(r.related) };
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
    report_key: string | null;
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
    report_key: c.reportKey ?? null,
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

/** saveReport 入参：updatedAt 可省略（省略时由 storage 补 Date.now()） */
export type SaveReportInput = Omit<StoredReport, "updatedAt"> & { updatedAt?: number };

/** 保存/覆盖一份报告（写入本地 + 触发云推送）
 *
 *  updatedAt 语义：调用方显式传入时**尊重它**，只有缺省才用 now。
 *  云端拉取必须把 updated_at 原样带下来——曾经这里无条件 `updatedAt: now`，
 *  于是每次整页加载都会把「本地比云端新」的副本退回旧版、时间戳还刷成 now，
 *  用户看到的是「刚刚更新 + 旧内容」。
 */
export async function saveReport(report: SaveReportInput): Promise<void> {
  const now = Date.now();
  const existing = await getReport(report.key);
  const record: StoredReport = {
    ...report,
    createdAt: existing?.createdAt ?? now,
    updatedAt: report.updatedAt ?? now,
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

/** 按 key 读取报告（related 自动归一化） */
export function getReport(key: string): Promise<StoredReport | undefined> {
  return tx(REPORTS_STORE, "readonly", (store) => store.get(key)).then(
    normalizeStoredReport
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
        out.push(normalizeStoredReport(cursor.value as StoredReport)!);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** 全部报告（供"我的存档/网络"聚合；related 自动归一化） */
export async function getAllReports(): Promise<StoredReport[]> {
  return tx(REPORTS_STORE, "readonly", (store) => store.getAll()).then(
    (rs) => (rs as StoredReport[]).map(normalizeStoredReport) as StoredReport[]
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

/**
 * 复习卡 → 报告页跳转地址。
 * 有 reportKey 精确回源（深挖卡带 ?drill= 直达深挖报告）；
 * 旧数据无此字段，回退 term 推导（等价于旧版行为）。
 */
export function cardReportHref(card: Pick<Card, "reportKey" | "term">): string {
  const k = card.reportKey ?? mainKey(card.term);
  if (k.startsWith("drill:")) {
    const [parent, child] = k.slice("drill:".length).split("::");
    return `/analyze/${encodeURIComponent(parent ?? "")}?drill=${encodeURIComponent(child ?? "")}`;
  }
  return `/analyze/${encodeURIComponent(k)}`;
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
 * 报告生成/加载后调用：把「🎯 一句话定义」与「🔍 深入追问」解析成复习卡。
 * 已有同 key 的卡保留学习进度（不覆盖）；只新增从未见过的题。
 * reportKey 写进卡片供复习页回链（缺省为主报告 key）。
 * 返回本次新增数量。
 */
export async function syncCardsFromReport(
  term: string,
  fullText: string,
  reportKey: string = mainKey(term)
): Promise<number> {
  const def = buildDefinitionQuiz(term, fullText);
  const quiz = parseQuizSection(extractSectionRaw(fullText, "追问"));
  const items = def ? [def, ...quiz] : quiz;
  if (items.length === 0) return 0;
  const now = Date.now();
  let added = 0;
  for (const q of items) {
    const card = newCard(term, q, now, reportKey);
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

/**
 * 一次性清理已删功能（GitHub repo 学习，2026-10-02 下线）的本地残留。
 * 走 deleteReport/deleteCard（联动云删除事件），云端同类残留随之被推删；
 * 幂等，可放心重复调用。
 */
export async function purgeLegacyRepoData(): Promise<void> {
  const reports = await getAllReports();
  for (const r of reports) {
    if (r.key.startsWith("repo:")) await deleteReport(r.key);
  }
  const cards = await getAllCards();
  for (const c of cards) {
    if (c.term.startsWith("repo:")) await deleteCard(c.key);
  }
}

/** 清空全部本地数据（用于测试重置；供未来"清空本机数据"功能复用）。 */
export async function clearAllLocalData(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(
      [REPORTS_STORE, CARDS_STORE, EXAM_SETS_STORE],
      "readwrite"
    );
    for (const store of [
      REPORTS_STORE,
      CARDS_STORE,
      EXAM_SETS_STORE,
    ]) {
      t.objectStore(store).clear();
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------------- 出题大师 ----------------

/** 保存整套题库、试卷和作答记录。 */
export async function saveExamSet(exam: ExamSet): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(EXAM_SETS_STORE, "readwrite");
    t.objectStore(EXAM_SETS_STORE).put(exam);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function getExamSet(id: string): Promise<ExamSet | undefined> {
  return tx(EXAM_SETS_STORE, "readonly", (store) => store.get(id)).then(
    (value) => value as ExamSet | undefined
  );
}

export async function getAllExamSets(): Promise<ExamSet[]> {
  const all = (await tx(
    EXAM_SETS_STORE,
    "readonly",
    (store) => store.getAll()
  )) as ExamSet[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteExamSet(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(EXAM_SETS_STORE, "readwrite");
    t.objectStore(EXAM_SETS_STORE).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------------- talkshow 已开讲标记 ----------------

const TALKSHOW_DONE_KEY = "cd-talkshow-done";

/** 标记某概念已去 Topic Talkshow 开讲（点击「开讲挑战」时写入；轻量 flag，localStorage 即可） */
export function markTalkshowDone(term: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(TALKSHOW_DONE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(term)) list.push(term);
    localStorage.setItem(TALKSHOW_DONE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** 该概念是否已开讲过；无记录/坏数据 → false */
export function isTalkshowDone(term: string): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(TALKSHOW_DONE_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(term) : false;
  } catch {
    return false;
  }
}
