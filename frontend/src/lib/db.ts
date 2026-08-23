/**
 * Cloudflare D1 数据访问层（HTTP API，适配 Vercel 部署）。
 * 环境变量：
 * - CLOUDFLARE_API_TOKEN（1 分钟创建：Cloudflare 控制台 → My Profile → API Tokens → Create → 选
 *   "Edit Cloudflare Workers" 模板或自建，授予该 account 的 D1 读写权限）
 * - CLOUDFLARE_ACCOUNT_ID（Cloudflare dashboard 首页右侧可查）
 * - D1_DATABASE_ID（已由自动化创建：1fcb81c5-1f52-493f-8979-5fde475456d7）
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

interface D1Response {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result?: Array<{ results: Record<string, unknown>[]; meta?: { changes?: number; last_row_id?: number } }>;
}

function d1Config() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.D1_DATABASE_ID;
  if (!token || !account || !dbId) {
    throw new Error("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID 未配置");
  }
  return { token, account, dbId };
}

/**
 * 统一执行入口：query 字符串 + 占位参数（?1 ?2 …）。
 * 返回行数组；非查询语句返回 []。
 */
export async function run<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  const { token, account, dbId } = d1Config();
  const res = await fetch(`${API_BASE}/accounts/${account}/d1/database/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql: query, params }),
  });
  if (!res.ok) {
    throw new Error(`D1 请求失败（${res.status}）`);
  }
  const data = (await res.json()) as D1Response;
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join("; ");
    throw new Error(`D1 查询失败: ${msg ?? "unknown"}`);
  }
  return (data.result?.[0]?.results as T[]) ?? [];
}

export interface DbReport {
  key: string;
  term: string;
  parent_term: string | null;
  relation_type: string | null;
  full_text: string;
  related: string; // D1 存 JSON 字符串
  created_at: number;
  updated_at: number;
}

export interface DbCard {
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
}

/** 一次性 upsert 整份报告（配 primary key ON CONFLICT） */
export async function upsertReport(userId: number, r: {
  key: string;
  term: string;
  parent_term: string | null;
  relation_type: string | null;
  full_text: string;
  related: unknown[];
}): Promise<void> {
  await run(
    `INSERT INTO reports (user_id, key, term, parent_term, relation_type, full_text, related, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (user_id, key) DO UPDATE SET
       term = excluded.term,
       parent_term = excluded.parent_term,
       relation_type = excluded.relation_type,
       full_text = excluded.full_text,
       related = excluded.related,
       updated_at = excluded.updated_at`,
    userId, r.key, r.term, r.parent_term, r.relation_type, r.full_text,
    JSON.stringify(r.related), Date.now()
  );
}

/** 一次性 upsert 一张复习卡 */
export async function upsertCard(userId: number, c: {
  key: string;
  term: string;
  question: string;
  answer: string;
  due_at: number;
  interval_days: number;
  reps: number;
  status: string;
}): Promise<void> {
  await run(
    `INSERT INTO cards (user_id, key, term, question, answer, due_at, interval_days, reps, status, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (user_id, key) DO UPDATE SET
       term = excluded.term,
       question = excluded.question,
       answer = excluded.answer,
       due_at = excluded.due_at,
       interval_days = excluded.interval_days,
       reps = excluded.reps,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    userId, c.key, c.term, c.question, c.answer, c.due_at, c.interval_days, c.reps, c.status, Date.now()
  );
}

/** 删除用户的一份报告 / 一张卡 */
export async function deleteReport(userId: number, key: string): Promise<void> {
  await run(`DELETE FROM reports WHERE user_id = ?1 AND key = ?2`, userId, key);
}

export async function deleteCard(userId: number, key: string): Promise<void> {
  await run(`DELETE FROM cards WHERE user_id = ?1 AND key = ?2`, userId, key);
}

/** 全量拉取用户数据（个人规模：几十份报告，一次拉全） */
export async function fetchAll(userId: number): Promise<{ reports: DbReport[]; cards: DbCard[] }> {
  const reports = await run<DbReport>(
    `SELECT key, term, parent_term, relation_type, full_text, related, created_at, updated_at
     FROM reports WHERE user_id = ?1 ORDER BY updated_at DESC`,
    userId
  );
  const cards = await run<DbCard>(
    `SELECT key, term, question, answer, due_at, interval_days, reps, status, created_at, updated_at
     FROM cards WHERE user_id = ?1 ORDER BY updated_at DESC`,
    userId
  );
  return { reports, cards };
}