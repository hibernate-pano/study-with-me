/** 会话 cookie 的读写约定（HttpOnly + Secure + SameSite=Lax）。 */

export const SESSION_COOKIE = "cd_session";

export const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 天

export function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds = MAX_AGE_SECONDS): string {
  const secure = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${
    secure ? "; Secure" : ""
  }`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}