/**
 * 「Origin 白名单只有一处实现」的两道护栏。
 *
 * 缺陷单里的原话是：logout 加了守卫、sync 没加，两个端点守卫不一致——
 * 「典型的维护陷阱：下一个人照着 logout 改一半就以为都覆盖了」。
 * 也就是说这条缺陷的根因不是「sync 少写了一个 if」，而是**同一个判定在两处各写一遍**
 * （或者压根只写一处）却没有契约钉住。
 *
 * 所以这里不重复测 originAllowed 的取值矩阵（那是 @/lib/origin 的单测职责），
 * 而是测两个更上游的性质：
 *
 *   1. 行为差分：同一批 Origin，同时打 sync POST 和 logout POST，两个路由必须给出
 *      **完全相同的状态码**。任何一个来源让两者分叉，就是守卫又分叉了。
 *      （修复前：sync 无守卫、logout 有 → 「https://attacker.example」上两者 200/403 分叉，
 *        这条用例直接红。）
 *   2. 结构契约：两个路由都必须从 @/lib/origin 取同一个判定，谁都不许内联一份。
 *      行为差分管「现在一致」，结构契约管「明天不会因为复制粘贴又分叉」。
 *
 * 只覆盖这两个带共享 cookie 的写端点：/api/repo、/api/exam 那些是 AI 推理入口，
 * 不属于「盲写/盲删用户数据」这一类，守卫职责不同，硬拉进来只会造出永远红的用例。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => ({
  getUserBySession: vi.fn(async () => ({ id: 7, login: "jasper" })),
  deleteSession: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth", () => ({
  getUserBySession: h.getUserBySession,
  deleteSession: h.deleteSession,
}));
vi.mock("@/lib/db", () => ({
  run: vi.fn(async () => []),
  fetchAll: vi.fn(async () => ({ reports: [], cards: [] })),
  upsertReport: vi.fn(async () => {}),
  upsertCard: vi.fn(async () => {}),
  deleteReport: vi.fn(async () => {}),
  deleteCard: vi.fn(async () => {}),
}));

const syncRoute = await import("./sync/route");
const logoutRoute = await import("./auth/logout/route");

const ORIGIN = "https://studywithme.panbo.space";

function req(urlPath: string, origin: string | null): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    cookie: "tts_session=jwt",
  };
  if (origin !== null) headers.origin = origin;
  return new NextRequest(`${ORIGIN}${urlPath}`, { method: "POST", headers, body: "{}" });
}

/** 一个报告都不带：这里只关心「来源判定」，不掺任何业务字段 */
const syncReq = (origin: string | null) => req("/api/sync", origin);
const logoutReq = (origin: string | null) => req("/api/auth/logout", origin);

const MATRIX: Array<[string, string | null]> = [
  ["同源生产域", ORIGIN],
  ["共享 cookie 所在的兄弟应用", "https://topic-talkshow.panbo.space"],
  ["兄弟域里的深层子域", "https://a.b.panbo.space"],
  ["完全跨站", "https://attacker.example"],
  ["缺 Origin（curl / 脚本）", null],
  ["Origin 不是 URL", "not-a-url"],
  ["缺前导点的后缀仿冒", "https://evilpanbo.space"],
  ["把真域放在路径里的仿冒", "https://panbo.space.attacker.example"],
  ["userinfo 骗法", "https://studywithme.panbo.space@attacker.example"],
  ["同 host 不同端口", "https://studywithme.panbo.space:8443"],
];

beforeEach(() => {
  h.getUserBySession.mockClear();
  h.deleteSession.mockClear();
  h.getUserBySession.mockResolvedValue({ id: 7, login: "jasper" } as never);
});

