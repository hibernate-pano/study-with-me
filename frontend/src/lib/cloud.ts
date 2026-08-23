/**
 * 云同步客户端：登录（GitHub OAuth）、拉取、推送。
 * 与 lib/storage.ts 解耦：storage 通过 setCloudPusher 挂钩子，所有写操作自动推送。
 */

export interface CloudUser {
  id: number;
  login: string;
  avatar_url: string | null;
}

export interface CloudReport {
  key: string;
  term: string;
  parent_term: string | null;
  relation_type: string | null;
  full_text: string;
  related: unknown[];
}

export interface CloudCard {
  key: string;
  term: string;
  question: string;
  answer: string;
  due_at: number;
  interval_days: number;
  reps: number;
  status: string;
}

export interface CloudDump {
  reports: (CloudReport & { created_at: string; updated_at: string })[];
  cards: (CloudCard & { created_at: string; updated_at: string })[];
}

/** 当前登录用户（未登录 → null）。失败按未登录处理。 */
export async function fetchMe(): Promise<CloudUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = (await res.json()) as { user: CloudUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** 登出（清会话 + cookie） */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* 忽略：cookie 本地也清 */
  }
}

/** 登录入口：跳 GitHub 授权 */
export function githubAuthUrl(): string {
  return "/api/auth/github";
}

/** 全量拉取云端数据（登录态调用） */
export async function pullCloud(): Promise<CloudDump> {
  const res = await fetch("/api/sync");
  if (!res.ok) throw new Error(`云端拉取失败（${res.status}）`);
  return (await res.json()) as CloudDump;
}

/** 推送变更（upsert + 删除清单） */
export async function pushCloud(payload: {
  reports?: CloudReport[];
  cards?: CloudCard[];
  deleteReports?: string[];
  deleteCards?: string[];
}): Promise<void> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`云端推送失败（${res.status}）`);
}

/** 云端 related（JSON 字符串或数组）→ 数组 */
function normalizeCloudRelated(v: unknown): import("./network").FlatConcept[] {
  if (Array.isArray(v)) return v as import("./network").FlatConcept[];
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as import("./network").FlatConcept[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 把云端数据转换为本地 StoredReport 形态 */
export function cloudReportToLocal(r: CloudDump["reports"][number]) {
  return {
    key: r.key,
    term: r.term,
    parentTerm: r.parent_term ?? undefined,
    relationType: r.relation_type ?? undefined,
    fullText: r.full_text,
    related: normalizeCloudRelated(r.related),
    createdAt: Date.parse(r.created_at) || Date.now(),
    updatedAt: Date.parse(r.updated_at) || Date.now(),
  };
}