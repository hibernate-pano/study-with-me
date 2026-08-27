import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  exchangeCodeForToken,
  fetchGithubUser,
  oauthConfig,
  upsertUserFromGithub,
} from "@/lib/auth";
import { run } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const STATE_COOKIE = "cd_oauth_state";

/**
 * GET /api/auth/callback?code=xxx&state=yyy
 * 1. 校验 state（防 CSRF）；
 * 2. code 换 access_token，取最小用户信息；
 * 3. upsert 用户行，签发 30 天会话，Set-Cookie；
 * 4. 回首页。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // 用户点了"取消授权"
  if (errorParam) {
    return NextResponse.redirect(new URL(`/?auth=denied`, req.nextUrl.origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`/?auth=failed`, req.nextUrl.origin));
  }

  // 校验 state
  const storedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL(`/?auth=state`, req.nextUrl.origin));
  }

  try {
    const { clientId, clientSecret } = oauthConfig(req.nextUrl.origin);
    const token = await exchangeCodeForToken(clientId, clientSecret, code);
    const ghUser = await fetchGithubUser(token);

    const user = await upsertUserFromGithub(
      (q, ...p) => run(q, ...p),
      ghUser
    );
    const session = await createSession(
      (q, ...p) => run(q, ...p),
      user.id
    );

    // 顺手清理过期会话（个人工具零成本维护，防表无限增长）
    await run(`DELETE FROM sessions WHERE expires_at < ?1`, Date.now()).catch(() => {});

    const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
    // 清掉 state cookie，种下 30 天会话 cookie
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    console.error("[auth/callback]", e);
    return NextResponse.redirect(new URL(`/?auth=error`, req.nextUrl.origin));
  }
}