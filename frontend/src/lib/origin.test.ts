/**
 * originAllowed 的判定矩阵 —— 这条守卫同时守着 /api/auth/logout 与 /api/sync 的 POST，
 * 判错任何一格都是「CSRF 能打进来」或「合法写入被自己挡掉」，所以逐格钉死。
 *
 * 顺带钉住两条容易在重构中被改坏的性质：
 *   1. 后缀判定用 `.panbo.space`（带前导点）——写成 "panbo.space" 会被 evilpanbo.space 骗过。
 *   2. 比较的是 host（含端口）——同源不同端口在本地开发必须放行，换端口必须拒绝。
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { originAllowed } from "./origin";

function req(origin: string | null, url = "https://studywithme.panbo.space/api/sync") {
  return new NextRequest(url, {
    method: "POST",
    headers: origin === null ? {} : { origin },
  });
}

describe("originAllowed", () => {
  it("同源放行（生产域名）", () => {
    expect(originAllowed(req("https://studywithme.panbo.space"))).toBe(true);
  });

  it("同源放行（本地开发含端口）", () => {
    expect(originAllowed(req("http://localhost:3000", "http://localhost:3000/api/sync"))).toBe(true);
  });

  it("缺 Origin 一律拒：浏览器对 POST 必带 Origin，缺了只可能是脚本伪造", () => {
    expect(originAllowed(req(null))).toBe(false);
  });

  it("跨站拒绝（Origin 域与请求 host 毫无关系）", () => {
    expect(originAllowed(req("https://evil.example"))).toBe(false);
  });

  it("共享 cookie 所在的 panbo.space 家族放行（SSO 信任域）", () => {
    expect(originAllowed(req("https://topic-talkshow.panbo.space"))).toBe(true);
  });

  it("不能靠后缀骗过：evilpanbo.space / panbo.space.evil.com / 裸 apex 都拒", () => {
    expect(originAllowed(req("https://evilpanbo.space"))).toBe(false);
    expect(originAllowed(req("https://panbo.space.evil.com"))).toBe(false);
    expect(originAllowed(req("https://panbo.space"))).toBe(false);
  });

  it("同 host 不同端口不算同源", () => {
    expect(originAllowed(req("http://localhost:3001", "http://localhost:3000/api/sync"))).toBe(false);
  });

  it("Origin 不是合法 URL 时拒（new URL 抛错分支）", () => {
    expect(originAllowed(req("not-a-url"))).toBe(false);
  });
});
