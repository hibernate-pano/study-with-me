/**
 * 云同步协调：登录态、防抖推送、拉取入库、待推队列。
 *
 * 写路径：storage 写操作 → setCloudPusher 注入的钩子 → 防抖 3s 合并推送。
 * 可靠性：每次写入都把待推变更持久化到 localStorage，推送成功才清除；
 *         关闭页面/崩溃/离线都不丢，下次启动（登录态）自动补推。
 * 读路径：登录成功后 pullCloud → 全量写入 IndexedDB（本地为缓存，云端为真相）。
 */

import { fetchMe, logout as apiLogout, pullCloud, pushCloud } from "./cloud";
import type { CloudPushPayload } from "./storage";
import { cardToCloud, getAllCards, getAllReports, reportToCloud, saveReport, putCard, setCloudPusher, setCloudSuppress } from "./storage";
import type { Card } from "./cards";
import { cloudReportToLocal } from "./cloud";

/** 云端卡片 → 本地 Card（字段名对齐：due_at → dueAt 等；时间戳为 D1 毫秒 number） */
function cloudCardToLocal(c: {
  key: string;
  term: string;
  question: string;
  answer: string;
  due_at: number;
  interval_days: number;
  reps: number;
  status: string;
  created_at: number;
  updated_at: number;
}): Card {
  return {
    key: c.key,
    term: c.term,
    question: c.question,
    answer: c.answer,
    dueAt: c.due_at,
    intervalDays: c.interval_days,
    reps: c.reps,
    status: (c.status as Card["status"]) || "new",
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

/** 登录状态全局通知（简单事件总线，避免引状态库） */
type Listener = (user: { login: string; avatar_url: string | null } | null) => void;
const listeners = new Set<Listener>();

function emit(user: { login: string; avatar_url: string | null } | null) {
  for (const l of listeners) l(user);
}

// —— 登录态 ——
let currentUser: { login: string; avatar_url: string | null } | null = null;
let resolved = false; // 是否已完成初查

export function onAuthChange(l: Listener): () => void {
  listeners.add(l);
  // 已解析过就直接回放当前状态（App 启动时通常已 resolve）
  if (resolved) l(currentUser);
  return () => listeners.delete(l);
}

async function refreshMe() {
  const me = await fetchMe();
  currentUser = me ? { login: me.login, avatar_url: me.avatar_url } : null;
  resolved = true;
  emit(currentUser);
  return currentUser;
}

/** App 启动时调用一次：探测登录态 + 拉取数据（登录则入库）+ 补推遗留队列 */
export async function initCloudSync(): Promise<{ user: { login: string; avatar_url: string | null } | null }> {
  // 挂推送钩子（防抖）
  setCloudPusher(debouncedPush);

  const user = await refreshMe();
  if (user) {
    // 登录：全量拉云端 → 写本地缓存（被动同步，抑制回推）
    try {
      const dump = await pullCloud();
      setCloudSuppress(true);
      try {
        for (const r of dump.reports) {
          await saveReport(cloudReportToLocal(r));
        }
        for (const c of dump.cards) {
          await putCard(cloudCardToLocal(c));
        }
      } finally {
        setCloudSuppress(false);
      }
      // 首次登录合并上传：云端尚无数据、但本地（登录前）已有学习数据 → 并入待推队列，
      // 与遗留队列一起走 doPush（成功清除，失败回填，统一补推语义）。
      if (dump.reports.length === 0 && dump.cards.length === 0) {
        const localReports = await getAllReports();
        const localCards = await getAllCards();
        if (localReports.length > 0 || localCards.length > 0) {
          pending.reports!.push(...localReports.map(reportToCloud));
          pending.cards!.push(...localCards.map(cardToCloud));
          persistPending();
        }
      }
      // 补推：首次合并内容 + 上次会话遗留队列（关闭页面/崩溃/离线时保留下来的）
      const leftover = drainPending();
      if (!isEmptyPayload(leftover)) {
        await doPush(leftover);
      }
    } catch (e) {
      console.error("[sync] 拉取失败（本地模式继续）:", e);
    }
  }
  return { user: currentUser };
}

export function getCurrentUser() {
  return currentUser;
}

export async function logoutUser() {
  await apiLogout();
  currentUser = null;
  emit(null);
}

// —— 同步状态通知（AuthBar 展示用） ——
export type SyncStatus = { status: "ok" | "error"; lastAt: number | null; message?: string };

let syncStatus: SyncStatus = { status: "ok", lastAt: null };
type SyncListener = (s: SyncStatus) => void;
const syncListeners = new Set<SyncListener>();

export function onSyncStateChange(l: SyncListener): () => void {
  syncListeners.add(l);
  l(syncStatus);
  return () => syncListeners.delete(l);
}

function updateSyncState(status: "ok" | "error", message?: string) {
  syncStatus = { status, lastAt: status === "ok" ? Date.now() : syncStatus.lastAt, message };
  for (const l of syncListeners) l(syncStatus);
}

// —— 待推队列（内存 + localStorage 持久化） ——
const PENDING_KEY = "cd_pending_sync";
let pending: CloudPushPayload = { reports: [], cards: [], deleteReports: [], deleteCards: [] };

function loadPending(): CloudPushPayload {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const p = JSON.parse(raw) as CloudPushPayload;
      return {
        reports: Array.isArray(p.reports) ? p.reports : [],
        cards: Array.isArray(p.cards) ? p.cards : [],
        deleteReports: Array.isArray(p.deleteReports) ? p.deleteReports : [],
        deleteCards: Array.isArray(p.deleteCards) ? p.deleteCards : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { reports: [], cards: [], deleteReports: [], deleteCards: [] };
}

function persistPending() {
  try {
    if (isEmptyPayload(pending)) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    }
  } catch {
    /* 隐私模式等：内存队列仍工作 */
  }
}

function isEmptyPayload(p: CloudPushPayload): boolean {
  return (
    (p.reports?.length ?? 0) === 0 &&
    (p.cards?.length ?? 0) === 0 &&
    (p.deleteReports?.length ?? 0) === 0 &&
    (p.deleteCards?.length ?? 0) === 0
  );
}

// —— 推送 ——
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function pushNow() {
  pushTimer = null;
  if (!currentUser) return;
  const payload = drainPending();
  if (isEmptyPayload(payload)) return;
  void doPush(payload);
}

/** 取出并清空待推队列（内存 + localStorage） */
function drainPending(): CloudPushPayload {
  const out = loadPending();
  pending = { reports: [], cards: [], deleteReports: [], deleteCards: [] };
  persistPending();
  return out;
}

/** 执行推送：成功即清除；失败回填队列（下次写操作/启动补推），数据不丢 */
async function doPush(payload: CloudPushPayload) {
  try {
    await pushCloud(payload);
    updateSyncState("ok");
  } catch (e) {
    console.error("[sync] 推送失败（已保留队列待重试）:", e);
    // 回填：推送期间用户的新写入（若已在 drain 之后进来）不会被此快照覆盖
    pending.reports!.push(...(payload.reports ?? []));
    pending.cards!.push(...(payload.cards ?? []));
    pending.deleteReports!.push(...(payload.deleteReports ?? []));
    pending.deleteCards!.push(...(payload.deleteCards ?? []));
    persistPending();
    updateSyncState("error", "同步失败，数据已暂存本地");
  }
}

function debouncedPush(p: CloudPushPayload) {
  if (!currentUser) return; // 未登录不推
  pending.reports!.push(...(p.reports ?? []));
  pending.cards!.push(...(p.cards ?? []));
  pending.deleteReports!.push(...(p.deleteReports ?? []));
  pending.deleteCards!.push(...(p.deleteCards ?? []));
  persistPending(); // 每次写操作立即持久化（崩溃/关闭页面不丢）
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 3000);
}