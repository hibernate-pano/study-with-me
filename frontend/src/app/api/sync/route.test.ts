/**
 * POST /api/sync 的服务端守卫：Origin 白名单 + 单次推送规模上限。
 *
 * 这两条都是「请求还没进业务逻辑」就该判掉的，所以断言的重点是
 * **副作用为零**：被拒的请求既不能读会话，也不能碰任何一个 db 写入函数。
 *
 * Origin 判定的取值矩阵在 @/lib/origin 的单测里；这里只钉「sync 确实接上了这道闸」。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  upsertReport: vi.fn(async (_userId: number, _row: unknown) => {}),
  upsertCard: vi.fn(async (_userId: number, _row: unknown) => {}),
  deleteReport: vi.fn(async (_userId: number, _key: string) => {}),
  deleteCard: vi.fn(async (_userId: number, _key: string) => {}),
  getUserBySession: vi.fn(async () => ({ id: 7, login: "jasper" })),
}));

vi.mock("@/lib/auth", () => ({ getUserBySession: h.getUserBySession }));
vi.mock("@/lib/db", () => ({
  run: vi.fn(async () => []),
  fetchAll: vi.fn(async () => ({ reports: [], cards: [] })),
  upsertReport: h.upsertReport,
  upsertCard: h.upsertCard,
  deleteReport: h.deleteReport,
  deleteCard: h.deleteCard,
}));

import { POST } from "./route";

const HOST_URL = "https://studywithme.panbo.space/api/sync";

function post(body: unknown, origin: string | null = "https://studywithme.panbo.space") {
  return new NextRequest(HOST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "tts_session=jwt",
      ...(origin === null ? {} : { origin }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const report = (key: string, full_text = "正文") => ({ key, term: key, full_text });
const card = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  term: key,
  question: "问",
  answer: "答",
  due_at: 1,
  interval_days: 1,
  reps: 0,
  status: "new",
  ...extra,
});

beforeEach(() => {
  h.upsertReport.mockClear();
  h.upsertCard.mockClear();
  h.deleteReport.mockClear();
  h.deleteCard.mockClear();
  h.getUserBySession.mockClear();
  h.getUserBySession.mockResolvedValue({ id: 7, login: "jasper" } as never);
});

describe("POST /api/sync 的 Origin 白名单", () => {
  it("跨站来源 → 403，且不读会话、不碰任何写入", async () => {
    const res = await POST(post({ reports: [report("a")], deleteReports: ["b"] }, "https://evil.example"));
    expect(res.status).toBe(403);
    expect(h.getUserBySession).not.toHaveBeenCalled();
    expect(h.upsertReport).not.toHaveBeenCalled();
    expect(h.deleteReport).not.toHaveBeenCalled();
  });

  it("缺 Origin → 403（text/plain 无预检的盲发就是这种形态）", async () => {
    const res = await POST(post({ reports: [report("a")] }, null));
    expect(res.status).toBe(403);
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("同源 → 放行", async () => {
    const res = await POST(post({ reports: [report("a")] }));
    expect(res.status).toBe(200);
    expect(h.upsertReport).toHaveBeenCalledTimes(1);
  });
});

/**
 * 跨站盲发复现 —— 用真实攻击形态打，而不是只塞一个 "evil.example" 了事。
 *
 * 为什么是 text/plain：跨站 fetch 只要 content-type 是三个 CORS-safelisted 值之一，
 * 浏览器就**不发预检**，请求直接带着共享 cookie 打出去；而本路由的 POST 是
 * `await req.json()`，不看 content-type，所以纯文本里装一段合法 JSON 就能写进去。
 * application/json 反而会触发预检、根本到不了这里。
 *
 * 这道闸到底挡住了什么，别把它说得比实际更强：
 *   - 今天 cookie 是 SameSite=Lax，所以浏览器发起的**跨站** POST 本来就带不上凭证，
 *     originAllowed 是压在它上面的第二层，不变式依赖 cookie 属性——
 *     一旦有人为了「SSO cookie 老是被丢」把 sameSite 改成 none、或引入任何非浏览器
 *     客户端（服务端代理、脚本、App），这一层就是唯一还拦着的东西。
 *   - 它**没有**挡住的东西：panbo.space 家族里的兄弟源（同站，Lax cookie 照发），
 *     判定逻辑刻意放行，见 @/lib/origin 的文件头「代价必须说清」那段。
 *   - 读方向浏览器已经挡住（全站无任何 Access-Control 头），所以这条路径的后果是
 *     **盲写 + 盲删云端 reports / cards**，不是信息泄漏。
 */
