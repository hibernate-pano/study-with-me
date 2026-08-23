import { NextRequest, NextResponse } from "next/server";
import { getUserBySession } from "@/lib/auth";
import {
  deleteCard,
  deleteReport,
  fetchAll,
  run,
  upsertCard,
  upsertReport,
} from "@/lib/db";
import { readSessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 30;

/** 需要登录的请求统一守卫：未登录 → 401 */
async function requireUser(req: NextRequest) {
  const user = await getUserBySession(
    (q, ...p) => run(q, ...p),
    readSessionToken(req)
  );
  return user;
}

/**
 * GET /api/sync — 全量拉取当前用户的报告 + 复习卡。
 * 个人规模（几十份报告），一次拉全；客户端负责写入 IndexedDB 缓存。
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req).catch((e) => {
    console.error("[sync/get]", e);
    return null;
  });
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const data = await fetchAll(user.id);
  return NextResponse.json(data);
}

interface SyncBody {
  reports?: Array<{
    key: string;
    term: string;
    parent_term?: string | null;
    relation_type?: string | null;
    full_text: string;
    related?: unknown[];
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

/**
 * POST /api/sync — 客户端把本地变更推上来（upsert + 删除清单）。
 * 幂等：同一 key 重复提交按 updated_at = now() 覆盖，安全。
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req).catch((e) => {
    console.error("[sync/post]", e);
    return null;
  });
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: SyncBody = {};
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const failures: string[] = [];
  const run = async <T>(name: string, fn: () => Promise<T>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      console.error(`[sync] ${name} failed:`, e);
      failures.push(name);
    }
  };

  for (const r of body.reports ?? []) {
    await run(`report:${r.key}`, () =>
      upsertReport(user.id, {
        key: r.key,
        term: r.term,
        parent_term: r.parent_term ?? null,
        relation_type: r.relation_type ?? null,
        full_text: r.full_text,
        related: r.related ?? [],
      })
    );
  }
  for (const c of body.cards ?? []) {
    await run(`card:${c.key}`, () =>
      upsertCard(user.id, {
        key: c.key,
        term: c.term,
        question: c.question,
        answer: c.answer,
        due_at: c.due_at,
        interval_days: c.interval_days,
        reps: c.reps,
        status: c.status,
      })
    );
  }
  for (const k of body.deleteReports ?? []) {
    await run(`del-report:${k}`, () => deleteReport(user.id, k));
  }
  for (const k of body.deleteCards ?? []) {
    await run(`del-card:${k}`, () => deleteCard(user.id, k));
  }

  return NextResponse.json({
    ok: failures.length === 0,
    failures,
    pushed: {
      reports: body.reports?.length ?? 0,
      cards: body.cards?.length ?? 0,
    },
  });
}