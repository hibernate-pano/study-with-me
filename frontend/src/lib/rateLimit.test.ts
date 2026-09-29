/**
 * aiAccess（D1 持久化限流 + 日配额）最小测试。
 * 用 fetch stub 模拟 D1 HTTP API，不发真实网络请求。
 *
 * 固定墙钟（vi.useFakeTimers）：窗口/自然日边界是这套逻辑的一部分，
 * 用真实时间会让「11 次连续调用」这类用例跨过分钟或零点边界而假红。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiAccess, ANON_DAILY_QUOTA, LOGIN_DAILY_QUOTA, rateLimitedResponse } from "./rateLimit";

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

/** 不带任何代理头的请求：clientIp 取不到身份 */
function bareReq(headers?: Record<string, string>): Request {
  return new Request("https://x.test/api/analyze", { method: "POST", headers });
}

/**
 * 极简 D1 模拟器：按 key 维护 {count, updated_at}，镜像 upsert 的计数语义
 * （同窗 +1、跨窗重置为 1）。窗口类型从绑定参数的个数区分：日窗绑 (key,now,偏移,天长)
 * 四个，分钟窗绑 (key,now,阈值) 三个——与 rateLimit.ts 里两条 upsert 一一对应。
 */
function fakeD1() {
  const rows = new Map<string, { count: number; updated_at: number }>();
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { sql: string; params: unknown[] };
    const params = body.params as number[];
    const [key, now, a, b] = [String(params[0]), Number(params[1]), Number(params[2]), Number(params[3])];
    const isDay = params.length === 4;
    const prev = rows.get(key);
    const sameWindow = prev
      ? isDay
        ? Math.floor((now + a) / b) === Math.floor((prev.updated_at + a) / b)
        : now - prev.updated_at < a
      : false;
    const count = sameWindow ? prev!.count + 1 : 1;
    rows.set(key, { count, updated_at: now });
    return d1Response(count);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    keys: () => [...rows.keys()].sort(),
    sqlOf: (i: number) => JSON.parse(String(fetchMock.mock.calls[i][1]?.body)).sql as string,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z")); // 北京时间 2026-01-01 18:00
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.D1_DATABASE_ID = "test-db";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("aiAccess（D1 持久化限流）", () => {
  it("登录用户走日配额：前 50 次放行，第 51 次拒绝并返回中文提示", async () => {
    const { fetchMock, keys } = fakeD1();

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

    // key 不含日期/窗口：一天内复用同一行（北京 1/1 18:00）
    expect(keys()).toEqual(["u:42"]);
  });

  it("登录用户跨北京零点自动重置配额（同一行，靠 updated_at 判窗）", async () => {
    const { fetchMock, keys, sqlOf } = fakeD1();
    const req = fakeReq("1.2.3.4");
    await aiAccess(req, 42);
    // 北京 2026-01-01 23:59:59 → 00:00:01 跨日
    vi.setSystemTime(new Date("2026-01-01T15:59:59Z"));
    expect((await aiAccess(req, 42)).allowed).toBe(true);
    vi.setSystemTime(new Date("2026-01-01T16:00:01Z"));
    expect((await aiAccess(req, 42)).allowed).toBe(true);

    expect(keys()).toEqual(["u:42"]); // 全程只占一行
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sqlOf(0)).toContain("((?2 + ?3) / ?4) = ((updated_at + ?3) / ?4)");
  });

  it("匿名用户走 IP 分钟窗：超 10 次拒绝，跨窗后恢复（D1 计数持久化）", async () => {
    const { keys } = fakeD1();

    const req = fakeReq("5.6.7.8");
    for (let i = 0; i < 10; i++) {
      expect((await aiAccess(req, null)).allowed).toBe(true);
    }
    const over = await aiAccess(req, null);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
    expect(over.message).toBeUndefined(); // 匿名超限用通用提示

    vi.advanceTimersByTime(61_000); // 显式推进到下一个分钟窗
    expect((await aiAccess(req, null)).allowed).toBe(true);
    // 匿名每次判定两条：先日配额、再分钟窗；key 不含窗口起点 → 只有两行
    expect(keys()).toEqual(["d:ip:5.6.7.8", "ip:5.6.7.8"]);
  });

  it("匿名用户叠加同 IP 日配额：超 200 次/天拒绝", async () => {
    const { fetchMock } = fakeD1();

    const req = fakeReq("5.6.7.8");
    // 每步都跨过分钟窗（否则先被 10 次/分钟的窗拒掉，测不到日配额）
    for (let i = 0; i < ANON_DAILY_QUOTA; i++) {
      vi.advanceTimersByTime(61_000);
      expect((await aiAccess(req, null)).allowed).toBe(true);
    }
    const over = await aiAccess(req, null);
    expect(over.allowed).toBe(false);
    expect(over.message).toContain("今日 AI 深挖次数已用完");
    // 日配额已拒 → 不再打分钟窗（每次放行 2 条 + 首次被拒 1 条）
    expect(fetchMock).toHaveBeenCalledTimes(ANON_DAILY_QUOTA * 2 + 1);
  });

  it("匿名 key 不含窗口起点：跨分钟窗复用同一行（行数不随时间增长）", async () => {
    const { keys, sqlOf } = fakeD1();
    const req = fakeReq("5.6.7.8");
    await aiAccess(req, null);
    vi.advanceTimersByTime(61_000); // 显式推进到下一个分钟窗
    await aiAccess(req, null);
    expect(keys()).toEqual(["d:ip:5.6.7.8", "ip:5.6.7.8"]); // 仅「分钟窗 + 日配额」两行
    expect(sqlOf(0)).toContain("((?2 + ?3) / ?4) = ((updated_at + ?3) / ?4)");
    expect(sqlOf(1)).toContain("(?2 - updated_at) < ?3");
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

/**
 * 退化路径：拿不到可信客户端 IP（缺 x-forwarded-for / x-real-ip）时的行为。
 *
 * 这条路径以前是「全站匿名流量共用一个桶」：d:ip:unknown 200 次/天 + ip:unknown
 * 10 次/分钟。深挖是默认匿名路径，一旦命中（自建部署 / 反代没下发 XFF / 本地 dev），
 * 被自己的限流封死的就是自己。
 */
describe("aiAccess（拿不到客户端 IP 的退化路径）", () => {
  it("不带任何代理头时不会把请求算进同一个日配额桶", async () => {
    const { fetchMock, keys } = fakeD1();

    // 250 次 >> 200 次/天：带 XFF 的路径此时早该被日配额拒了，这里必须一路放行。
    // 循环上界**故意写成字面量**而不是 ANON_DAILY_QUOTA：那个常量是本轮修复才加导出的，
    // 一旦拿不到（undefined + 50 = NaN，`i < NaN` 恒 false），循环体一次都不跑，
    // 下面两条断言会「因为什么都没发生」而空转通过 —— 那正是这条用例唯一的价值所在。
    let attempts = 0;
    for (let i = 0; i < 250; i++) {
      vi.advanceTimersByTime(61_000);
      attempts++;
      expect((await aiAccess(bareReq(), null)).allowed).toBe(true);
    }

    expect(attempts, "循环必须真的跑过 250 次，否则断言是空转的").toBe(250);
    // 核心断言：整个过程没碰 D1 日配额，更不存在全站共用的 d:ip:unknown
    expect(keys()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("无身份的匿名请求连一次 D1 往返都不该有（只要碰了 D1，就说明在按字面量桶归因）", async () => {
    // buckets 是模块级 Map，beforeEach 只重置时钟、不重置它：
    // 上一条用例把时钟往前推了几小时，残留条目的 resetAt 落在「未来」，
    // 时钟被拨回 10:00 后那个桶又变回有效 → 本用例会被它累积到 10 次而误拒。
    // 重载模块拿一份干净的桶，与用例顺序无关。
    vi.resetModules();
    const { aiAccess: freshAiAccess } = await import("./rateLimit");

    const { fetchMock, keys } = fakeD1();

    // 12 次 > 10 次/分钟窗：够暴露「全站共用一个桶」，又不受日配额干扰。
    // 上界同样是字面量，避免依赖本轮才导出的常量而空转。
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(61_000);
      expect((await freshAiAccess(bareReq(), null)).allowed).toBe(true);
    }

    expect(fetchMock, "退化路径只走进程内存计数，不该打 D1").not.toHaveBeenCalled();
    expect(keys().filter((k) => k.includes("unknown")), "任何以字面量 unknown 归因的桶都是全站共用桶").toEqual([]);
  });

  it("空值形态的代理头同样算「没有身份」：不退回字面量桶", async () => {
    const { fetchMock, keys } = fakeD1();

    // Headers 会把纯空白折叠成空串；xff 全是逗号则 hops 为空数组
    await aiAccess(bareReq({ "x-real-ip": "   " }), null);
    await aiAccess(bareReq({ "x-forwarded-for": " , , " }), null);

    expect(keys()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("分钟窗仍然生效（不是完全不限流），但桶按进程散开", async () => {
    // 内存桶与 anon 后缀是模块级状态：重载模块拿到干净的桶，
    // 避免与同文件里其他用例的残留计数互相干扰（用例顺序无关）。
    vi.resetModules();
    const { aiAccess: freshAiAccess } = await import("./rateLimit");

    const { fetchMock } = fakeD1();
    const req = bareReq();
    for (let i = 0; i < 10; i++) {
      expect((await freshAiAccess(req, null)).allowed).toBe(true);
    }
    const over = await freshAiAccess(req, null);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
    // 退化桶走进程内存计数，不写 D1（散开后的 key 只会留下永不复用的行）
    expect(fetchMock).not.toHaveBeenCalled();

    // 跨过 60s 窗口后恢复
    vi.advanceTimersByTime(61_000);
    expect((await freshAiAccess(req, null)).allowed).toBe(true);
  });

  it("带 x-real-ip 也算已知身份：照常走日配额 + 分钟窗（正常路径不变）", async () => {
    const { keys } = fakeD1();

    await aiAccess(bareReq({ "x-real-ip": "7.7.7.7" }), null);
    expect(keys()).toEqual(["d:ip:7.7.7.7", "ip:7.7.7.7"]);
  });

  it("两个不同 IP 的匿名请求各占各的日配额桶", async () => {
    const { keys } = fakeD1();

    await aiAccess(fakeReq("1.1.1.1"), null);
    await aiAccess(fakeReq("2.2.2.2"), null);

    expect(keys()).toEqual(["d:ip:1.1.1.1", "d:ip:2.2.2.2", "ip:1.1.1.1", "ip:2.2.2.2"]);
  });
});

/**
 * clientIp 的另一半职责：多跳 x-forwarded-for 取哪一跳。
 *
 * 这段逻辑在这轮修复之前就存在（本次只把「拿不到身份」从字面量 "unknown" 改成 null），
 * 所以下面是护栏不是回归复现——但它此前一条测试都没有，而它是**限流唯一能被客户端
 * 绕过的地方**：XFF 的最左值由客户端自己拼，最右值才是平台代理追加的、不可伪造的值。
 * 取错一跳 = 伪造 XFF 就能每天白嫖 200 次匿名 AI 配额，日封口形同虚设。
 */
describe("clientIp：多跳 x-forwarded-for 取最右一跳", () => {
  it("左边的伪造值被忽略：两个不同客户端伪造同一代理值，挤进同一个桶", async () => {
    const { keys } = fakeD1();

    // 客户端可以随便往 XFF 左边塞值；真正由平台代理追加的是最后一跳
    await aiAccess(bareReq({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }), null);
    await aiAccess(bareReq({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }), null);

    expect(keys(), "取左值的话这里会是两个独立桶，限流就能被 XFF 伪造绕过").toEqual([
      "d:ip:203.0.113.9",
      "ip:203.0.113.9",
    ]);
  });

  it("改最右一跳就换桶（说明确实在按最右值归因，不是把整串头当 key）", async () => {
    const { keys } = fakeD1();

    await aiAccess(bareReq({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" }), null);
    await aiAccess(bareReq({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }), null);

    expect(keys()).toEqual(["d:ip:198.51.100.7", "d:ip:203.0.113.9", "ip:198.51.100.7", "ip:203.0.113.9"]);
  });

  it("XFF 存在但全是空白时退回 x-real-ip（代理头存在不等于有身份）", async () => {
    const { keys } = fakeD1();

    await aiAccess(bareReq({ "x-forwarded-for": " , , ", "x-real-ip": "7.7.7.7" }), null);

    expect(keys()).toEqual(["d:ip:7.7.7.7", "ip:7.7.7.7"]);
  });
});

/**
 * 守卫的顺序：新加的「ip === null 就退化」分支必须排在登录判定**之后**。
 *
 * 深挖是默认匿名路径，但登录用户在代理没下发 XFF 的部署里同样可能一个代理头都没有。
 * 顺序写反的后果很隐蔽：登录用户被当成「没有身份」，50 次/天 悄悄退化成 10 次/分钟的
 * 进程内存桶，日配额彻底失效，而界面上看不出任何异常。
 */
describe("登录用户不受退化路径影响", () => {
  it("一个代理头都没有的登录请求，仍走 u:<id> 日配额而不是 10 次/分钟的退化桶", async () => {
    const { keys } = fakeD1();

    // 走满 50 次/天：若被当成匿名退化桶，第 11 次就该被 60s 窗拒掉，这里会红
    for (let i = 0; i < LOGIN_DAILY_QUOTA; i++) {
      vi.advanceTimersByTime(61_000);
      expect((await aiAccess(bareReq(), 42)).allowed).toBe(true);
    }

    const over = await aiAccess(bareReq(), 42);
    expect(over.allowed).toBe(false);
    expect(over.message, "应是登录日配额的提示，而不是匿名分钟窗的通用提示").toContain("今日 AI 深挖次数已用完");
    expect(keys(), "只应占 u:42 一行；出现 anon/d:ip 键说明退化分支排在了登录判定前面").toEqual(["u:42"]);
  });
});
