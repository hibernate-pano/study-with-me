/** Neon PostgreSQL 连接（serverless HTTP driver，无连接池开销）。 */

import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;

export function db() {
  if (!sql) {
    const conn = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!conn) throw new Error("DATABASE_URL 未配置（Neon 连接串）");
    sql = neon(conn);
  }
  return sql;
}

/**
 * 统一执行入口：query 字符串 + 占位参数。
 * 让业务代码不依赖 neon 的 tagged-template 调用形式（也便于测试/替换）。
 */
export async function run<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  const conn = db();
  return (await conn.query(query, params)) as T[];
}

/** 业务数据与表 schema 的强类型视图（与 lib/storage.ts 的 StoredReport/Card 对齐） */
export interface DbReport {
  key: string;
  term: string;
  parent_term: string | null;
  relation_type: string | null;
  full_text: string;
  related: unknown[];
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
     ON CONFLICT (user_id, key) DO UPDATE SET
       term = EXCLUDED.term,
       parent_term = EXCLUDED.parent_term,
       relation_type = EXCLUDED.relation_type,
       full_text = EXCLUDED.full_text,
       related = EXCLUDED.related,
       updated_at = now()`,
    userId, r.key, r.term, r.parent_term, r.relation_type, r.full_text, JSON.stringify(r.related)
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (user_id, key) DO UPDATE SET
       term = EXCLUDED.term,
       question = EXCLUDED.question,
       answer = EXCLUDED.answer,
       due_at = EXCLUDED.due_at,
       interval_days = EXCLUDED.interval_days,
       reps = EXCLUDED.reps,
       status = EXCLUDED.status,
       updated_at = now()`,
    userId, c.key, c.term, c.question, c.answer, c.due_at, c.interval_days, c.reps, c.status
  );
}

/** 删除用户的一份报告 / 一张卡 */
export async function deleteReport(userId: number, key: string): Promise<void> {
  await run(`DELETE FROM reports WHERE user_id = $1 AND key = $2`, userId, key);
}

export async function deleteCard(userId: number, key: string): Promise<void> {
  await run(`DELETE FROM cards WHERE user_id = $1 AND key = $2`, userId, key);
}

/** 全量拉取用户数据（个人规模：几十份报告，一次拉全） */
export async function fetchAll(userId: number): Promise<{ reports: DbReport[]; cards: DbCard[] }> {
  const reports = (await run(
    `SELECT key, term, parent_term, relation_type, full_text, related, created_at, updated_at
     FROM reports WHERE user_id = $1 ORDER BY updated_at DESC`,
    userId
  )) as DbReport[];
  const cards = (await run(
    `SELECT key, term, question, answer, due_at, interval_days, reps, status, created_at, updated_at
     FROM cards WHERE user_id = $1 ORDER BY updated_at DESC`,
    userId
  )) as DbCard[];
  return { reports, cards };
}