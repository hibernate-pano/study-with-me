import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubUser,
  oauthConfig,
  randomToken,
  upsertUserFromGithub,
  createSession,
  getUserBySession,
  deleteSession,
  SESSION_MAX_AGE_MS,
} from "./auth";

describe("oauth 配置选择", () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });

  it("本地来源优先用 DEV 那组 key", () => {
    process.env = {
      ...OLD,
      GITHUB_CLIENT_ID: "prod-id",
      GITHUB_CLIENT_SECRET: "prod-secret",
      GITHUB_CLIENT_ID_DEV: "dev-id",
      GITHUB_CLIENT_SECRET_DEV: "dev-secret",
    };
    expect(oauthConfig("http://localhost:3000").clientId).toBe("dev-id");
    expect(oauthConfig("http://127.0.0.1:3000").clientSecret).toBe("dev-secret");
  });

  it("线上来源始终用主 key；未配 DEV 时本地也回退主 key", () => {
    process.env = {
      ...OLD,
      GITHUB_CLIENT_ID: "prod-id",
      GITHUB_CLIENT_SECRET: "prod-secret",
    };
    expect(oauthConfig("https://studywithme.panbo.space").clientId).toBe("prod-id");
    expect(oauthConfig().clientId).toBe("prod-id");
    // 无 DEV 配置时本地回退主 key，不报错
    expect(oauthConfig("http://localhost:3000").clientId).toBe("prod-id");
  });

  it("完全未配置时抛错", () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(() => oauthConfig()).toThrow(/未配置/);
  });
});

describe("oauth 工具", () => {
  it("buildAuthorizeUrl 包含必要参数", () => {
    const url = buildAuthorizeUrl("client-123", "state-abc", "https://x.com/api/auth/callback");
    const u = new URL(url);
    expect(u.origin).toBe("https://github.com");
    expect(u.pathname).toBe("/login/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("client-123");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x.com/api/auth/callback");
    expect(u.searchParams.get("state")).toBe("state-abc");
    expect(u.searchParams.get("scope")).toBe("read:user");
  });

  it("randomToken 产出 hex 且长度正确", () => {
    const t1 = randomToken(16);
    expect(t1).toMatch(/^[0-9a-f]{32}$/);
    expect(randomToken(16)).not.toBe(t1);
  });

  describe("exchangeCodeForToken", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("成功换取 access_token", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ access_token: "tok_123" }), { status: 200 })
      ) as unknown as typeof fetch;
      await expect(exchangeCodeForToken("c", "s", "code9")).resolves.toBe("tok_123");
      const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].method).toBe("POST");
    });

    it("上游错误时抛错", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ error: "bad_verification_code" }), { status: 400 })
      ) as unknown as typeof fetch;
      await expect(exchangeCodeForToken("c", "s", "bad")).rejects.toThrow();
    });

    it("无 access_token 时抛错", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({}), { status: 200 })
      ) as unknown as typeof fetch;
      await expect(exchangeCodeForToken("c", "s", "x")).rejects.toThrow();
    });
  });

  describe("fetchGithubUser", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("只保留最小字段，丢弃社交资料", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 42,
            login: "jasper",
            avatar_url: "https://avatars/42.png",
            email: "a@b.com",
            bio: "secret bio",
            location: "Shanghai",
            followers: 999,
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;
      const u = await fetchGithubUser("tok");
      expect(u).toEqual({ id: 42, login: "jasper", avatar_url: "https://avatars/42.png", email: "a@b.com" });
    });

    it("email 为 null 时原样保留（GitHub 隐私设置）", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 1, login: "x", avatar_url: null, email: null }), { status: 200 })
      ) as unknown as typeof fetch;
      const u = await fetchGithubUser("tok");
      expect(u.email).toBeNull();
    });

    it("返回结构不完整时抛错", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ login: "no-id" }), { status: 200 })
      ) as unknown as typeof fetch;
      await expect(fetchGithubUser("tok")).rejects.toThrow();
    });
  });

  describe("会话（DB 交互用内存模拟）", () => {
    // 极简内存"数据库"模拟 upsert/会话
    const memSql = (() => {
      const users = new Map<number, { id: number; github_id: number; login: string }>();
      const sessions = new Map<string, { token: string; user_id: number; expires_at: string }>();
      let nextUserId = 1;
      return {
        users,
        sessions,
        async run(q: string, ...params: unknown[]): Promise<unknown> {
          if (q.startsWith("INSERT INTO users")) {
            const [githubId, login] = params as [number, string];
            const existing = [...users.values()].find((u) => u.github_id === githubId);
            const user = existing ? existing : { id: nextUserId++, github_id: githubId, login };
            users.set(user.id, user);
            return [user];
          }
          if (q.startsWith("INSERT INTO sessions")) {
            const [token, userId, exp] = params as [string, number, string];
            sessions.set(token, { token, user_id: userId, expires_at: exp });
            return [];
          }
          if (q.startsWith("SELECT u.id")) {
            const [token] = params as [string];
            const s = sessions.get(token);
            if (!s) return [];
            const u = users.get(s.user_id);
            if (!u) return [];
            if (new Date(s.expires_at).getTime() < Date.now()) return [];
            return [{ id: u.id, login: u.login, avatar_url: null }];
          }
          if (q.startsWith("DELETE FROM sessions")) {
            const [token] = params as [string];
            sessions.delete(token);
            return [];
          }
          return [];
        },
      };
    })();
    const sql = (q: string, ...p: unknown[]) => memSql.run(q, ...p);

    it("upsert 用户：新用户入库并可再次写入", async () => {
      await upsertUserFromGithub(sql, { id: 7, login: "panbo", avatar_url: null, email: null });
      await upsertUserFromGithub(sql, { id: 7, login: "panbo", avatar_url: "a.png", email: "e@x.com" });
      expect(memSql.users.size).toBe(1);
      const u = [...memSql.users.values()][0];
      expect(u.login).toBe("panbo");
    });

    it("创建会话后可凭 token 取得用户，过期返回 null", async () => {
      const gh = await upsertUserFromGithub(sql, { id: 8, login: "tester", avatar_url: null, email: null });
      const session = await createSession(sql, gh.id);
      expect(session.token.length).toBe(64);
      const diff = session.expiresAt.getTime() - Date.now();
      expect(Math.abs(diff - SESSION_MAX_AGE_MS)).toBeLessThan(100); // 毫秒级容差
      const me = await getUserBySession(sql, session.token);
      expect(me?.login).toBe("tester");
    });

    it("无效/过期 token 返回 null", async () => {
      await expect(getUserBySession(sql, "nope")).resolves.toBeNull();
      await expect(getUserBySession(sql, null)).resolves.toBeNull();
      await expect(getUserBySession(sql, undefined)).resolves.toBeNull();
    });

    it("登出删除会话后失效", async () => {
      const gh = await upsertUserFromGithub(sql, { id: 9, login: "bye", avatar_url: null, email: null });
      const s = await createSession(sql, gh.id);
      await expect(getUserBySession(sql, s.token)).resolves.not.toBeNull();
      await deleteSession(sql, s.token);
      await expect(getUserBySession(sql, s.token)).resolves.toBeNull();
    });
  });
});