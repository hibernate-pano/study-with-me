import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubUser,
  oauthConfig,
  randomToken,
  upsertUserFromGithub,
  createSharedSession,
  getUserBySession,
  deleteSession,
} from "./auth";
import { sharedCookieOptions, clearCookieOptions, readSessionToken } from "./session";

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

  describe("会话（共享 JWT + 内存 DB 模拟）", () => {
    // 极简内存"数据库"模拟用户行 / legacy sessions
    const memSql = (() => {
      const users = new Map<
        number,
        { id: number; github_id: number; login: string; avatar_url: string | null }
      >();
      const sessions = new Map<string, { token: string; user_id: number; expires_at: string }>();
      let nextUserId = 1;
      return {
        users,
        sessions,
        async run(q: string, ...params: unknown[]): Promise<unknown> {
          if (q.startsWith("INSERT INTO users")) {
            const [githubId, login] = params as [number, string];
            const existing = [...users.values()].find((u) => u.github_id === githubId);
            const user = existing
              ? existing
              : {
                  id: nextUserId++,
                  github_id: githubId as number,
                  login: login as string,
                  avatar_url: null,
                };
            if (!existing) users.set(user.id, user);
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
          if (q.includes("FROM users WHERE github_id")) {
            const [ghId] = params as [number];
            const u = [...users.values()].find((x) => x.github_id === ghId);
            return u ? [{ id: u.id, login: u.login, avatar_url: u.avatar_url }] : [];
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

    it("共享 JWT 凭证：首次跨应用登录自动落用户行并可取回身份", async () => {
      // 用户只在 talkshow 登录过，这里凭 token 首次出现 —— 不需要手动 OAuth
      const session = await createSharedSession({
        userId: "9527",
        login: "panbo",
        name: "Panbo",
        avatarUrl: "a.png",
      });
      expect(session.token.split(".")).toHaveLength(3); // header.payload.signature
      const me = await getUserBySession(sql, session.token);
      expect(me?.login).toBe("panbo");
      expect(memSql.users.size).toBe(1); // 自动落行，无需本地 OAuth
    });

    it("无效/过期/空 token 返回 null", async () => {
      await expect(getUserBySession(sql, "nope")).resolves.toBeNull();
      await expect(getUserBySession(sql, null)).resolves.toBeNull();
      await expect(getUserBySession(sql, undefined)).resolves.toBeNull();
      // 篡改 payload 中段一个字符（避开 base64url 末字符低 2 bit 不参与解码的歧义，
      // 那样可能字节级空操作导致测试间歇性红）
      const token = (await createSharedSession({ userId: "1" })).token;
      const [h, p, s] = token.split(".");
      const mid = Math.floor(p.length / 2);
      const tampered = p[mid] === "Q" ? "A" : "Q"; // 与原字符至少差 bit 4，解码字节必变
      const forged = [h, p.slice(0, mid) + tampered + p.slice(mid + 1), s].join(".");
      expect(forged).not.toBe(token);
      await expect(getUserBySession(sql, forged)).resolves.toBeNull(); // 签名篡改必拒
    });

    it("callback 签发 → getUserBySession 往返：GitHub id 语义一致，取回同一行且不插幽灵行", async () => {
      // 回归 P0：callback 签发 JWT 曾误用 D1 内部自增 id（user.id），
      // 而 getUserBySession 按 github_id（GitHub 全局数字 id）反查 → 永远查不到，
      // 自动插幽灵用户行，同步数据落错行。
      // 这里让 D1 内部 id 与 GitHub id 刻意错开（gh.id=5000 → 内部 id=1），
      // 复刻 callback 签发逻辑：upsert → 用 String(ghUser.id) 签发 → 反查。
      const gh = { id: 5000, login: "panbo", avatar_url: "a.png", email: null };
      const sizeBefore = memSql.users.size;
      const user = await upsertUserFromGithub(sql, gh);
      expect(user.id).not.toBe(gh.id); // D1 内部自增 id ≠ GitHub id
      const session = await createSharedSession({
        userId: String(gh.id), // callback 修复后的语义（非 String(user.id)）
        login: gh.login,
        name: null,
        avatarUrl: gh.avatar_url,
      });
      const me = await getUserBySession(sql, session.token);
      expect(me).not.toBeNull();
      expect(me!.id).toBe(user.id); // 取回同一行（内部 id 一致）
      expect(me!.login).toBe(gh.login);
      expect(memSql.users.size).toBe(sizeBefore + 1); // 只多 upsert 的那一行，无幽灵行
    });

    it("legacy 存储型 token（过渡兼容）仍可解析并在登出后失效", async () => {
      const gh = await upsertUserFromGithub(sql, { id: 9, login: "bye", avatar_url: null, email: null });
      // 手工种一行未过期的 legacy 会话
      await sql(
        `INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)`,
        "legacy-token",
        gh.id,
        String(Date.now() + 86400000)
      );
      await expect(getUserBySession(sql, "legacy-token")).resolves.not.toBeNull();
      await deleteSession(sql, "legacy-token");
      await expect(getUserBySession(sql, "legacy-token")).resolves.toBeNull();
    });

    it("cookie 约定：生产环境 Domain=.panbo.space，本地不带 Domain；共享凭证优先于 legacy", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
      const prod = await import("./session");
      expect(prod.sharedCookieOptions().domain).toBe(".panbo.space");
      expect(prod.sharedCookieOptions().secure).toBe(true);
      vi.stubEnv("NODE_ENV", "development");
      vi.resetModules();
      const dev = await import("./session");
      expect(dev.sharedCookieOptions().domain).toBeUndefined();
      expect(dev.clearCookieOptions().maxAge).toBe(0);

      // 读取优先级：tts_session 在前
      const req = new Request("https://x.dev", {
        headers: { cookie: `${dev.SHARED_COOKIE}=shared.jwt; ${dev.LEGACY_COOKIE}=old` },
      });
      expect(readSessionToken(req)).toBe("shared.jwt");
      const reqLegacyOnly = new Request("https://x.dev", {
        headers: { cookie: `${dev.LEGACY_COOKIE}=old` },
      });
      expect(readSessionToken(reqLegacyOnly)).toBe("old");
    });
  });
});