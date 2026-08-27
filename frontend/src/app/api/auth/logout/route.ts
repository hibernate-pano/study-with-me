import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { run } from "@/lib/db";
import {
  SHARED_COOKIE,
  LEGACY_COOKIE,
  readSessionToken,
  clearCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — 删旧会话行 + 清两代 cookie（共享 + legacy） */
export async function POST(req: NextRequest) {
  const token = readSessionToken(req);
  if (token) {
    await deleteSession((q, ...p) => run(q, ...p), token).catch((e) =>
      console.error("[auth/logout]", e)
    );
  }
  const res = NextResponse.json({ ok: true });
  // 共享 JWT 无服务端状态；清掉即全局登出（talkshow 同步失效）
  res.cookies.set(SHARED_COOKIE, "", clearCookieOptions());
  res.cookies.set(LEGACY_COOKIE, "", clearCookieOptions());
  return res;
}