function blindPost(body: unknown, origin: string | null) {
  const headers: Record<string, string> = { "content-type": "text/plain;charset=UTF-8", cookie: "tts_session=jwt" };
  if (origin !== null) headers.origin = origin;
  return new NextRequest(HOST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** IndexedDB 里一条真实报告经 reportToCloud 推上去的形态（storage.ts:167） */
const hijackReport = {
  key: "1727600000000-惰性求值",
  term: "惰性求值",
  parent_term: "函数式编程",
  relation_type: "属于",
  full_text:
    "# 惰性求值\n\n惰性求值（Lazy Evaluation）把「什么时候算」推迟到真正需要结果的那一刻。\n" +
    "它在 Haskell 里是语言级的默认行为；在 JavaScript 里由生成器与迭代协议部分模拟。\n\n" +
    "## 为什么重要\n\n- 省掉永远用不到的计算\n- 让递归数据结构（无限链表、稠密表）可以自然表达\n\n" +
    "## 代价\n\n一旦被观察到，副作用就可能重复发生，所以惰性和副作用必须分开设计。",
  related: [{ term: "柯里化", type: "相关" }],
};

describe("POST /api/sync：跨站 text/plain 盲发（无预检的真实攻击形态）", () => {
  it("跨站盲写报告 → 403，云端一条都没写进去", async () => {
    const res = await POST(blindPost({ reports: [hijackReport] }, "https://attacker.example"));
    expect(res.status).toBe(403);
    expect(h.upsertReport).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ error: "来源不被信任" });
  });

  it("跨站盲写复习卡 → 403，云端一条都没写进去", async () => {
    const res = await POST(
      blindPost(
        {
          cards: [
            {
              key: "1727600000001-惰性求值#c1",
              term: "惰性求值",
              question: "惰性求值把计算的时机推迟到哪里？",
              answer: "推迟到结果第一次被真正需要（求值）的那一刻。",
              due_at: 1727600000000,
              interval_days: 1,
              reps: 0,
              status: "new",
            },
          ],
        },
        "https://attacker.example"
      )
    );
    expect(res.status).toBe(403);
    expect(h.upsertCard).not.toHaveBeenCalled();
  });

  it("跨站盲删（删除清单不可幂等，被打中就是用户数据真没了）→ 403，一条都不删", async () => {
    const res = await POST(
      blindPost(
        { deleteReports: ["1727600000000-惰性求值"], deleteCards: ["1727600000001-惰性求值#c1"] },
        "https://attacker.example"
      )
    );
    expect(res.status).toBe(403);
    expect(h.deleteReport).not.toHaveBeenCalled();
    expect(h.deleteCard).not.toHaveBeenCalled();
  });

  it("伪装成 panbo.space 的后缀 → 403（endsWith 带前导点才防得住这种）", async () => {
    for (const origin of [
      "https://evilpanbo.space",
      "https://panbo.space.attacker.example",
      "https://studywithme.panbo.space@attacker.example", // userinfo 骗法，URL.host 取的是真 host
    ]) {
      const res = await POST(blindPost({ reports: [hijackReport] }, origin));
      expect(res.status, origin).toBe(403);
    }
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("守卫排在鉴权之前：来源不可信时连会话都不去读", async () => {
    await POST(blindPost({ reports: [hijackReport] }, "https://attacker.example"));
    expect(h.getUserBySession).not.toHaveBeenCalled();
  });

  it("不带 Origin 的裸请求（curl / 老客户端）→ 403", async () => {
    const res = await POST(blindPost({ reports: [hijackReport] }, null));
    expect(res.status).toBe(403);
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("同源 text/plain 仍放行：守卫只认 Origin，不按 content-type 挑食", async () => {
    const res = await POST(blindPost({ reports: [hijackReport] }, "https://studywithme.panbo.space"));
    expect(res.status).toBe(200);
    expect(h.upsertReport).toHaveBeenCalledTimes(1);
    expect(h.upsertReport.mock.calls[0][1]).toMatchObject({ key: "1727600000000-惰性求值", term: "惰性求值" });
  });

  /**
   * 已知的、未闭合的口子，写在这里是为了下一个人别把它当成「已覆盖」：
   * 同站的兄弟源（topic-talkshow.panbo.space 出 XSS 时）仍然过得去这道闸，
   * 因为共享 cookie 的域就是 panbo.space、SSO 信任域必须包含它。
   * 这条变红 = 有人收紧了信任域，请同步改 @/lib/origin 的文件头注释。
   */
  it("已知残留：panbo.space 家族内的兄弟源仍放行（SSO 信任域，非回归）", async () => {
    const res = await POST(blindPost({ reports: [hijackReport] }, "https://topic-talkshow.panbo.space"));
    expect(res.status).toBe(200);
    expect(h.upsertReport).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/sync 的规模上限", () => {
  const many = (n: number, make: (i: number) => unknown) => Array.from({ length: n }, (_, i) => make(i));

  it("201 条报告 → 413，一条都不写", async () => {
    const res = await POST(post({ reports: many(201, (i) => report(`r${i}`)) }));
    expect(res.status).toBe(413);
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("201 张复习卡 → 413", async () => {
    const res = await POST(post({ cards: many(201, (i) => card(`c${i}`)) }));
    expect(res.status).toBe(413);
    expect(h.upsertCard).not.toHaveBeenCalled();
  });

  it("201 条删除清单 → 413（删除不可幂等，超限必须整批拒而不是丢一半）", async () => {
    const res = await POST(post({ deleteReports: many(201, (i) => `r${i}`) }));
    expect(res.status).toBe(413);
    expect(h.deleteReport).not.toHaveBeenCalled();
  });

  it("201 条复习卡删除清单 → 413（四条清单的上限要一样齐，别只给三条装）", async () => {
    const res = await POST(post({ deleteCards: many(201, (i) => `c${i}`) }));
    expect(res.status).toBe(413);
    expect(h.deleteCard).not.toHaveBeenCalled();
  });

  it("批内只有一条正文超限 → 413，整批都不写（不能只跳过那一条）", async () => {
    const res = await POST(
      post({
        reports: [report("ok-1"), report("超长", "深".repeat(70_000)), report("ok-2")],
        deleteReports: ["旧的"],
      })
    );
    expect(res.status).toBe(413);
    expect(h.upsertReport).not.toHaveBeenCalled();
    expect(h.deleteReport).not.toHaveBeenCalled();
  });

  it("单条报告正文超 200KB → 413（按 UTF-8 字节算，中文不能被低估）", async () => {
    const res = await POST(
      post({ reports: [report("big", "深".repeat(70_000))] }) // 21 万字节 > 200KB
    );
    expect(res.status).toBe(413);
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("单张卡的问答超限 → 413", async () => {
    const res = await POST(post({ cards: [card("c", { answer: "答".repeat(200 * 1024) })] }));
    expect(res.status).toBe(413);
    expect(h.upsertCard).not.toHaveBeenCalled();
  });

  it("200 条整批 → 200 放行（上限是含端点的，不是一刀切在 199）", async () => {
    const res = await POST(post({ reports: many(200, (i) => report(`r${i}`)) }));
    expect(res.status).toBe(200);
    expect(h.upsertReport).toHaveBeenCalledTimes(200);
  });

  it("数组字段不是数组时当空处理，不 500", async () => {
    const res = await POST(post({ reports: "nope", cards: 7, deleteCards: {} }));
    expect(res.status).toBe(200);
    expect((await res.json()).pushed).toEqual({ reports: 0, cards: 0 });
  });
});

describe("POST /api/sync 的既有语义没被守卫改坏", () => {
  it("同 payload 里 upsert 优先于 delete", async () => {
    const res = await POST(
      post({ reports: [report("k")], deleteReports: ["k"] })
    );
    expect(res.status).toBe(200);
    expect(h.upsertReport).toHaveBeenCalledTimes(1);
    expect(h.deleteReport).not.toHaveBeenCalled();
  });

  it("未登录 → 401（Origin 放行之后才轮到鉴权）", async () => {
    h.getUserBySession.mockResolvedValueOnce(null as never);
    const res = await POST(post({ reports: [report("a")] }));
    expect(res.status).toBe(401);
    expect(h.upsertReport).not.toHaveBeenCalled();
  });

  it("非法 JSON → 400", async () => {
    const res = await POST(post("{ 坏掉的 json"));
    expect(res.status).toBe(400);
  });
});
