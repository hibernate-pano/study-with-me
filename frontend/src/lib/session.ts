/**
 * 会话 cookie 约定 —— 单点登录版。
 *
 * 全局凭证：共享 JWT（cookie 名 tts_session，生产环境 Domain=.panbo.space），
 * 与 topic-talkshow 的 api/_lib/session.js 完全同一格式（HS256 / payload.userId）。
 * 两边任一 OAuth 回调都种这个 cookie → 登录任意一边，另一边即刻免登。
 *
 * cd_session 是旧的存储型会话 cookie（D1 sessions 表），仅保留读取兼容，
 * 让已登录用户的旧会话自然过渡；新登录不再产生它。
 */

export const SHARED_COOKIE = "tts_session";
export const LEGACY_COOKIE = "cd_session";

/** 兼容旧引用名（callback 路由使用） */
export const SESSION_COOKIE = SHARED_COOKIE;

export const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 天

const IS_PROD = process.env.NODE_ENV === "production";
const DOMAIN_ATTR = IS_PROD ? ".panbo.space" : undefined;

/** 解析整份 cookie 头成 map（同名去重取后值，与浏览器行为一致） */
function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k) out[k] = part.slice(idx + 1);
  }
  return out;
}

/** 共享凭证优先，旧会话兜底 */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const cookies = parseCookies(header);
  return cookies[SHARED_COOKIE] || cookies[LEGACY_COOKIE] || null;
}

/** NextResponse.cookies.set 用的一组属性 */
export function sharedCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: IS_PROD,
    path: "/",
    maxAge,
    ...(DOMAIN_ATTR ? { domain: DOMAIN_ATTR } : {}),
  };
}

/** 清除两代会话 cookie 的属性组（maxAge=0） */
export function clearCookieOptions() {
  return sharedCookieOptions(0);
}
