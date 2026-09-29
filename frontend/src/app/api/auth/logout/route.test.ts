/**
 * POST /api/auth/logout 回归：Origin 守卫搬到 @/lib/origin 之后行为必须一字不变。
 *
 * 这条路由是这套守卫的「原有实现」，sync 是照着它接的；哪天有人只改一份、两边又分叉，
 * 缺陷单里那条「守卫不一致」的维护陷阱就回来了。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  deleteSession: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth", () => ({ deleteSession: h.deleteSession }));
vi.mock("@/lib/db", () => ({ run: vi.fn(async () => []) }));

import { POST } from "./route";

function post(origin: string | null, cookies?: Record<string, string>) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin !== null) headers.origin = origin;
  if (cookies) headers.cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest("https://studywithme.panbo.space/api/auth/logout", { method: "POST", headers });
}

beforeEach(() => h.deleteSession.mockClear());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("POST /api/auth/logout", () => {
  it("跨站来源 → 403，且不吊销任何会话", async () => {
    const res = await POST(post("https://evil.example", { cd_session: "old" }));
    expect(res.status).toBe(403);
    expect(h.deleteSession).not.toHaveBeenCalled();
  });

  it("同源 → 200，吊销旧存储型会话并清两代 cookie", async () => {
    const res = await POST(post("https://studywithme.panbo.space", { cd_session: "old", tts_session: "jwt" }));
    expect(res.status).toBe(200);
    expect(h.deleteSession).toHaveBeenCalledWith(expect.anything(), "old");
    const cleared = res.cookies.getAll().filter((c) => c.value === "");
    expect(cleared.map((c) => c.name).sort()).toEqual(["cd_session", "tts_session"]);
  });

  it("没有 legacy cookie 时不必吊销（共享 JWT 是无状态的，删了也命中 0 行）", async () => {
    const res = await POST(post("https://studywithme.panbo.space", { tts_session: "jwt" }));
    expect(res.status).toBe(200);
    expect(h.deleteSession).not.toHaveBeenCalled();
  });

  /**
   * 护栏，不是回归复现：缺陷单明确要求「绝不要收窄 cookie 的 .panbo.space 域」，
   * 而 CSRF 的兜底完全压在 Origin 白名单上。这里钉的是**清 cookie 这一步也必须带域**——
   * 浏览器只会用「同名 + 同 Domain + 同 Path」去匹配要删的那条，
   * 漏了 domain 就变成只删了个同名的 host-only cookie，共享凭证纹丝不动地留在盘上，
   * 登出「看起来成功了」但没生效。这种坏法没有任何运行时症状，只会静默发生。
   *
   * 它在修复前后都是绿的（这轮没动 session.ts），价值是当有人想「顺手把域收窄 /
   * 清理时少传一个域」时立刻红。
   */
  it("生产环境清共享 cookie 仍带 Domain=.panbo.space（域一收窄，兄弟应用与登出一起坏）", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { POST: prodPOST } = await import("./route");

    const res = await prodPOST(post("https://studywithme.panbo.space", { tts_session: "jwt" }));
    const cleared = res.cookies.getAll();
    const shared = cleared.find((c) => c.name === "tts_session");
    expect(shared?.value, "共享 cookie 应被清空").toBe("");
    expect(shared?.domain, "清 cookie 必须带着原来种下去的那个域，否则清不到").toBe(".panbo.space");
    expect(shared?.path).toBe("/");
  });
});
