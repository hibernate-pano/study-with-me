import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  selectFiles,
  clamp,
  treePreview,
  buildDigest,
  parseRepoParam,
  rankPathList,
  pickModuleFiles,
  fetchRepoMeta,
  fetchReadme,
  fetchTree,
  fetchRawFile,
  fetchModuleDigest,
  ingestRepo,
  ingestRepoCached,
  GitHubFetchError,
} from "./github";

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

/* ==========================================================================
 * 抓取层回归：私有仓库红线 / 失败必须冒泡 / 资源必须有界
 *
 * 这一组全部用 fetch stub 驱动，不发真实网络请求。断言的写法有个刻意的偏好：
 * 泄漏类问题不能只断言「没把内容返回」，必须断言「压根没发这个请求」——
 * 否则「请求发了但结果被丢掉」这种半吊子修复也能蒙混过关。
 * ========================================================================== */

const jsonRes = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

const publicMeta = (fullName: string) => ({
  full_name: fullName,
  description: "一个用来验证抓取管线的示例仓库",
  stargazers_count: 128,
  language: "TypeScript",
  topics: ["notes", "study"],
  default_branch: "main",
  homepage: null,
  private: false,
});

const privateMeta = (fullName: string) => ({ ...publicMeta(fullName), private: true });

/** 记录所有出站请求 URL 的 fetch stub */
function recordingFetch(handler: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  const mock = vi.fn(async (input: unknown, _init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    return handler(url);
  });
  vi.stubGlobal("fetch", mock);
  return { urls, mock };
}

