/**
 * 服务端共享限流（/api/analyze、/api/exam 等管线共用）。
 *
 * 主路径：Cloudflare D1 持久化计数（serverless 多实例全局一致），见 aiAccess()：
 * - 匿名请求：同 IP 60s 固定窗口 10 次/分钟，且叠加同 IP 的 UTC+8 日配额 200 次/天；
 * - 登录请求：按 UTC+8 自然日配额 50 次/日（覆盖分钟窗，登录身份可追溯）。
 * 每次判定用 upsert…RETURNING 单语句计数（不做 SELECT+UPDATE 两跳）；匿名要多一道日配额，
 * 所以是 1（登录）或 2（匿名）条语句。
 * 退化路径：拿不到可信客户端 IP 时**不做按 IP 归因**，只留按进程散开的分钟桶，
 * 详见 clientIp() 与 anonBucketKey()。
 *
 * 降级兜底：D1 不可用（环境变量缺失/网络故障）时回退到下面的进程内存限流。
 *
 * 评审修复：
 * - clientIp 取 x-forwarded-for 的**最右一跳**（离平台代理最近、不可被客户端伪造的值），
 *   而非最左值（客户端可随意注入以绕过限流）；
 * - clientIp 拿不到身份时返回 null 而非 "unknown" 之类的字面量：返回假身份会让
 *   全站匿名流量挤进同一个按 IP 归因的桶（200 次/天 + 10 次/分钟），自伤默认匿名路径；
 * - 内存桶加清理与硬上限：每次写入时惰性清扫过期条目，超硬上限直接清空，
 *   防止公网海量伪造 IP 把 Map 撑成内存 DoS。
 */

import { randomUUID } from "node:crypto";
import { run } from "@/lib/db";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const BUCKET_SWEEP_AT = 1000; // 条目数达到该值才触发一次清扫（摊薄成本）
const BUCKET_HARD_CAP = 10_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * 客户端 IP：x-forwarded-for 的**最右一跳**（离平台代理最近、不可被客户端伪造的值），
 * 缺失时退回 x-real-ip。**两者都拿不到时返回 null**。
 *
 * 关键是那个 null：早期版本这里返回字面量 "unknown"，而调用方分不出它是「一个人」
 * 还是「没有身份」，于是全站匿名请求被当成同一个 IP——日配额退化成全站共用的
 * 200 次/天，60s 窗退化成全站共用的 10 次/分钟。深挖是默认匿名路径（AnalyzeView
 * 不要求登录），代理没下发 XFF 时（自建部署 / 某些反代 / 本地 next dev）封顶的
 * 会是自己人。把「没有身份」表达成类型上的 null，调用方才被迫显式处理这条路径。
 */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]; // 最右一跳：由受信代理写入
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * 无身份时的退化分钟桶 key，带一个**进程内随机后缀**。
 *
 * 没有身份就没法按人归因，但共用一个字面量 key 等于把全站匿名流量压进同一个
 * 10 次/分钟的桶——那既是误伤，也是把限流变成了自我 DoS。后缀在进程内恒定，
 * 作用是把这个退化桶按实例散开，而不是凭空造出一个可信身份。
 * 代价说清楚：同一进程内无法区分的请求仍共享这一个桶（无身份可用，这是下界），
 * 且桶只在进程内存里活 60s——所以这条路径不走 D1（散开后的 key 拿不到跨实例
 * 一致性，却会在 D1 里留下永不复用的行，参见 d1Bump() 上方的行数说明）。
 */
const ANON_BUCKET_SALT = randomUUID();
const anonBucketKey = (): string => `anon:${ANON_BUCKET_SALT}`;

export interface RateVerdict {
  allowed: boolean;
  retryAfter?: number;
  /** 超限提示（缺省用通用的“请求过于频繁”） */
  message?: string;
}

