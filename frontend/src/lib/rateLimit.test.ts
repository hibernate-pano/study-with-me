/**
 * aiAccess（D1 持久化限流 + 登录日配额）最小测试。
 * 用 fetch stub 模拟 D1 HTTP API，不发真实网络请求。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiAccess, LOGIN_DAILY_QUOTA, rateLimitedResponse } from "./rateLimit";

const ORIGINAL_ENV = { ...process.env };

/** 模拟 D1 /query 响应 */
function d1Response(count: number): Response {
  return new Response(
    JSON.stringify({ success: true, errors: [], result: [{ results: [{ count }] }] }),
    { status: 200 }
  );
}

/** 带伪造 x-forwarded-for 的请求 */
function fakeReq(ip: string): Request {
  return new Request("https://x.test/api/analyze", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.D1_DATABASE_ID = "test-db";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("aiAccess（D1 持久化限流）", () => {
  it("登录用户走日配额：前 50 次放行，第 51 次拒绝并返回中文提示", async () => {
    const counts = new Map<string, number>();
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: [string] };
      const key = body.params[0];
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return d1Response(n);
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = fakeReq("1.2.3.4");
    for (let i = 0; i < LOGIN_DAILY_QUOTA; i++) {
      expect((await aiAccess(req, 42)).allowed).toBe(true);
    }
    const over = await aiAccess(req, 42);
    expect(over.allowed).toBe(false);
    expect(over.message).toContain("今日 AI 深挖次数已用完");
    expect(over.retryAfter).toBeGreaterThan(0);

    // 每次判定只发一次 D1 请求（单语句 upsert…RETURNING，无多次往返）
    expect(fetchMock).toHaveBeenCalledTimes(LOGIN_DAILY_QUOTA + 1);

    // 429 组包带自定义提示与 Retry-After
    const res = rateLimitedResponse(over);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("今日 AI 深挖次数已用完");
  });

  it("匿名用户走 IP 分钟窗：超 10 次拒绝（D1 计数持久化）", async () => {
    const counts = new Map<string, number>();
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { params: [string] };
      const key = body.params[0];
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return d1Response(n);
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = fakeReq("5.6.7.8");
    for (let i = 0; i < 10; i++) {
      expect((await aiAccess(req, null)).allowed).toBe(true);
    }
    const over = await aiAccess(req, null);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
    expect(over.message).toBeUndefined(); // 匿名超限用通用提示
  });

  it("D1 不可用时降级为进程内存限流（同 IP 60s 窗口 10 次）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("D1 down");
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const req = fakeReq("9.9.9.9"); // 独立 IP，避免与其他用例共享内存桶
    for (let i = 0; i < 10; i++) {
      expect((await aiAccess(req, null)).allowed).toBe(true);
    }
    const blocked = await aiAccess(req, null);
    expect(blocked.allowed).toBe(false);
    // 内存降级路径不带自定义 message，由 rateLimitedResponse 兼通用的“请求过于频繁”
    expect(blocked.message).toBeUndefined();
    expect((await rateLimitedResponse(blocked).json()).error).toContain("请求过于频繁");
  });
});