/** 把 reject 的值捞出来断言（比 rejects.toThrow 报错信息更可读） */
async function capture(p: Promise<unknown>): Promise<any> {
  return p.then(
    () => null,
    (e: unknown) => e
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("私有仓库红线（README / 目录树 / 源码一律不得外泄）", () => {
  it("fetchRepoMeta 见到 private=true 立即拒绝", async () => {
    recordingFetch((url) => (url.endsWith("/repos/acme-corp/notes-internal") ? jsonRes(privateMeta("acme-corp/notes-internal")) : jsonRes({})));

    const err = await capture(fetchRepoMeta("acme-corp", "notes-internal"));
    expect(err, "私有仓库必须被拒绝").not.toBeNull();
    expect(err).toBeInstanceOf(GitHubFetchError);
    expect(err.reason).toBe("private");
  });

  it("ingestRepo 遇到私有库：只发元信息一个请求，README 与目录树端点零请求", async () => {
    // handler 里一旦被问到 readme / trees 就直接抛：真发生了就是泄漏，不是断言没写好
    const { urls } = recordingFetch((url) => {
      if (url.endsWith("/repos/acme-corp/payroll")) return jsonRes(privateMeta("acme-corp/payroll"));
      if (url.includes("/readme")) return jsonRes({ content: Buffer.from("内部薪酬系统的设计文档……").toString("base64") });
      if (url.includes("/git/trees/")) return jsonRes({ tree: [{ path: "src/salaries.ts", size: 900, type: "blob" }] });
      throw new Error(`不该被调用的请求：${url}`);
    });

    const err = await capture(ingestRepo("acme-corp", "payroll"));
    expect(err, "私有仓库必须被拒绝").not.toBeNull();
    expect(err.reason).toBe("private");
    // 核心断言：整个流程只允许问一次「这个库是不是私有的」
    expect(urls, "私有仓库的 README / 目录树请求一个都不该发出").toEqual(["https://api.github.com/repos/acme-corp/payroll"]);
  });

  it("fetchModuleDigest 遇到私有库：同样在抓树之前就拒绝", async () => {
    const { urls } = recordingFetch((url) => {
      if (url.endsWith("/repos/acme-corp/payroll")) return jsonRes(privateMeta("acme-corp/payroll"));
      if (url.includes("/git/trees/")) return jsonRes({ tree: [{ path: "src/salaries.ts", size: 900, type: "blob" }] });
      throw new Error(`不该被调用的请求：${url}`);
    });

    const err = await capture(fetchModuleDigest("acme-corp", "payroll", ["src/salaries.ts"], "src"));
    expect(err, "私有仓库必须被拒绝").not.toBeNull();
    expect(err.reason).toBe("private");
    expect(urls).toEqual(["https://api.github.com/repos/acme-corp/payroll"]);
  });
});

describe("抓取失败必须冒泡（不得静默降级成「空仓库」喂给模型）", () => {
  it("配额耗尽必须抛 GitHubFetchError(quota) 并带上 Retry-After", async () => {
    recordingFetch((url) => {
      if (url.endsWith("/repos/quota-org/quota-repo")) return jsonRes(publicMeta("quota-org/quota-repo"));
      if (url.includes("/readme"))
        return new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "137" } });
      return jsonRes({ tree: [] });
    });

    const err = await capture(ingestRepo("quota-org", "quota-repo"));
    expect(err, "配额耗尽不能被吞成空 README").not.toBeNull();
    expect(err).toBeInstanceOf(GitHubFetchError);
    expect(err.reason).toBe("quota");
    expect(err.status).toBe(403);
    expect(err.retryAfter, "Retry-After 必须回传，客户端才知道多久后再试").toBe(137);
  });

  it("目录树 5xx 必须冒泡（空路径清单会让模型编造 keyFiles 并落库）", async () => {
    recordingFetch((url) => {
      if (url.endsWith("/repos/flaky-org/flaky-repo")) return jsonRes(publicMeta("flaky-org/flaky-repo"));
      if (url.includes("/readme")) return new Response("boom", { status: 502 });
      return jsonRes({ tree: [] });
    });

    const err = await capture(ingestRepo("flaky-org", "flaky-repo"));
    expect(err, "readme 的 5xx 不能被吞").not.toBeNull();
    expect(err.reason).toBe("http");
    expect(err.status).toBe(502);
  });

  it("网络层失败（DNS / 超时 / 连接中断）必须冒泡为 network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (String(input).endsWith("/repos/offline-org/offline-repo")) return jsonRes(publicMeta("offline-org/offline-repo"));
        throw new TypeError("fetch failed");
      })
    );

    const err = await capture(ingestRepo("offline-org", "offline-repo"));
    expect(err, "网络异常不能被吞成空仓库").not.toBeNull();
    expect(err).toBeInstanceOf(GitHubFetchError);
    expect(err.reason).toBe("network");
    expect(err.status).toBeUndefined();
  });

  it("GitHub 返回非 JSON 时必须冒泡为 parse", async () => {
    recordingFetch((url) => {
      if (url.endsWith("/repos/garbage-org/garbage-repo")) return jsonRes(publicMeta("garbage-org/garbage-repo"));
      return new Response("<html>gateway</html>", { status: 200 });
    });

    const err = await capture(ingestRepo("garbage-org", "garbage-repo"));
    expect(err).not.toBeNull();
    expect(err.reason).toBe("parse");
  });

  it("README 404 是合法空（仓库确实没文档），不能因此让整个仓库 422", async () => {
    recordingFetch((url) => (url.includes("/readme") ? new Response("Not Found", { status: 404 }) : jsonRes({ content: "" })));

    const readme = await fetchReadme("acme", "no-readme-repo");
    expect(readme, "无 README 应返回空串而不是抛错").toBe("");
  });

  it("README 500 必须抛（区别于 404：这是故障，不是「本来就没 README」）", async () => {
    recordingFetch(() => new Response("server exploded", { status: 500 }));

    const err = await capture(fetchReadme("acme", "broken-readme-repo"));
    expect(err).not.toBeNull();
    expect(err).toBeInstanceOf(GitHubFetchError);
    expect(err.reason).toBe("http");
    expect(err.status).toBe(500);
  });
});