/** 取号：每次请求调用一次。拒绝时返回 retryAfter 秒。 */
export function rateLimit(req: Request): RateVerdict {
  const now = Date.now();
  const ip = clientIp(req) ?? anonBucketKey();

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

/* ==================== D1 持久化限流 + 日配额（P1 成本封口） ==================== */

/** 登录用户每日 AI 调用配额（UTC+8 自然日重置） */
export const LOGIN_DAILY_QUOTA = 50;

/** 匿名用户每日 AI 调用配额（同 IP 同日；与 60s 分钟窗叠加，两者都过才放行） */
export const ANON_DAILY_QUOTA = 200;

const DAY_MS = 24 * 60 * 60 * 1000;
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 距下一个 UTC+8 自然日起点的秒数（429 Retry-After 用） */
function secondsToNextBeijingDay(now: number): number {
  const next = (Math.floor((now + UTC8_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - UTC8_OFFSET_MS;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/* 两条 upsert 只差「是否同一窗口」的判定；updated_at 读的是更新前的旧值。 */
const UPSERT_IP_WINDOW = `INSERT INTO rate_limits (key, count, updated_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN (?2 - updated_at) < ?3 THEN count + 1 ELSE 1 END,
       updated_at = ?2
     RETURNING count`;
/** 自然日是否相同：毫秒整数除法即 floor（北京时区 = UTC+8 平移后再取天） */
const UPSERT_DAY_WINDOW = `INSERT INTO rate_limits (key, count, updated_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN ((?2 + ?3) / ?4) = ((updated_at + ?3) / ?4) THEN count + 1 ELSE 1 END,
       updated_at = ?2
     RETURNING count`;

/**
 * D1 单语句原子计数：固定 key 的 upsert +1 并 RETURNING 新值，超限判断在应用层。
 *
 * key 固定为 `ip:<ip>`（匿名 60s 窗）/ `d:ip:<ip>`（匿名日配额）/ `u:<userId>`（登录日配额），
 * **不把窗口起点编进 key**：早前 key 形如 `ip:<ip>:m<窗口起点>`、每活跃窗口新增一行、
 * key 永不重用 → 行数永久累积。现在窗口归属由行上的 updated_at 判定，
 * 行数只随「独立 IP / 独立用户」增长。
 * 仍存的缺口：不活跃 IP / 长期不登录用户的旧行照样驻留，彻底回收要另配清理任务
 * （D1 无 TTL；vercel.json 的 crons 只能调度 HTTP 端点，需另写一个带鉴权的清理端点）。
 */
async function d1Bump(
  key: string,
  limit: number,
  now: number,
  kind: "ip-window" | "daily-quota"
): Promise<RateVerdict> {
  const [query, params]: [string, unknown[]] =
    kind === "daily-quota"
      ? [UPSERT_DAY_WINDOW, [key, now, UTC8_OFFSET_MS, DAY_MS]]
      : [UPSERT_IP_WINDOW, [key, now, RATE_WINDOW_MS]];
  const rows = await run<{ count: number }>(query, ...params);
  const count = Number(rows[0]?.count ?? 1);
  if (count <= limit) return { allowed: true };
  return kind === "daily-quota"
    ? {
        allowed: false,
        retryAfter: secondsToNextBeijingDay(now),
        message: `今日 AI 深挖次数已用完（${limit} 次/天），请明天再来`,
      }
    : { allowed: false, retryAfter: Math.ceil(RATE_WINDOW_MS / 1000) };
}

/**
 * AI 调用入口统一判定：登录用户按日配额；匿名先按同 IP 日配额封口，再叠 60s 分钟窗。
 * @param userId 登录用户的数据库 id（getUserBySession 返回）；null 表示匿名。
 */
export async function aiAccess(req: Request, userId: number | null): Promise<RateVerdict> {
  const now = Date.now();
  const ip = clientIp(req);
  try {
    if (userId != null) {
      return await d1Bump(`u:${userId}`, LOGIN_DAILY_QUOTA, now, "daily-quota");
    }
    if (ip === null) {
      // 拿不到可信 IP：按 IP 归因的日配额在这里没有「同一个 IP」的含义——
      // d:ip:unknown 会变成全站匿名流量共用的 200 次/天，把默认匿名路径自己封死。
      // 所以不查日配额，只保留分钟窗；桶 key 已按进程散开（anonBucketKey）。
      // 分钟窗只有 60s，散开后的 key 也拿不到 D1 的跨实例一致性，却会在 D1 里留下
      // 永不复用的行（见 d1Bump 上方关于行数的说明），故走进程内存计数：
      // 既省一次往返，也不在退化场景里徒增 D1 行数。
      return rateLimit(req);
    }
    // 匿名日配额是成本封口（此前匿名只有 60s 窗，单 IP 单日理论可打 14400 次）；
    // 注意它挡不住分布式：100 IP × 200 次 = 20000 次/天，真正的封口需要全局日预算 + 超限告警。
    const daily = await d1Bump(`d:ip:${ip}`, ANON_DAILY_QUOTA, now, "daily-quota");
    if (!daily.allowed) return daily;
    return await d1Bump(`ip:${ip}`, RATE_MAX, now, "ip-window");
  } catch (err) {
    // ponytail: D1 不可用（未配置环境变量/网络故障）时降级回进程内存限流，
    // serverless 多实例计数不精确，仅作兜底防完全裸奔，D1 恢复后自动回到持久化路径。
    console.error("[rateLimit] D1 限流不可用，降级为进程内存限流:", err);
    return rateLimit(req);
  }
}
