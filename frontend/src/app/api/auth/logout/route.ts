import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { run } from "@/lib/db";
import { originAllowed } from "@/lib/origin";
import {
  SHARED_COOKIE,
  LEGACY_COOKIE,
  readLegacySessionToken,
  clearCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — 吊销旧存储型会话行 + 清两代 cookie（共享 + legacy） */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "来源不被信任" }, { status: 403 });
  }
  // 只有旧存储型 token 在 sessions 表里有行、删了才真失效；共享 JWT 是无状态签名，
  // 从不写该表，对它 DELETE 永远命中 0 行（真正的登出能力见 auth.ts 文件头说明）。
  const legacy = readLegacySessionToken(req);
  if (legacy) {
    await deleteSession((q, ...p) => run(q, ...p), legacy).catch((e) =>
      console.error("[auth/logout]", e)
    );
  }
  const res = NextResponse.json({ ok: true });
  // 注意：清 cookie 只让**本浏览器**失去凭证；30 天内 token 的副本在别处仍可用，
  // 「清掉即全局登出」不成立（需两边共用吊销存储，本轮未做）。
  res.cookies.set(SHARED_COOKIE, "", clearCookieOptions());
  res.cookies.set(LEGACY_COOKIE, "", clearCookieOptions());
  return res;
}
