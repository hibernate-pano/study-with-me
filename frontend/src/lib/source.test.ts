import { describe, it, expect } from "vitest";
import { parseGithubRef } from "./source";

describe("parseGithubRef", () => {
  it("识别完整 GitHub URL（含/不含协议与 www）并忽略后续路径", () => {
    expect(parseGithubRef("https://github.com/facebook/react")).toEqual({
      owner: "facebook",
      repo: "react",
    });
    expect(parseGithubRef("https://github.com/facebook/react/tree/main/src")).toEqual({
      owner: "facebook",
      repo: "react",
    });
    expect(parseGithubRef("github.com/vercel/next.js#readme")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
    expect(parseGithubRef("www.github.com/panbo/study-with-me.git")).toEqual({
      owner: "panbo",
      repo: "study-with-me",
    });
  });

  it("对非 GitHub 输入返回 null（不把概念误判成仓库）", () => {
    expect(parseGithubRef("分布式锁")).toBeNull();
    expect(parseGithubRef("TCP/IP")).toBeNull();
    expect(parseGithubRef("A/B 测试")).toBeNull();
    expect(parseGithubRef("Kafka")).toBeNull();
  });
});

