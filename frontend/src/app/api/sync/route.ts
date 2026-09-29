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
import { originAllowed } from "@/lib/origin";

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

type ReportOp = NonNullable<SyncBody["reports"]>[number];
type CardOp = NonNullable<SyncBody["cards"]>[number];

/**
 * 单次推送的规模上限 —— 纵深防御的第二层，和 CSRF 是否成立无关。
 * 第一层（originAllowed）挡「不是本站的 JS 发的请求」，这一层挡「来源合法但 payload 巨大」：
 * 一个 4 万条的 payload 能把 D1 写满、把 worker 内存吃光。
 *
 * 数值刻意远高于正常使用量：单条深挖报告正文通常几 KB、复习卡几百字节；
 * 正常路径只有「防抖 3s 合并本轮变更」会推一次，条数是个位数。
 * 200 条 × 200KB 已经超过 4.5MB 的请求体硬上限，所以这层是提前拒绝、不是主要防线。
 */
const MAX_BATCH = 200;
const MAX_TEXT_BYTES = 200 * 1024;

const TOO_LARGE_LABEL = {
  reports: "报告",
  cards: "复习卡",
  deleteReports: "报告删除清单",
  deleteCards: "复习卡删除清单",
} as const;

/** 非数组当空数组：老客户端 / 被改坏的 payload 不该把路由打成 500 */
function asList<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function tooLarge(message: string) {
  return NextResponse.json({ error: message }, { status: 413 });
}

/** 字符串按 UTF-8 字节算：中文一个字 3 字节，用 length 会低估三倍 */
function textTooLarge(v: unknown): boolean {
  return typeof v === "string" && Buffer.byteLength(v, "utf8") > MAX_TEXT_BYTES;
}

type Normalized = {
  reports: ReportOp[];
  cards: CardOp[];
  deleteReports: string[];
  deleteCards: string[];
};

/** 归一 + 规模校验。返回 413 Response 表示 payload 超限，应当原样回给客户端。 */
function normalizeBatch(body: SyncBody): { ok: true; value: Normalized } | { ok: false; res: NextResponse } {
  const reports = asList<ReportOp>(body.reports);
  const cards = asList<CardOp>(body.cards);
  const deleteReports = asList<string>(body.deleteReports);
  const deleteCards = asList<string>(body.deleteCards);

  const counts: Array<[unknown, number, keyof typeof TOO_LARGE_LABEL]> = [
    [reports, MAX_BATCH, "reports"],
    [cards, MAX_BATCH, "cards"],
    [deleteReports, MAX_BATCH, "deleteReports"],
    [deleteCards, MAX_BATCH, "deleteCards"],
  ];
  for (const [list, max, label] of counts) {
    if ((list as unknown[]).length > max) {
      return {
        ok: false,
        res: tooLarge(`单次最多同步 ${max} 条${TOO_LARGE_LABEL[label]}，本次 ${(list as unknown[]).length} 条`),
      };
    }
  }

  for (const r of reports) {
    if (textTooLarge(r?.full_text)) {
      return { ok: false, res: tooLarge(`单条报告正文超过 ${MAX_TEXT_BYTES / 1024}KB`) };
    }
  }
  for (const c of cards) {
    if (textTooLarge(c?.question) || textTooLarge(c?.answer)) {
      return { ok: false, res: tooLarge(`单张复习卡的问答超过 ${MAX_TEXT_BYTES / 1024}KB`) };
    }
  }

  return { ok: true, value: { reports, cards, deleteReports, deleteCards } };
}

/**
 * POST /api/sync — 客户端把本地变更推上来（upsert + 删除清单）。
 * 同一 key 重复提交按 updated_at = now() 覆盖，安全；delete 无此幂等性，
 * 所以删除清单里同 key 的 upsert 必须剔除（见下）。
 */
export async function POST(req: NextRequest) {
  // Origin 白名单必须排在 requireUser 之前：不信任的来源连会话都不该去读。
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "来源不被信任" }, { status: 403 });
  }
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

  const batch = normalizeBatch(body);
  if (!batch.ok) return batch.res;
  const { reports, cards, deleteReports, deleteCards } = batch.value;

  const failures: string[] = [];
  const run = async <T>(name: string, fn: () => Promise<T>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      console.error(`[sync] ${name} failed:`, e);
      failures.push(name);
    }
  };

  // 下面四个循环是「先 upsert 后 delete」，所以过期的 delete 反而会赢：
  // 同一 payload 里既有 key 的 upsert 又有它的 delete 时，刚写上去的记录会被删掉，
  // 而 pull 只写不删、合并上传只在云端全空时触发 → 云端记录删掉后不自愈。
  // 客户端入队时已按 key 归并，这里再兜一层（老客户端/被改坏的队列仍安全）。
  const upsertedReports = new Set(reports.map((r) => r.key));
  const upsertedCards = new Set(cards.map((c) => c.key));

  for (const r of reports) {
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
  for (const c of cards) {
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
  for (const k of deleteReports) {
    if (upsertedReports.has(k)) continue; // 同 payload 里的 upsert 优先，删除已由上面的 upsert 表达
    await run(`del-report:${k}`, () => deleteReport(user.id, k));
  }
  for (const k of deleteCards) {
    if (upsertedCards.has(k)) continue;
    await run(`del-card:${k}`, () => deleteCard(user.id, k));
  }

  return NextResponse.json({
    ok: failures.length === 0,
    failures,
    pushed: {
      reports: reports.length,
      cards: cards.length,
    },
  });
}