import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, oauthConfig, randomToken } from "@/lib/auth";
import { sessionCookie, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

/** state 校验用短时 cookie（10 分钟），防 CSRF。 */
const STATE_COOKIE_MAX_AGE = 10 * 60;

/**
 * GET /api/auth/github
 * 跳转 GitHub 授权页。state 写入短时 cookie 供回调校验。
 */
export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const { clientId } = oauthConfig(origin);
    const state = randomToken(16);
    const redirectUri = `${origin}/api/auth/callback`;
    const url = buildAuthorizeUrl(clientId, state, redirectUri);
    const res = NextResponse.redirect(url);
    res.cookies.set("cd_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: `OAuth 配置错误：${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}