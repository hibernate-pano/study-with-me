/**
 * 云同步协调：登录态、防抖推送、拉取入库、待推队列。
 *
 * 写路径：storage 写操作 → setCloudPusher 注入的钩子 → 防抖 3s 合并推送。
 * 可靠性：每次写入都把待推变更持久化到 localStorage，推送成功才清除；
 *         关闭页面/崩溃/离线都不丢，下次启动（登录态）自动补推。
 * 读路径：登录成功后 pullCloud → 全量写入 IndexedDB（本地为缓存，云端为真相）。
 *
 * 三条不能退让的同步语义（详见各处注释）：
 *   1. 拉取只写「比本地新」的记录——mainKey(term)=term 必然撞 key，无条件写会静默回滚本地新版。
 *   2. 待推队列在**入队时**按 key 归并——纯 append 会让过期的 upsert/delete 挤在同一 payload 里打架。
 *   3. 队列与本机数据都记归属账号——IndexedDB 同源单库，换 GitHub 账号会混数据。
 */

import { fetchMe, logout as apiLogout, pullCloud, pushCloud } from "./cloud";
import type { CloudPushPayload } from "./storage";
import { cardToCloud, getAllCards, getAllReports, getCard, getReport, reportToCloud, saveReport, putCard, setCloudPusher, setCloudSuppress } from "./storage";
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
        // 只写「云端比本地新」的记录：mainKey(term)=term，深挖 key 也唯一，
        // 每次整页加载（AuthBar 挂在 RootLayout，useEffect 依赖 []）都会全量撞同一批 key。
        // 曾经无条件 saveReport，旧云端会把本地新版退回旧版、时间戳还被刷成 now。
        for (const r of dump.reports) {
          const local = await getReport(r.key);
          if (local && local.updatedAt > r.updated_at) continue;
          await saveReport(cloudReportToLocal(r));
        }
        for (const c of dump.cards) {
          const local = await getCard(c.key);
          if (local && local.updatedAt > c.updated_at) continue;
          await putCard(cloudCardToLocal(c));
        }
      } finally {
        setCloudSuppress(false);
      }
      // 首次登录合并上传：云端尚无数据、但本地（登录前）已有学习数据 → 并入待推队列，
      // 与遗留队列一起走 doPush（成功清除，失败回填，统一补推语义）。
      if (dump.reports.length === 0 && dump.cards.length === 0) {
        const owner = getDataOwner();
        if (owner && owner !== user.login) {
          // 本机 IndexedDB 里躺的是上一个 GitHub 账号的数据（IndexedDB 同源单库，两账号共用），
          // 传上去等于把对方的数据写进当前账号的 D1 空间 → 跳过合并并提示。
          // 注意：不 clearAllLocalData()——README 承诺 local-first，未同步的数据必须留在本机。
          updateSyncState("error", `本机数据属于 ${owner}，已跳过上传以免混入当前账号`);
        } else {
          setDataOwner(user.login);
          const localReports = await getAllReports();
          const localCards = await getAllCards();
          if (localReports.length > 0 || localCards.length > 0) {
            enqueue({
              reports: localReports.map(reportToCloud),
              cards: localCards.map(cardToCloud),
            });
            persistPending();
          }
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

/** 登出。
 *
 * 刻意**不清本地数据**：IndexedDB 是同源单库，但清掉就等于摧毁 README 承诺的
 * local-first 语义——会话过期后重新登录的用户会丢掉全部未同步数据。
 * 「换账号不混数据」改由两道闸守住：队列按写入时账号过滤（drainPending）、
 * 首次合并上传前校验本机数据归属（initCloudSync）。
 */
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
/** 本机 IndexedDB 数据的归属账号（IndexedDB 同源单库，两账号共用，换号必须能分辨） */
const OWNER_KEY = "cd_sync_owner";

type ReportOp = NonNullable<CloudPushPayload["reports"]>[number];
type CardOp = NonNullable<CloudPushPayload["cards"]>[number];

/** localStorage 里的队列：payload + 写入时的账号归属 */
interface StoredPending extends CloudPushPayload {
  user?: string;
}

let pending: CloudPushPayload = emptyPayload();
/** 内存队列的归属账号；null = 尚未归属（旧版遗留队列，兼容按当前登录者处理） */
let pendingOwner: string | null = null;

/** 本机数据的归属账号（谁的数据躺在 IndexedDB 里） */
function getDataOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setDataOwner(login: string): void {
  try {
    localStorage.setItem(OWNER_KEY, login);
  } catch {
    /* 隐私模式等：只影响「换账号不混数据」这道闸 */
  }
}

function emptyPayload(): CloudPushPayload {
  return { reports: [], cards: [], deleteReports: [], deleteCards: [] };
}

function loadPending(): StoredPending {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const p = JSON.parse(raw) as StoredPending;
      return {
        reports: Array.isArray(p.reports) ? p.reports : [],
        cards: Array.isArray(p.cards) ? p.cards : [],
        deleteReports: Array.isArray(p.deleteReports) ? p.deleteReports : [],
        deleteCards: Array.isArray(p.deleteCards) ? p.deleteCards : [],
        user: typeof p.user === "string" ? p.user : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return emptyPayload();
}

/**
 * 只把内存队列整份写进 localStorage（不做读-改-写）：
 * 归并发生在入队时（enqueue），这里读-改-写会把刚 drain 出来的内容原样写回去，
 * 队列永远排不空、每次启动重推全部历史。
 * 跨标签页的互相抹条目由 drainPending 读「内存 ∪ localStorage」兜住：
 * 本 tab 内存里的那份始终在，别人覆盖 localStorage 也抹不掉。
 */
function persistPending() {
  try {
    if (isEmptyPayload(pending)) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      const stored: StoredPending = { ...pending, user: pendingOwner ?? undefined };
      localStorage.setItem(PENDING_KEY, JSON.stringify(stored));
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

/**
 * 按 key 归并两个待推 payload：同 key 后到的操作覆盖先到的，
 * 且同一个 key 绝不会同时出现在 upsert 与 delete 列表里
 * （纯 append 时「先写后删」和「先删后写」混在一个 payload，服务端又是先 upsert 后 delete，
 *  过期的 delete 反而获胜 → 已重写的记录在云端被删掉且不自愈）。
 * Map 的 value 为 null 表示「待删」。
 */
function mergePayloads(base: CloudPushPayload, incoming: CloudPushPayload): CloudPushPayload {
  const reports = new Map<string, ReportOp | null>();
  const cards = new Map<string, CardOp | null>();
  // 顺序 = 「先到的先落 map，后到的覆盖」，所以 incoming 永远赢（后到者赢）
  for (const r of base.reports ?? []) reports.set(r.key, r);
  for (const k of base.deleteReports ?? []) reports.set(k, null);
  for (const r of incoming.reports ?? []) reports.set(r.key, r);
  for (const k of incoming.deleteReports ?? []) reports.set(k, null);
  for (const c of base.cards ?? []) cards.set(c.key, c);
  for (const k of base.deleteCards ?? []) cards.set(k, null);
  for (const c of incoming.cards ?? []) cards.set(c.key, c);
  for (const k of incoming.deleteCards ?? []) cards.set(k, null);

  const out = emptyPayload();
  for (const [k, v] of reports) {
    if (v) out.reports!.push(v);
    else out.deleteReports!.push(k);
  }
  for (const [k, v] of cards) {
    if (v) out.cards!.push(v);
    else out.deleteCards!.push(k);
  }
  return out;
}

/** 入队：所有往队列里加东西的路径都走这里（写入钩子 + 推送失败回填） */
function enqueue(incoming: CloudPushPayload): void {
  if (!isEmptyPayload(incoming) && !pendingOwner) {
    pendingOwner = currentUser?.login ?? null;
  }
  pending = mergePayloads(pending, incoming);
}

/** 队列归属账号是否可推给当前登录者：无标记（旧队列）按当前登录者处理 */
function ownedByCurrentUser(owner?: string | null): boolean {
  if (!owner || !currentUser) return true;
  return owner === currentUser.login;
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

/** 取出并清空待推队列（内存 ∪ localStorage） */
function drainPending(): CloudPushPayload {
  const stored = loadPending();
  // 跨标签页：读「内存 ∪ localStorage」。persistPending 是本 tab 内存的整份快照，
  // 别的标签页一写就互相抹条目；只读 localStorage 会让本 tab 在 drain 之后写进内存的
  // 条目滞留到下次启动。内存那份是权威的快照，localStorage 补上只有它知道的条目。
  // 换账号：只推归属当前用户的条目，其余丢弃——不往别人的云端空间写数据。
  const mine = ownedByCurrentUser(pendingOwner) ? pending : emptyPayload();
  const theirs = ownedByCurrentUser(stored.user) ? stored : emptyPayload();
  const out = mergePayloads(mine, theirs);
  clearPending();
  return out;
}

/** 清空队列（内存 + localStorage）。独立于带归并逻辑的 persistPending：
 *  复用它会把刚 drain 出来的内容原样写回去，队列永远排不空。 */
function clearPending(): void {
  pending = emptyPayload();
  pendingOwner = null;
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* 隐私模式等 */
  }
}

/** 执行推送：成功即清除；失败回填队列（下次写操作/启动补推），数据不丢 */
async function doPush(payload: CloudPushPayload) {
  try {
    await pushCloud(payload);
    updateSyncState("ok");
  } catch (e) {
    console.error("[sync] 推送失败（已保留队列待重试）:", e);
    // 回填：走 enqueue 走归并——推送期间用户的新写入（若已在 drain 之后进来）
    // 不会被此快照覆盖，同 key 也是「后到者赢」而不是追加重复条目。
    enqueue(payload);
    persistPending();
    updateSyncState("error", "同步失败，数据已暂存本地");
  }
}

function debouncedPush(p: CloudPushPayload) {
  if (!currentUser) return; // 未登录不推
  enqueue(p);
  persistPending(); // 每次写操作立即持久化（崩溃/关闭页面不丢）
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 3000);
}