describe("目录树被 GitHub 截断（truncated）必须如实上报", () => {
  const truncatedTree = (fullName: string) => (url: string) => {
    if (url.endsWith(`/repos/${fullName}`)) return jsonRes(publicMeta(fullName));
    if (url.includes("/readme")) return jsonRes({ content: Buffer.from("## 项目说明").toString("base64") });
    // GitHub 对 recursive=1 的超限仓库按字母序砍尾，并置 truncated=true
    return jsonRes({
      truncated: true,
      tree: [
        { path: "Documentation", size: 0, type: "tree" },
        { path: "Documentation/hacking.rst", size: 3000, type: "blob" },
      ],
    });
  };

  it("fetchTree 必须把 truncated 标志透出来（旧返回类型里根本没这个字段）", async () => {
    recordingFetch(truncatedTree("torvalds/linux"));
    const res = await fetchTree("torvalds", "linux", "master");
    expect(res.truncated).toBe(true);
    expect(res.files.map((f) => f.path)).toEqual(["Documentation", "Documentation/hacking.rst"]);
  });

  it("ingestRepo 把 truncated 传成 partial=true", async () => {
    recordingFetch(truncatedTree("torvalds/linux-partial"));
    const out = await ingestRepo("torvalds", "linux-partial");
    expect(out.partial).toBe(true);
  });

  it("partial 结果不入 15 分钟缓存（否则用户重试拿到的还是同一份残缺清单）", async () => {
    const { urls } = recordingFetch(truncatedTree("torvalds/linux-cache"));

    const first = await ingestRepoCached("torvalds", "linux-cache");
    const second = await ingestRepoCached("torvalds", "linux-cache");
    expect(first.partial).toBe(true);
    expect(second.partial).toBe(true);
    expect(second.cached, "残缺结果绝不能命中缓存").toBe(false);
    // 两次都真抓 → 目录树端点被问了两次
    expect(urls.filter((u) => u.includes("/git/trees/")).length).toBe(2);
  });

  it("完整结果照常进缓存（对照组：证明上一条不是因为缓存本身没生效）", async () => {
    const { urls } = recordingFetch((url) => {
      if (url.endsWith("/repos/acme/healthy-repo")) return jsonRes(publicMeta("acme/healthy-repo"));
      if (url.includes("/readme")) return jsonRes({ content: Buffer.from("## 说明").toString("base64") });
      return jsonRes({ truncated: false, tree: [{ path: "src/index.ts", size: 120, type: "blob" }] });
    });

    const first = await ingestRepoCached("acme", "healthy-repo");
    const second = await ingestRepoCached("acme", "healthy-repo");
    expect(first.partial).toBe(false);
    expect(second.cached).toBe(true);
    expect(urls.filter((u) => u.includes("/git/trees/")).length).toBe(1);
  });
});

