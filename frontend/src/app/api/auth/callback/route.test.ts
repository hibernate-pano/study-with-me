/**
 * P0 回归测试：OAuth callback 签发的 JWT 必须携带 GitHub 全局数字 id（ghUser.id），
 * 而非 D1 内部自增 id（user.id）——getUserBySession 按 github_id 反查，
 * 用内部 id 签发会导致反查失败并插幽灵用户行。
 *
 * 直接跑真实 GET handler：mock 掉 D1 HTTP（run → 内存 DB）与 GitHub API（fetch），
 * 从响应 Set-Cookie 里取会话 token，再走 getUserBySession 验证往返取回同一行。
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";

// —— 内存 DB（模拟 D1），让 D1 内部自增 id 与 GitHub id 刻意错开 ——
const mem = vi.hoisted(() => {
  const users = new Map<
    number,
    { id: number; github_id: number; login: string; avatar_url: string | null }
  >();
  let nextUserId = 1;
  async function run(q: string, ...params: unknown[]): Promise<unknown> {
    if (q.startsWith("INSERT INTO users")) {
      // 兼容两种形态：upsert（?1=ghId ?2=login ?3=avatar ?4=email ?5=ts）
      // 与 getUserBySession 的 INSERT…SELECT…WHERE NOT EXISTS（?1=ghId ?2=login ?3=avatar ?4=ts）
      const [githubId, login, avatar] = params as [number, string, string | null];
      const existing = [...users.values()].find((u) => u.github_id === githubId);
      const user = existing
        ? existing
        : {
            id: nextUserId++,
            github_id: githubId,
            login,
            avatar_url: avatar ?? null,
          };
      if (!existing) users.set(user.id, user);
      return [user];
    }
    if (q.includes("FROM users WHERE github_id")) {
      const [ghId] = params as [number];
      const u = [...users.values()].find((x) => x.github_id === ghId);
      return u ? [{ id: u.id, login: u.login, avatar_url: u.avatar_url }] : [];
    }
    return [];
  }
  return { users, run };
});

vi.mock("@/lib/db", () => ({ run: mem.run }));

import { GET } from "./route";
import { SHARED_COOKIE } from "@/lib/session";
import { getUserBySession } from "@/lib/auth";

const GH_ID = 5000; // GitHub 全局数字 id（≠ D1 内部自增 id 1）

describe("GET /api/auth/callback", () => {
  const OLD_ENV = process.env;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    process.env = {
      ...OLD_ENV,
      GITHUB_CLIENT_ID: "test-id",
      GITHUB_CLIENT_SECRET: "test-secret",
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
    globalThis.fetch = originalFetch;
  });

  it("签发的 JWT 用 GitHub 全局 id → getUserBySession 往返取回同一行，不插幽灵行", async () => {
    // mock GitHub：code 换 token + /user 接口
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("github.com/login/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "tok_abc" }), { status: 200 });
      }
      if (url.includes("api.github.com/user")) {
        return new Response(
          JSON.stringify({ id: GH_ID, login: "panbo", avatar_url: "a.png", email: null }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const req = new NextRequest("http://localhost:3000/api/auth/callback?code=c&state=st", {
      headers: { cookie: "cd_oauth_state=st" },
    });
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    const token = res.cookies.get(SHARED_COOKIE)?.value;
    expect(token).toBeTruthy();

    // 往返：callback 签发的 token 必须能按 github_id 反查回同一行
    const me = await getUserBySession((q, ...p) => mem.run(q, ...p), token);
    expect(me).not.toBeNull();
    expect(me!.id).toBe(1); // D1 内部自增 id
    expect(me!.login).toBe("panbo");
    expect(mem.users.size).toBe(1); // 只有 upsert 的那一行，无幽灵行
    expect(mem.users.get(1)!.github_id).toBe(GH_ID);
  });
});
