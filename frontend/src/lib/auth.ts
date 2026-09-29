/**
 * GitHub OAuth + 会话管理的纯逻辑部分（与 Next.js 路由解耦，便于测试）。
 *
 * 流程：
 * 1. 生成 authorize URL（带随机 state，防 CSRF）；
 * 2. 回调：code 换 access_token → 调 GitHub API 取最小用户信息；
 * 3. 会话：签发共享 HS256 JWT（与 topic-talkshow 同密钥/同格式），HttpOnly cookie 持有。
 *
 * 安全约定：
 * - access_token 只用于换取用户身份，用后即弃，永不落库；
 * - state 用短时 cookie 校验（10 分钟）；
 * - 会话 30 天过期；
 * - 共享 JWT 无服务端状态：不写 sessions 表、也没有吊销表，所以登出只能清 cookie，
 *   30 天内的 token 副本在别处仍可用（跨应用全局吊销需两边共用吊销存储或
 *   短寿命 access token + 可吊销 refresh token，属跨应用架构改造）。
 */

import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_USER = "https://api.github.com/user";

export interface GithubUserInfo {
  id: number;
  login: string;
  avatar_url: string | null;
  email: string | null;
}

/**
 * 服务端配置缺一不可（启动即校验，防误部署）。
 *
 * GitHub OAuth App 只允许登记一个回调地址，而本项目有本地与线上两套入口，
 * 所以支持可选的 DEV 双 key：本地（localhost/127.0.0.1/::1）优先用
 * GITHUB_CLIENT_ID(_SECRET)_DEV 那组 App（回调填 http://localhost:3000/api/auth/callback），
 * 未配 DEV 则回退主 key；线上始终用主 key（回调填 https://<生产域名>/api/auth/callback）。
 */
export function oauthConfig(origin?: string) {
  const isLocal =
    !!origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  const clientId = isLocal
    ? (process.env.GITHUB_CLIENT_ID_DEV ?? process.env.GITHUB_CLIENT_ID)
    : process.env.GITHUB_CLIENT_ID;
  const clientSecret = isLocal
    ? (process.env.GITHUB_CLIENT_SECRET_DEV ?? process.env.GITHUB_CLIENT_SECRET)
    : process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 未配置");
  }
  return { clientId, clientSecret };
}

/** 生成 16 字节随机 hex（state / 会话 token 共用） */
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

/** 构造 GitHub 授权跳转 URL */
export function buildAuthorizeUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/** 用 code 换 access_token；失败抛错 */
export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  if (!res.ok) throw new Error(`GitHub token 换取失败（${res.status}）`);
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`GitHub token 换取失败: ${data.error ?? "无 token"}`);
  return data.access_token;
}

/** 取 GitHub 用户最小信息（id / login / avatar / email） */
export async function fetchGithubUser(token: string): Promise<GithubUserInfo> {
  const res = await fetch(GITHUB_API_USER, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "concept-digger" },
  });
  if (!res.ok) throw new Error(`GitHub 用户信息获取失败（${res.status}）`);
  const data = (await res.json()) as Partial<GithubUserInfo>;
  if (typeof data.id !== "number" || typeof data.login !== "string") {
    throw new Error("GitHub 返回的用户信息不完整");
  }
  // 只挑最小字段，剩下的（bio/location/followers…）全部丢弃
  return {
    id: data.id,
    login: data.login,
    avatar_url: data.avatar_url ?? null,
    email: data.email ?? null,
  };
}

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/* ---------- 共享 JWT（与 topic-talkshow 同格式：HS256 / payload.userId） ---------- */

function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET 必须在生产环境配置（需与 topic-talkshow 一致）");
    }
    // 与 talkshow 的 dev 默认值一致：本地两端口共享 cookie 后直接互通
    return new TextEncoder().encode("dev-only-do-not-use-in-prod");
  }
  return new TextEncoder().encode(raw);
}

export interface SessionClaims {
  userId: string; // GitHub 全局数字 id 的字符串形式（talkshow 原样）
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
}

/** 签发跨应用共享会话 token（身份声明随身携带，另一边零 DB 依赖可验） */
export async function createSharedSession(
  claims: SessionClaims
): Promise<{ token: string }> {
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
  return { token };
}

