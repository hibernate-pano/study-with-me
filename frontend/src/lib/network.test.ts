import { describe, it, expect } from "vitest";
import {
  parseNetworkMarkdown,
  flattenGroups,
  type FlatConcept,
} from "./network";

describe("parseNetworkMarkdown", () => {
  it("解析标准 5 个分组（前置/兄弟/后继/对立/类比）", () => {
    const md = `
### 前置知识
- **概念A** — 这是概念A的描述
- **概念B** — 这是概念B的描述

### 兄弟概念
- **概念C** — 描述C

### 后继深入
- **概念D** — 描述D

### 对立
- **概念E** — 描述E

### 跨领域类比
- **概念F** — 描述F
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups).toHaveLength(5);
    expect(groups.map((g) => g.label)).toEqual([
      "前置知识",
      "兄弟概念",
      "后继深入",
      "对立",
      "跨领域类比",
    ]);
    expect(groups[0].concepts).toHaveLength(2);
    expect(groups[0].concepts[0].name).toBe("概念A");
  });

  it("清洗 description 里的内联 **加粗**", () => {
    const md = `
### 前置知识
- **概念A** — 这是一个**关键**的描述
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].concepts[0].description).toBe("这是一个关键的描述");
    // name 本身的 ** 已被处理为干净文本
    expect(groups[0].concepts[0].name).toBe("概念A");
  });

  it("清洗 description 里的内联 `代码`", () => {
    const md = `
### 兄弟概念
- **Foo** — 看 \`someCode\` 怎么用
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].concepts[0].description).toBe("看 someCode 怎么用");
  });

  it("支持多种列表符号（-, *, 1.）", () => {
    const md = `
### 兄弟概念
- **A** — dash
* **B** — star
1. **C** — number
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].concepts.map((c) => c.name)).toEqual(["A", "B", "C"]);
  });

  it("剥离分隔符（:, ;, —, 中文标点）", () => {
    const md = `
### 前置知识
- **A**：中文冒号
- **B**, 中文逗号
- **C**；中文分号
- **D**—中文破折号
- **E**—英文破折号
`;
    const groups = parseNetworkMarkdown(md);
    const descs = groups[0].concepts.map((c) => c.description);
    expect(descs).toEqual([
      "中文冒号",
      "中文逗号",
      "中文分号",
      "中文破折号",
      "英文破折号",
    ]);
  });

  it("空 markdown 返回空数组", () => {
    expect(parseNetworkMarkdown("")).toEqual([]);
    expect(parseNetworkMarkdown("   \n\n  ")).toEqual([]);
  });

  it("没有 ### 分组时不创建「其他」分组（fail-fast：提示词要求 5 个分组）", () => {
    const md = `
- **漂泊概念** — 没有任何分组
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups).toEqual([]);
  });

  it("过滤没有 **加粗** 概念名的条目", () => {
    const md = `
### 前置知识
- 没加粗的条目
- **真名** — 描述
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].concepts).toHaveLength(1);
    expect(groups[0].concepts[0].name).toBe("真名");
  });

  it("过滤空的分组", () => {
    const md = `
### 前置知识
- **A** — desc

### 兄弟概念
- 这行没有加粗概念
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("前置知识");
  });

  it("concept 自带分组元信息（FlatConcept 字段）", () => {
    const md = `
### 兄弟概念
- **A** — descA
`;
    const groups = parseNetworkMarkdown(md);
    const c = groups[0].concepts[0] as FlatConcept;
    expect(c.relationType).toBe("兄弟概念");
    expect(c.groupLabel).toBe("兄弟概念");
    expect(c.color).toBeTruthy();
  });

  it("分组标题里的副标题（中文括号）", () => {
    const md = `
### 前置知识（必先掌握）
- **A** — desc
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].label).toBe("前置知识");
    expect(groups[0].subtitle).toBe("必先掌握");
  });

  it("分组标题里的副标题（英文括号）", () => {
    const md = `
### 兄弟概念 (similar concepts)
- **A** — desc
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].subtitle).toBe("similar concepts");
  });

  it("模糊匹配支持同义关键词（先决条件 → 前置知识）", () => {
    const md = `
### 先决条件
- **A** — desc
`;
    const groups = parseNetworkMarkdown(md);
    expect(groups[0].type).toBe("前置知识");
  });
});

describe("flattenGroups", () => {
  it("把所有分组的概念平铺", () => {
    const md = `
### 前置知识
- **A** — a
- **B** — b
### 兄弟概念
- **C** — c
`;
    const groups = parseNetworkMarkdown(md);
    const flat = flattenGroups(groups);
    expect(flat).toHaveLength(3);
    expect(flat.map((c) => c.name)).toEqual(["A", "B", "C"]);
  });

  it("每个 concept 都带正确的 groupLabel 与 color", () => {
    const md = `
### 前置知识
- **A** — desc
### 兄弟概念
- **B** — desc
`;
    const groups = parseNetworkMarkdown(md);
    const flat = flattenGroups(groups);
    expect(flat[0].groupLabel).toBe("前置知识");
    expect(flat[1].groupLabel).toBe("兄弟概念");
    expect(flat[0].color).not.toBe(flat[1].color);
  });
});