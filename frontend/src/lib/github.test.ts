import { describe, it, expect } from "vitest";
import { selectFiles, clamp, treePreview, buildDigest, parseRepoParam } from "./github";

const fake = (path: string, size = 1000, type: "blob" | "tree" = "blob"): {
  path: string;
  size: number;
  type: "blob" | "tree";
} => ({ path, size, type });

describe("parseRepoParam", () => {
  it("拆出 owner/repo", () => {
    expect(parseRepoParam("panbo/study-with-me")).toEqual({
      owner: "panbo",
      repo: "study-with-me",
    });
  });
});

describe("selectFiles", () => {
  it("最优先读根层已知清单/配置，其次按深度+体量挑源码", () => {
    const files = [
      fake("package.json", 500),
      fake("LICENSE", 15000),
      fake("src/index.ts", 40000),
      fake("src/util/helper.ts", 8000),
      fake("README.md", 2000),
      fake("lib/some/deep/file.ts", 20000),
    ];
    const picked = selectFiles(files, { max: 6 }).map((f) => f.path);
    // LICENSE 大文件但属于已知根层清单 → 仍排在前面；根层 README.md 属于纯文档，被排除
    expect(picked[0]).toBe("package.json");
    expect(picked).toContain("LICENSE");
    expect(picked).not.toContain("README.md");
    // src/index.ts 应优于深层的 lib/...（深度优先）
    expect(picked.indexOf("src/index.ts")).toBeLessThan(picked.indexOf("lib/some/deep/file.ts"));
  });

  it("排除根层纯文档与噪音文档，但保留子目录文档（模块说明有价值）", () => {
    const files = [
      fake("README.md", 3 * 1024),
      fake("README_ZH.md", 3 * 1024),
      fake("CHANGELOG.md", 90 * 1024),
      fake("ROADMAP.md", 50 * 1024),
      fake("docs/guide.md", 20 * 1024),
      fake("packages/core/README.md", 20 * 1024),
      fake("packages/cli/cli.md", 20 * 1024),
      fake("src/main.ts", 30 * 1024),
    ];
    const picked = selectFiles(files, { max: 8 }).map((f) => f.path);
    expect(picked).toContain("src/main.ts");
    expect(picked).toContain("docs/guide.md");
    expect(picked).toContain("packages/core/README.md");
    expect(picked).not.toContain("README.md");
    expect(picked).not.toContain("README_ZH.md");
    expect(picked).not.toContain("CHANGELOG.md");
    expect(picked).not.toContain("ROADMAP.md");
  });

  it("根层配置过多时封顶 known，其余额度留给源码", () => {
    const files = [
      fake("package.json", 500),
      fake("tsconfig.json", 300),
      fake("vite.config.ts", 400),
      fake("next.config.js", 200),
      fake("LICENSE", 1000),
      fake("src/main.ts", 8000),
    ];
    const picked = selectFiles(files, { maxKnown: 2 }).map((f) => f.path);
    expect(picked.filter((p) => ["package.json", "tsconfig.json", "vite.config.ts", "next.config.js", "LICENSE"].includes(p)).length).toBe(2);
    expect(picked).toContain("src/main.ts");
  });

  it("排除重型/二进制/超大文件", () => {
    const files = [
      fake("node_modules/foo/index.js", 5000),
      fake("dist/bundle.min.js", 3000),
      fake("src/logo.png", 9000),
      fake("src/ok.ts", 5000),
      fake("src/huge.ts", 500 * 1024),
    ];
    const picked = selectFiles(files).map((f) => f.path);
    expect(picked).toEqual(["src/ok.ts"]);
  });

  it("空输入 → 空结果", () => {
    expect(selectFiles([])).toEqual([]);
  });
});

describe("clamp", () => {
  it("超长截断并标注，未超长原样返回", () => {
    expect(clamp("abc", 2)).toBe("ab\n…（已截断）");
    expect(clamp("abc", 5)).toBe("abc");
  });
});

describe("treePreview", () => {
  it("只展示前 2 层，目录带斜杠", () => {
    const files = [
      fake("src", 0, "tree"),
      fake("src/index.ts", 100),
      fake("docs/guide.md", 100),
      fake("src/deep/nested/file.ts", 100),
    ];
    const out = treePreview(files);
    expect(out).toContain("- src/");
    expect(out).toContain("- index.ts");
    expect(out).toContain("- guide.md");
    expect(out).not.toContain("nested"); // 深层文件不进预览
  });
});

describe("buildDigest", () => {
  const meta = {
    full_name: "panbo/study-with-me",
    description: "概念深挖器",
    stargazers_count: 42,
    language: "TypeScript",
    topics: ["education", "llm"],
    homepage: null,
  };

  it("组装元信息 + README + 结构 + 精选文件", () => {
    const contents = new Map([["src/index.ts", "export const x = 1; 很长的内容……"]]);
    const tree = [fake("src", 0, "tree"), fake("src/index.ts", 100), fake("README.md", 50)];
    const digest = buildDigest(meta, "这是一个学习的项目", tree, contents);
    expect(digest).toContain("# panbo/study-with-me");
    expect(digest).toContain("一句话简介：概念深挖器");
    expect(digest).toContain("这是一个学习的项目");
    expect(digest).toContain("## 精选核心文件");
    expect(digest).toContain("### src/index.ts");
    // 没有内容映射的文件不进精选区
    expect(digest).not.toContain("### README.md");
  });

  it("README 超长会被截断", () => {
    const digest = buildDigest(meta, "x".repeat(7000), [], new Map());
    expect(digest.length).toBeLessThan(7000 + 500);
    expect(digest).toContain("已截断");
  });
});