describe("资源必须有界（大文件不能靠 clamp 事后补救）", () => {
  it("fetchRawFile 必须带 Range，只取头部 20KB；206 Partial Content 视为成功", async () => {
    const { mock } = recordingFetch(() => new Response("export const a = 1;", { status: 206 }));

    const text = await fetchRawFile("acme", "notes", "main", "src/index.ts");
    expect(text, "raw 支持 Range，返回 206 应当被当作成功").toBe("export const a = 1;");

    const init = mock.mock.calls[0][1];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Range, "必须用 Range 把单文件物化量钉死").toMatch(/^bytes=0-/);
    const end = Number(headers.Range.replace("bytes=0-", ""));
    expect(end, "物化量上限必须 ≤ 20000 字节").toBeLessThanOrEqual(20_000);
  });

  it("fetchRawFile 对 404 仍然抛错（Range 不是绕过状态码的理由）", async () => {
    recordingFetch(() => new Response("Not Found", { status: 404 }));
    const err = await capture(fetchRawFile("acme", "notes", "main", "src/missing.ts"));
    expect(err).not.toBeNull();
  });

  it("pickModuleFiles 剔除非代码扩展名与超大文件（keyFiles 来自客户端/模型，不可信）", () => {
    const tree = [
      fake("src/app.ts", 5_000),
      fake("data/rockyou.txt", 53 * 1024 * 1024), // 53MB 字典，光 clamp(3500) 拦不住
      fake("lib/big.ts", 900 * 1024), // 超过单文件深读上限
      fake("docs/notes.md", 3_000), // 不是代码
    ];
    const picked = pickModuleFiles(["data/rockyou.txt", "lib/big.ts", "docs/notes.md", "src/app.ts"], tree, "");
    expect(picked).toEqual(["src/app.ts"]);
  });

  it("pickModuleFiles 路径穿越仍然被拒", () => {
    const tree = [fake("src/app.ts", 5_000), fake("src/evil.ts", 5_000)];
    const picked = pickModuleFiles(["../../etc/passwd", "src/../src/app.ts", "src/app.ts"], tree, "");
    expect(picked).toEqual(["src/app.ts"]);
  });

  it("树里查不到体积时保留 keyFiles 兜底（不能因为校验不了就把整份清单丢光）", () => {
    const picked = pickModuleFiles(["src/a.ts", "src/b.ts"], [], "");
    expect(picked).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("真实路径清单 rankPathList（喂给模型选 keyFiles，防编造）", () => {
  it("按可读性排序，字母序靠后的 monorepo 入口文件也能挤进前 200 条", () => {
    // GitHub 的 recursive=1 按字母序返回：arch/* 排在前面，packages/* 被砍到 200 条之外
    const files = [
      ...Array.from({ length: 200 }, (_, i) => fake(`arch/${String(i).padStart(3, "0")}/Kconfig`, 800)),
      fake("packages/core/index.ts", 4_200),
      fake("packages/cli/main.ts", 3_100),
    ];
    const out = rankPathList(files, 200);
    expect(out, "packages/* 必须出现在清单里，否则模型只能编造这些路径").toContain("packages/core/index.ts");
    expect(out).toContain("packages/cli/main.ts");
  });

  it("清单里的路径必须过体积与二进制过滤（清单里有 1.4MB 文件，模型就会写进 keyFiles）", () => {
    const files = [fake("src/huge.ts", 1.4 * 1024 * 1024), fake("src/logo.png", 5_000), fake("src/ok.ts", 2_000)];
    const out = rankPathList(files, 200);
    expect(out).toContain("src/ok.ts");
    expect(out).not.toContain("src/huge.ts");
    expect(out).not.toContain("src/logo.png");
  });

  it("「其余 N 个」按过滤后的数量算，不是过滤前的 tree.length", () => {
    // 3 个因体积/二进制被剔除，真实可用 5 个；max=2 → 其余 3 个，不是 8-2=6
    const files = [
      fake("src/huge.ts", 2 * 1024 * 1024),
      fake("src/logo.png", 5_000),
      fake("dist/bundle.min.js", 9_000),
      ...Array.from({ length: 5 }, (_, i) => fake(`src/mod-${i}.ts`, 3_000)),
    ];
    const out = rankPathList(files, 2);
    expect(out).toContain("其余 3 个文件略");
  });
});

describe("GITHUB_TOKEN 配置文档", () => {
  const envExample = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "..", ".env.example"), "utf8");

  it(".env.example 必须列出 GITHUB_TOKEN（照文档配环境的人只会看这个文件）", () => {
    expect(envExample).toMatch(/^GITHUB_TOKEN=/m);
  });

  it(".env.example 必须写明 token 要 fine-grained 且不给 repository scope", () => {
    expect(envExample).toContain("Fine-grained");
    expect(envExample, "必须明确要求不给 repository scope").toMatch(/不要勾|不要\s*repository scope|不给任何\s*repository/i);
  });
});