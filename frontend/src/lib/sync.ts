/**
 * 云同步协调：登录态、防抖推送、拉取入库。
 *
 * 写路径：storage 写操作 → setCloudPusher 注入的钩子 → 防抖 3s 合并推送。
 * 读路径：登录成功后 pullCloud → 全量写入 IndexedDB（本地为缓存，云端为真相）。
 */

import { fetchMe, logout as apiLogout, pullCloud, pushCloud } from "./cloud";
import type { CloudPushPayload } from "./storage";
import { cardToCloud, getAllCards, getAllReports, reportToCloud, saveReport, putCard, setCloudPusher, setCloudSuppress } from "./storage";
import type { Card } from "./cards";
import { cloudReportToLocal } from "./cloud";

/** 云端卡片 → 本地 Card（字段名对齐：due_at → dueAt 等） */
function cloudCardToLocal(c: {
  key: string;
  term: string;
  question: string;
  answer: string;
  due_at: number;
  interval_days: number;
  reps: number;
  status: string;
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
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

/** App 启动时调用一次：探测登录态 + 拉取数据（登录则入库） */
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
      // 首次登录合并上传：云端尚无数据、但本地（登录前）已有学习数据 → 全量推一次。
      // 之后云端不再为空，此分支不会重复触发；增量由防抖推送承担。
      if (dump.reports.length === 0 && dump.cards.length === 0) {
        const localReports = await getAllReports();
        const localCards = await getAllCards();
        if (localReports.length > 0 || localCards.length > 0) {
          await pushCloud({
            reports: localReports.map(reportToCloud),
            cards: localCards.map(cardToCloud),
          }).catch((e) => console.error("[sync] 首次合并上传失败:", e));
        }
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

// —— 防抖推送 ——
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const pending: CloudPushPayload = { reports: [], cards: [], deleteReports: [], deleteCards: [] };

function pushNow() {
  pushTimer = null;
  const payload: CloudPushPayload = {
    reports: pending.reports ?? [],
    cards: pending.cards ?? [],
    deleteReports: pending.deleteReports ?? [],
    deleteCards: pending.deleteCards ?? [],
  };
  pending.reports = [];
  pending.cards = [];
  pending.deleteReports = [];
  pending.deleteCards = [];
  if (!currentUser) return;
  if (
    payload.reports!.length === 0 &&
    payload.cards!.length === 0 &&
    payload.deleteReports!.length === 0 &&
    payload.deleteCards!.length === 0
  ) {
    return;
  }
  pushCloud(payload).catch((e) => console.error("[sync] 推送失败:", e));
}

function debouncedPush(p: CloudPushPayload) {
  if (!currentUser) return; // 未登录不推
  pending.reports!.push(...(p.reports ?? []));
  pending.cards!.push(...(p.cards ?? []));
  pending.deleteReports!.push(...(p.deleteReports ?? []));
  pending.deleteCards!.push(...(p.deleteCards ?? []));
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 3000);
}