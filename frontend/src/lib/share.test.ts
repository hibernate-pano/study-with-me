import { describe, it, expect } from "vitest";
import { encodeShare, decodeShare, readReportCode } from "./share";

describe("share 编解码", () => {
  it("中文报告 roundtrip 无损", () => {
    const md = `## 🎯 一句话定义\n这是**一个**概念\n\n## 📌 核心重点\n要点1、要点2`;
    expect(decodeShare(encodeShare(md))).toBe(md);
  });

  it("长中文报告 roundtrip（模拟完整 8 模块）", () => {
    const base = `## 🎯 一句话定义\n定义内容${"很".repeat(30)}\n\n`;
    const big = Array.from(
      { length: 8 },
      (_, i) => `## 模块${i}\n${base}内容${i}${"深".repeat(40)}\n`
    ).join("");
    const encoded = encodeShare(big);
    expect(encoded.length).toBeLessThan(big.length); // 有压缩收益
    expect(decodeShare(encoded)).toBe(big);
  });

  it("空串编解码", () => {
    expect(decodeShare(encodeShare(""))).toBe("");
  });

  it("损坏数据返回空串", () => {
    expect(decodeShare("!!!not-valid!!!")).toBe("");
    expect(decodeShare("%E0%A4%A")).toBe("");
  });
});

describe("readReportCode", () => {
  it("无 location 时返回空（SSR 安全）", () => {
    // vitest node 环境没有 window.location.hash，应为空
    expect(readReportCode()).toBe("");
  });
});