/**
 * POST /api/repo 回归：GitHub 抓取的失败必须变成用户看得懂的 HTTP 状态，
 * 而不是「空仓库 → 继续调模型 → 模型编造 keyFiles → 落库」。
 *
 * 用真实 @/lib/github（只 stub 全局 fetch），不 mock github 模块：
 * mock 掉就会丢失 GitHubFetchError 的类身份，route 里的 instanceof 分支根本走不到，
 * 那正是这套断言要守的东西。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getUserBySession: vi.fn(async () => null) }));
vi.mock("@/lib/db", () => ({ run: vi.fn(async () => []) }));
vi.mock("@/lib/rateLimit", () => ({
  aiAccess: vi.fn(async () => ({ allowed: true })),
  rateLimitedResponse: vi.fn(() => new Response("limited", { status: 429 })),
}));

const jsonRes = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

const publicMeta = (fullName: string) => ({
  full_name: fullName,
  description: "一个用来验证抓取管线的示例仓库",
  stargazers_count: 128,
  language: "TypeScript",
  topics: ["notes"],
  default_branch: "main",
  homepage: null,
  private: false,
});

/** 按 URL 分流：GitHub API / raw / 上游 AI 三个来源各走各的，顺带记录出站请求 */
function stubFetch(github: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      urls.push(url);
      if (url.startsWith("https://api.github.com/") || url.startsWith("https://raw.githubusercontent.com/")) {
        return github(url);
      }
      // 上游 AI：一段最小可用的 SSE
      return new Response('data: {"choices":[{"delta":{"content":"```json"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    })
  );
  return urls;
}

const post = (term: string) =>
  new Request("http://localhost/api/repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term }),
  });

describe("POST /api/repo 的 GitHub 抓取失败处理", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_API_KEY;
  });

  it("私有仓库返回 422，且只发过元信息一个请求（README / 目录树不得外泄给 AI 服务）", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/acme-corp/payroll"))
        return jsonRes({ ...publicMeta("acme-corp/payroll"), private: true });
      if (url.includes("/readme")) return jsonRes({ content: Buffer.from("内部薪酬系统设计").toString("base64") });
      if (url.includes("/git/trees/")) return jsonRes({ tree: [{ path: "src/salary.ts", size: 900, type: "blob" }] });
      throw new Error(`不该被调用的请求：${url}`);
    });

    const { POST } = await import("./route");
    const res = await POST(post("acme-corp/payroll"));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "不支持私有仓库，请提供公开仓库地址。" });
    expect(urls, "私有仓库的 README / 目录树请求一个都不该发出").toEqual(["https://api.github.com/repos/acme-corp/payroll"]);
    expect(urls.some((u) => u.includes("minimaxi")), "被拒的请求不得触达第三方 AI").toBe(false);
  });

  it("配额耗尽返回 429 并回传 Retry-After（不能一律改写成「请稍后重试」让客户端空转）", async () => {
    process.env.AI_API_KEY = "test-key";
    stubFetch((url) => {
      if (url.endsWith("/repos/quota-org/quota-repo")) return jsonRes(publicMeta("quota-org/quota-repo"));
      return new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "137" } });
    });

    const { POST } = await import("./route");
    const res = await POST(post("quota-org/quota-repo"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After"), "客户端要知道多久后再试").toBe("137");
    expect((await res.json() as { error: string }).error).toContain("配额");
  });

  it("目录树被 GitHub 截断返回 502，且不调用模型（残缺路径清单会让模型编造 keyFiles）", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/torvalds/linux-truncated")) return jsonRes(publicMeta("torvalds/linux-truncated"));
      if (url.includes("/readme")) return jsonRes({ content: Buffer.from("## Linux").toString("base64") });
      // GitHub 对超大仓库按字母序砍尾：真实路径全在字母序靠后的位置，被砍光了
      return jsonRes({ truncated: true, tree: [{ path: "Documentation", size: 0, type: "tree" }] });
    });

    const { POST } = await import("./route");
    const res = await POST(post("torvalds/linux-truncated"));

    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toContain("截断");
    expect(urls.some((u) => u.includes("minimaxi")), "抓取不完整时不得继续烧 AI token").toBe(false);
  });

  it("仓库确实没有 README（404）是正常路径，不该被当成抓取失败", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/acme/no-readme-repo")) return jsonRes(publicMeta("acme/no-readme-repo"));
      if (url.includes("/readme")) return new Response("Not Found", { status: 404 });
      if (url.includes("/git/trees/")) return jsonRes({ truncated: false, tree: [{ path: "src/index.ts", size: 120, type: "blob" }] });
      return new Response("export const a = 1;", { status: 206 });
    });

    const { POST } = await import("./route");
    const res = await POST(post("acme/no-readme-repo"));

    expect(res.status, "无 README 的公开仓库应当正常走完 AI 管线").toBe(200);
    expect(urls.some((u) => u.includes("minimaxi")), "应当真的调到模型").toBe(true);
  });

  it("喂给模型的真实路径清单里必须有字母序靠后的 monorepo 顶层目录", async () => {
    // 这条刻意只从「AI 实际收到的 prompt」断言，不碰 github.ts 的内部函数名：
    // 模型看不见的路径对它来说就不存在，prompt 里没有 = 等于没有。
    process.env.AI_API_KEY = "test-key";
    let aiPrompt = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/repos/acme/monorepo")) return jsonRes(publicMeta("acme/monorepo"));
        if (url.includes("/readme")) return jsonRes({ content: Buffer.from("## monorepo").toString("base64") });
        if (url.includes("/git/trees/")) {
          // GitHub 的 recursive=1 按字母序返回：arch/* 挤在前面，packages/* 排在 200 条之外
          return jsonRes({
            truncated: false,
            tree: [
              ...Array.from({ length: 200 }, (_, i) => ({
                path: `arch/${String(i).padStart(3, "0")}/Kconfig`,
                size: 800,
                type: "blob",
              })),
              { path: "packages/core/index.ts", size: 4_200, type: "blob" },
              { path: "packages/cli/main.ts", size: 3_100, type: "blob" },
            ],
          });
        }
        if (url.includes("/chat/completions")) {
          aiPrompt = String((JSON.parse(String(init?.body)) as { messages: { content: string }[] }).messages[1].content);
          return new Response('data: [DONE]\n\n', { status: 200, headers: { "Content-Type": "text/event-stream" } });
        }
        return new Response("export const a = 1;", { status: 206 });
      })
    );

    const { POST } = await import("./route");
    await POST(post("acme/monorepo"));

    // 只截「仓库真实文件路径清单」这一段来断言：这些路径同时可能从 digest 的
    // 「精选核心文件」里漏进来（selectFiles 挑中就会带上 ### 路径），
    // 那样断言整个 prompt 会在旧实现下侥幸通过，守不住排序缺陷本身。
    const listStart = aiPrompt.indexOf("—— 仓库真实文件路径清单 ——");
    const listEnd = aiPrompt.indexOf("—— 输出要求 ——");
    expect(listStart, "prompt 里必须带真实文件路径清单").toBeGreaterThanOrEqual(0);
    const pathList = aiPrompt.slice(listStart, listEnd);
    expect(pathList, "packages/* 必须出现在路径清单里，否则模型只能编造这些路径").toContain("packages/core/index.ts");
    expect(pathList).toContain("packages/cli/main.ts");
  });
});
