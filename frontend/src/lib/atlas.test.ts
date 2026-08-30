import { describe, it, expect } from "vitest";
import { extractAtlasJson, parseAtlas } from "./atlas";

const good = `前置废话

\`\`\`json
{
  "pitch": "一个学习工具",
  "stats": { "stars": 1200, "language": "TypeScript", "topics": ["edu"] },
  "why": ["亮点一"],
  "modules": [
    { "id": "core", "name": "核心", "dir": "src/core/", "role": "干核心的活", "keyFiles": ["src/core/index.ts"], "talksTo": ["api"], "questions": ["核心怎么动？"] },
    { "id": "api", "name": "接口层", "dir": "src/api/", "role": "接请求" }
  ],
  "path": [
    { "moduleId": "api", "title": "先看入口", "goal": "弄懂请求进来后去哪" },
    { "moduleId": "ghost", "title": "坏站", "goal": "指向不存在的模块，应被丢弃" }
  ]
}
\`\`\`

结尾废话`;

describe("extractAtlasJson", () => {
  it("从围栏块提取 JSON", () => {
    expect(extractAtlasJson(good)).toContain('"pitch"');
  });
  it("无围栏时取首尾大括号", () => {
    expect(extractAtlasJson('x {"a":1} y')).toBe('{"a":1}');
  });
  it("没有 JSON 返回 null", () => {
    expect(extractAtlasJson("完全不是 json")).toBeNull();
  });
});

describe("parseAtlas", () => {
  it("解析完整地图：path 里的坏 moduleId 被丢弃", () => {
    const a = parseAtlas(good);
    expect(a).not.toBeNull();
    expect(a!.pitch).toBe("一个学习工具");
    expect(a!.modules).toHaveLength(2);
    expect(a!.stats?.stars).toBe(1200);
    expect(a!.path).toHaveLength(1);
    expect(a!.path[0].moduleId).toBe("api");
  });

  it("降级容错：单个坏模块被跳过，其余保留", () => {
    const partial = '```json\n{"pitch":"p","modules":[{"id":"a","name":"A","role":"r"},{"id":"b","name":"B"},{"id":"a","name":"重复id"}]}```';
    const a = parseAtlas(partial);
    expect(a).not.toBeNull();
    expect(a!.modules.map((m) => m.id)).toEqual(["a"]);
  });

  it("全部模块都坏 → null", () => {
    expect(parseAtlas('```json\n{"pitch":"p","modules":[{"id":"b","name":"B"}]}```')).toBeNull();
  });

  it("缺 pitch 或 modules 为空 → null", () => {
    expect(parseAtlas('```json\n{"modules": []}\n```')).toBeNull();
    expect(parseAtlas('```json\n{"pitch":"x"}\n```')).toBeNull();
  });

  it("模块缺 id/name/role → null", () => {
    const bad = '```json\n{"pitch":"p","modules":[{"id":"a","name":"A"}]}\n```';
    expect(parseAtlas(bad)).toBeNull();
  });

  it("非 JSON 文本 → null", () => {
    expect(parseAtlas("模型胡言乱语")).toBeNull();
  });
});