/** 验共享 token，返回声明；无效/过期 → null */
async function verifySharedSession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.userId == null) return null;
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

/** 根据 GitHub 用户 upsert 本地用户行，返回用户记录（id / login / avatar） */
export async function upsertUserFromGithub(
  sql: (q: string, ...params: unknown[]) => Promise<unknown>,
  gh: GithubUserInfo
): Promise<{ id: number; login: string; avatar_url: string | null; email: string | null }> {
  const params = [gh.id, gh.login, gh.avatar_url, gh.email, Date.now()];
  try {
    const rows = (await sql(
      `INSERT INTO users (github_id, login, avatar_url, email, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT (github_id) DO UPDATE SET
       login = excluded.login,
       avatar_url = excluded.avatar_url,
       email = COALESCE(excluded.email, users.email),
       updated_at = excluded.updated_at
     RETURNING id, login, avatar_url, email`,
      ...params
    )) as { id: number; login: string; avatar_url: string | null; email: string | null }[];
    return rows[0];
  } catch (e) {
    // 线上库若仍是旧 schema（login UNIQUE），GitHub 用户名被回收后 A 改名、B 接管同名，
    // 这条 upsert 撞的是 login 唯一约束——ON CONFLICT 只声明了 github_id，撞 login 时不生效。
    // 退化为「只更新资料、保留旧显示名」：被抢名者安静地用旧名，但登录不再直接失败。
    const rows = (await sql(
      `UPDATE users SET avatar_url = ?2, email = COALESCE(?3, email), updated_at = ?4
     WHERE github_id = ?1
     RETURNING id, login, avatar_url, email`,
      ...params
    )) as { id: number; login: string; avatar_url: string | null; email: string | null }[];
    if (!rows[0]) {
      // 连 github_id 都没有行（首次登录就撞名），无法凭空造一行，交给调用方报错
      console.error("[auth] 用户名被他人占用且本账号无用户行:", e);
      throw new Error(`GitHub 用户名 ${gh.login} 已被占用，无法落库`);
    }
    return rows[0];
  }
}

/**
 * 会话解析（单点登录版）：
 * 1. 共享 JWT 有效 → 取身份声明；用户行不存在则自动落一行（首次跨应用登录）；
 * 2. 否则按旧存储型 token 查 D1 sessions（过渡兼容，过期/不存在 → null）。
 */
export async function getUserBySession(
  sql: (q: string, ...params: unknown[]) => Promise<unknown>,
  token: string | undefined | null
): Promise<{ id: number; login: string; avatar_url: string | null } | null> {
  if (!token) return null;
  const claims = await verifySharedSession(token);
  if (claims) {
    const ghId = Number(claims.userId);
    if (!Number.isFinite(ghId)) return null;
    try {
      // 这句 INSERT 是 SSO 的一部分，不能挪走：用户只在 talkshow 登录过时，
      // 这里首次出现要自动落一行。旧 schema 的 login UNIQUE 可能让它撞约束
      // （新 github_id + 被他人占用的显示名），包一层 catch 保住读路径本身。
      await sql(
        `INSERT INTO users (github_id, login, avatar_url, email, created_at, updated_at)
       SELECT ?1, ?2, ?3, NULL, ?4, ?4
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE github_id = ?1)`,
        ghId,
        claims.login ?? "github-user",
        claims.avatarUrl ?? null,
        Date.now()
      );
    } catch (e) {
      // 落行失败不致命：下面按 github_id（真正的主键）反查，已有行照常取回
      console.error("[auth] 首次落用户行失败:", e);
    }
    const rows = (await sql(
      `SELECT id, login, avatar_url FROM users WHERE github_id = ?1`,
      ghId
    )) as { id: number; login: string; avatar_url: string | null }[];
    return rows[0] ?? null;
  }
  const rows = (await sql(
    `SELECT u.id, u.login, u.avatar_url
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?1 AND s.expires_at > ?2`,
    token,
    Date.now()
  )) as { id: number; login: string; avatar_url: string | null }[];
  return rows[0] ?? null;
}

/** 删除会话（登出） */
export async function deleteSession(
  sql: (q: string, ...params: unknown[]) => Promise<unknown>,
  token: string
): Promise<void> {
  await sql(`DELETE FROM sessions WHERE token = ?1`, token);
}