/**
 * 服务端共享限流（/api/analyze、/api/repo、/api/repo/module 共用）。
 *
 * 主路径：Cloudflare D1 持久化计数（serverless 多实例全局一致），见 aiAccess()：
 * - 匿名请求：同 IP 60s 固定窗口，10 次/分钟；
 * - 登录请求：按 UTC+8 自然日配额 50 次/日（覆盖分钟窗，登录身份可追溯）。
 * 每次判定只发**一条** upsert…RETURNING 语句（一次 HTTP 往返，不做 SELECT+UPDATE 两跳）。
 *
 * 降级兜底：D1 不可用（环境变量缺失/网络故障）时回退到下面的进程内存限流。
 *
 * 评审修复：
 * - clientIp 取 x-forwarded-for 的**最右一跳**（离平台代理最近、不可被客户端伪造的值），
 *   而非最左值（客户端可随意注入以绕过限流）；
 * - 内存桶加清理与硬上限：每次写入时惰性清扫过期条目，超硬上限直接清空，
 *   防止公网海量伪造 IP 把 Map 撑成内存 DoS。
 */

import { run } from "@/lib/db";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const BUCKET_SWEEP_AT = 1000; // 条目数达到该值才触发一次清扫（摊薄成本）
const BUCKET_HARD_CAP = 10_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]; // 最右一跳：由受信代理写入
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateVerdict {
  allowed: boolean;
  retryAfter?: number;
  /** 超限提示（缺省用通用的“请求过于频繁”） */
  message?: string;
}

/** 取号：每次请求调用一次。拒绝时返回 retryAfter 秒。 */
export function rateLimit(req: Request): RateVerdict {
  const now = Date.now();
  const ip = clientIp(req);

  const existing = buckets.get(ip);
  if (existing && now < existing.resetAt) {
    if (existing.count >= RATE_MAX) {
      return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
    }
    existing.count++;
    return { allowed: true };
  }

  // 惰性清扫：Map 变大时顺手把过期条目扔掉，防无界增长
  if (buckets.size >= BUCKET_SWEEP_AT) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
    if (buckets.size >= BUCKET_HARD_CAP) buckets.clear(); // 兜底：伪造洪峰直接清空重来
  }

  buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  return { allowed: true };
}

/** 429 响应的统一组包（Retry-After 三端点一致） */
export function rateLimitedResponse(verdict: RateVerdict): Response {
  const retryAfter = verdict.retryAfter ?? 60;
  const msg = verdict.message ?? `请求过于频繁，请 ${retryAfter}s 后再试`;
  return new Response(JSON.stringify({ error: msg }), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": String(retryAfter),
    },
  });
}

/* ==================== D1 持久化限流 + 登录日配额（P1 成本封口） ==================== */

/** 登录用户每日 AI 调用配额（UTC+8 自然日重置；匿名用户沿用 60s 窗口 IP 限流） */
export const LOGIN_DAILY_QUOTA = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** UTC+8 自然日（YYYY-MM-DD）：对中国用户“零点重置”更符合直觉 */
function beijingDay(now: number): string {
  return new Date(now + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

/** 距下一个 UTC+8 自然日起点的秒数（429 Retry-After 用） */
function secondsToNextBeijingDay(now: number): number {
  const next = (Math.floor((now + UTC8_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - UTC8_OFFSET_MS;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * D1 单语句原子计数：upsert +1 并 RETURNING 新值，超限判断在应用层。
 * key 约定：匿名分钟窗 `ip:<ip>:m<窗口起点毫秒>`；登录日配额 `u:<userId>:d<YYYY-MM-DD>`。
 * 过期行不再访问即自然失效；行数 = 活跃 IP×分钟 + 用户×天，量级很小，暂不做清理任务。
 */
async function d1Bump(
  key: string,
  limit: number,
  now: number,
  kind: "ip-window" | "daily-quota",
  windowStart?: number
): Promise<RateVerdict> {
  const rows = await run<{ count: number }>(
    `INSERT INTO rate_limits (key, count, updated_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET count = count + 1, updated_at = ?2
     RETURNING count`,
    key,
    now
  );
  const count = Number(rows[0]?.count ?? 1);
  if (count <= limit) return { allowed: true };
  return kind === "daily-quota"
    ? {
        allowed: false,
        retryAfter: secondsToNextBeijingDay(now),
        message: `今日 AI 深挖次数已用完（${limit} 次/天），请明天再来`,
      }
    : {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(((windowStart ?? now) + RATE_WINDOW_MS - now) / 1000)),
      };
}

/**
 * AI 调用入口统一判定：登录用户按日配额，匿名按 IP 分钟窗（均为 D1 持久化）。
 * @param userId 登录用户的数据库 id（getUserBySession 返回）；null 表示匿名。
 */
export async function aiAccess(req: Request, userId: number | null): Promise<RateVerdict> {
  const now = Date.now();
  try {
    if (userId != null) {
      return await d1Bump(`u:${userId}:d${beijingDay(now)}`, LOGIN_DAILY_QUOTA, now, "daily-quota");
    }
    const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
    return await d1Bump(`ip:${clientIp(req)}:m${windowStart}`, RATE_MAX, now, "ip-window", windowStart);
  } catch (err) {
    // ponytail: D1 不可用（未配置环境变量/网络故障）时降级回进程内存限流，
    // serverless 多实例计数不精确，仅作兜底防完全裸奔，D1 恢复后自动回到持久化路径。
    console.error("[rateLimit] D1 限流不可用，降级为进程内存限流:", err);
    return rateLimit(req);
  }
}
