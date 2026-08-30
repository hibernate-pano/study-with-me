import { NextRequest, NextResponse } from "next/server";
import {
  createSharedSession,
  exchangeCodeForToken,
  fetchGithubUser,
  oauthConfig,
  upsertUserFromGithub,
} from "@/lib/auth";
import { run } from "@/lib/db";
import { SHARED_COOKIE, LEGACY_COOKIE, sharedCookieOptions } from "@/lib/session";

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

    // 单点登录：身份声明随身签进共享 JWT（tts_session，Domain=.panbo.space），
    // topic-talkshow 拿同一个 cookie 即可免登；反之亦然。
    // 注意：userId 必须用 GitHub 全局数字 id（ghUser.id），与 talkshow 签发的 JWT
    // 及 getUserBySession 的 WHERE github_id 查询语义一致；
    // user.id 是 D1 内部自增 id，用它会导致会话反查失败并插出幽灵用户行。
    const session = await createSharedSession({
      userId: String(ghUser.id),
      login: user.login,
      name: null,
      avatarUrl: user.avatar_url,
    });

    const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
    // 清掉 state cookie + 旧会话 cookie，种下 30 天共享会话
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(LEGACY_COOKIE, "", sharedCookieOptions(0));
    res.cookies.set(SHARED_COOKIE, session.token, sharedCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/callback]", e);
    return NextResponse.redirect(new URL(`/?auth=error`, req.nextUrl.origin));
  }
}