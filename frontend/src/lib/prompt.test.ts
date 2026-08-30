import { describe, it, expect } from "vitest";
import { buildPrompt, buildComparePrompt, buildRepoAtlasPrompt, buildRepoModulePrompt, buildModuleAtlasPrompt, buildModuleFollowUpPrompt } from "./prompt";

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

describe("buildRepoAtlasPrompt", () => {
  const p = buildRepoAtlasPrompt("# panbo/x\nREADME……", "src/index.ts\nsrc/core.ts");

  it("要求输出 JSON 代码块且声明了完整 schema 字段", () => {
    expect(p).toContain("```json");
    for (const t of ["pitch", "stats", "why", "modules", "talksTo", "keyFiles", "questions", "path", "goal"]) {
      expect(p).toContain(t);
    }
  });

  it("嵌入真实路径清单，要求 keyFiles 只能从中选（防编造）", () => {
    expect(p).toContain("真实文件路径清单");
    expect(p).toContain("src/index.ts");
    expect(p).toContain("逐字");
  });

  it("嵌入代码上下文并截断极长输入", () => {
    const long = buildRepoAtlasPrompt("x".repeat(20000), "a.ts");
    expect(long).toContain("项目代码上下文");
    expect(long.length).toBeLessThan(22000);
  });

  it("模块深挖 prompt 要求摘录标注来源文件路径（可核对原文）", () => {
    const m = buildRepoModulePrompt({
      repoName: "panbo/x",
      moduleName: "核心",
      dir: "src/",
      role: "r",
      talksToNames: [],
      filesDigest: "code",
    });
    expect(m).toContain("来源文件路径");
  });

  it("模块内部地图 prompt：与项目地图同 schema，但要求内部视角", () => {
    const m = buildModuleAtlasPrompt({ repoName: "panbo/x", moduleName: "核心", dir: "src/", role: "r", filesDigest: "### src/index.ts\ncode" });
    expect(m).toContain("```json");
    expect(m).toContain("内部");
    expect(m).toContain("src/index.ts");
    expect(m).toContain("talksTo");
  });

  it("追问 prompt：嵌入原报告与追问，禁止复读", () => {
    const m = buildModuleFollowUpPrompt({ repoName: "panbo/x", moduleName: "核心", priorReport: "## 📖 位置\n讲解正文", question: "为什么不用正则？" });
    expect(m).toContain("为什么不用正则？");
    expect(m).toContain("讲解正文");
    expect(m).toContain("不要重复讲解");
  });
});