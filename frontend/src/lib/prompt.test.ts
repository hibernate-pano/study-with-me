import { describe, it, expect } from "vitest";
import { buildPrompt, buildComparePrompt } from "./prompt";

describe("buildComparePrompt", () => {
  const p = buildComparePrompt("乐观锁", "悲观锁");

  it("包含对比专属的 8 个模块标题", () => {
    for (const t of [
      "## ⚖️ 一句话辨析",
      "## 📌 五个关键差异",
      "## 📍 各自适合的场景",
      "## ⚠️ 最容易混淆的地方",
      "## 🧩 如何协同使用",
      "## 🌐 知识网络（辨析视角）",
      "## 📚 推荐资料",
    ]) {
      expect(p).toContain(t);
    }
  });

  it("嵌入了两个概念名", () => {
    expect(p).toContain("乐观锁");
    expect(p).toContain("悲观锁");
  });
});

describe("buildPrompt", () => {
  it("标准深挖提示词不受对比模块影响", () => {
    const p = buildPrompt("X");
    expect(p).toContain("## 🎯 一句话定义");
    expect(p).not.toContain("一句话辨析");
  });
});