describe("写路由的 Origin 守卫：sync 与 logout 必须同进同出", () => {
  for (const [label, origin] of MATRIX) {
    it(`${label} → sync POST 与 logout POST 的判定一致`, async () => {
      const [sync, logout] = await Promise.all([syncRoute.POST(syncReq(origin)), logoutRoute.POST(logoutReq(origin))]);
      expect(
        sync.status,
        `Origin=${String(origin)}：sync 判 ${sync.status}、logout 判 ${logout.status}，守卫又分叉了`
      ).toBe(logout.status);
    });
  }

  it("不可信来源下两个路由都拒，且 sync 连会话都不读", async () => {
    const sync = await syncRoute.POST(syncReq("https://attacker.example"));
    expect(sync.status).toBe(403);
    expect(h.getUserBySession).not.toHaveBeenCalled();

    const logout = await logoutRoute.POST(logoutReq("https://attacker.example"));
    expect(logout.status).toBe(403);
    expect(h.deleteSession).not.toHaveBeenCalled();
  });

  it("同源下两个路由都放行（别为了堵 CSRF 把正常写入一起堵死）", async () => {
    expect((await syncRoute.POST(syncReq(ORIGIN))).status).toBe(200);
    expect((await logoutRoute.POST(logoutReq(ORIGIN))).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 结构契约：判定只有一份，且不把服务端逻辑拖进客户端包
// ---------------------------------------------------------------------------

const API_DIR = import.meta.dirname; // src/app/api
const SYNC_SRC = path.join(API_DIR, "sync", "route.ts");
const LOGOUT_SRC = path.join(API_DIR, "auth", "logout", "route.ts");
const ORIGIN_SRC = path.join(API_DIR, "..", "..", "lib", "origin.ts");

function read(file: string): string {
  expect(fs.existsSync(file), `前置条件：文件应存在 ${file}`).toBe(true);
  return fs.readFileSync(file, "utf8");
}

describe("结构契约：Origin 判定只有 @/lib/origin 一处实现", () => {
  it("sync POST 与 logout POST 都从 @/lib/origin 取同一个 originAllowed", () => {
    for (const file of [SYNC_SRC, LOGOUT_SRC]) {
      const src = read(file);
      expect(src, `${file} 应 import { originAllowed } from "@/lib/origin"`).toMatch(
        /import\s*\{[^}]*originAllowed[^}]*\}\s*from\s*"@\/lib\/origin"/
      );
      expect(src, `${file} 应真的调用 originAllowed(req)`).toMatch(/originAllowed\(\s*req\s*\)/);
    }
  });

  it("两个路由都不许内联读 Origin 头（复制一份就等于又分叉一次）", () => {
    for (const file of [SYNC_SRC, LOGOUT_SRC]) {
      expect(read(file), `${file} 不该自己读 origin 头`).not.toMatch(/get\(\s*["']origin["']\s*\)/);
    }
  });

  it("sync 的守卫排在 requireUser 之前：来源不可信时不该去读会话", () => {
    const src = read(SYNC_SRC);
    // 只看 POST 处理器内部：GET 里也有一次 requireUser（那是读路径，本就该走）
    const postAt = src.indexOf("export async function POST");
    expect(postAt, "sync 应仍导出 POST").toBeGreaterThan(-1);
    const body = src.slice(postAt);
    const guardAt = body.indexOf("originAllowed(req)");
    const authAt = body.indexOf("requireUser(req)");
    expect(guardAt, "POST 里应调用 originAllowed(req)").toBeGreaterThan(-1);
    expect(authAt, "POST 里应调用 requireUser(req)").toBeGreaterThan(-1);
    expect(guardAt, "originAllowed 必须排在 requireUser 前面").toBeLessThan(authAt);
  });

  it("@/lib/origin 不 import session.ts / next 头，保持 server-only、可被路由单独复用", () => {
    const src = read(ORIGIN_SRC);
    expect(src, "origin.ts 不该依赖 session.ts").not.toMatch(/from\s*"@\/lib\/session"/);
    expect(src, "origin.ts 不该依赖 next/headers").not.toMatch(/from\s*"next\/headers"/);
  });
});
