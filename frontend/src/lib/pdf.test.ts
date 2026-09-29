import { describe, expect, it } from "vitest";
import { buildPageRangeText, normalizePageRange } from "./pdf";

describe("normalizePageRange", () => {
  it("限制在真实页码范围并纠正反向选择", () => {
    expect(normalizePageRange(12, 3, 10)).toEqual({ start: 3, end: 10 });
    expect(normalizePageRange(0, 99, 10)).toEqual({ start: 1, end: 10 });
  });
});

describe("buildPageRangeText", () => {
  it("保留页码标记，让模型能为题目标注来源", () => {
    const text = buildPageRangeText(
      ["第一页内容", "第二页内容", "第三页内容"],
      2,
      3
    );
    expect(text).toContain("[第 2 页]");
    expect(text).toContain("第二页内容");
    expect(text).toContain("[第 3 页]");
    expect(text).not.toContain("第一页内容");
  });
});
