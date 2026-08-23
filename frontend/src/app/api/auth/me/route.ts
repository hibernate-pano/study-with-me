import { NextRequest, NextResponse } from "next/server";
import { getUserBySession } from "@/lib/auth";
import { run } from "@/lib/db";
import { readSessionToken } from "@/lib/session";

export const runtime = "nodejs";

/** GET /api/auth/me — 返回当前登录用户（未登录 → null） */
export async function GET(req: NextRequest) {
  const user = await getUserBySession(
    (q, ...p) => run(q, ...p),
    readSessionToken(req)
  ).catch((e) => {
    console.error("[auth/me]", e);
    return null;
  });
  return NextResponse.json({ user });
}