import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { run } from "@/lib/db";
import { clearSessionCookie, readSessionToken } from "@/lib/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — 删除会话行 + 清 cookie */
export async function POST(req: NextRequest) {
  const token = readSessionToken(req);
  if (token) {
    await deleteSession((q, ...p) => run(q, ...p), token).catch((e) =>
      console.error("[auth/logout]", e)
    );
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}