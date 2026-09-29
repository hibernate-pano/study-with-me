/**
 * POST /api/repo/module 回归：GitHub 抓取失败必须变成可操作的 HTTP 状态。
 *
 * 特别守「不能一律改写成请稍后重试」：配额耗尽要 429 + Retry-After，
 * 私有仓库要 422（重试多少次都没用），其余抓取故障才走兜底 422。
 *
 * 同样用真实 @/lib/github + stub 全局 fetch，不 mock github 模块（否则 instanceof 走不到）。
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
      return new Response('data: {"choices":[{"delta":{"content":"## 走读报告"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    })
  );
  return urls;
}

const post = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/repo/module", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/repo/module 的 GitHub 抓取失败处理", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_API_KEY;
  });

  it("私有仓库返回 422，且不会把源码请求发出去", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/acme-corp/payroll")) return jsonRes({ ...publicMeta("acme-corp/payroll"), private: true });
      if (url.includes("/git/trees/")) return jsonRes({ tree: [{ path: "src/salary.ts", size: 900, type: "blob" }] });
      if (url.startsWith("https://raw.githubusercontent.com/")) return new Response("export const salary = 1;", { status: 206 });
      throw new Error(`不该被调用的请求：${url}`);
    });

    const { POST } = await import("./route");
    const res = await POST(post({ term: "acme-corp/payroll", name: "薪酬结算", dir: "src" }));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "不支持私有仓库，请提供公开仓库地址。" });
    expect(urls, "私有仓库的源码请求一个都不该发出").toEqual(["https://api.github.com/repos/acme-corp/payroll"]);
  });

  it("配额耗尽返回 429 并回传 Retry-After", async () => {
    process.env.AI_API_KEY = "test-key";
    // 配额耗尽发生在元信息那一步（一次深挖的头几个请求就会撞上）
    stubFetch(() => new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "137" } }));

    const { POST } = await import("./route");
    const res = await POST(post({ term: "quota-org/quota-repo", name: "核心模块", dir: "src" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("137");
    expect((await res.json() as { error: string }).error).toContain("配额");
  });

  it("元信息 5xx 走兜底 422，且不得当成配额问题（别让客户端按 429 空转重试）", async () => {
    process.env.AI_API_KEY = "test-key";
    stubFetch(() => new Response("bad gateway", { status: 502 }));

    const { POST } = await import("./route");
    const res = await POST(post({ term: "flaky-org/flaky-repo", name: "核心模块", dir: "src" }));

    expect(res.status).toBe(422);
    expect(res.headers.get("Retry-After"), "非配额故障不该带 Retry-After").toBeNull();
  });

  // 已知缺口：fetchModuleDigest 对目录树那一步仍是 .catch(() => EMPTY_TREE)（为了让 keyFiles
  // 有体积兜底而刻意保留的），所以「配额耗尽发生在抓树时」这条路径依然会被降级成
  // 「未能抓到源码文件」并继续调模型。用 it.fails 钉住现状：修好之后这条会反过来报错，
  // 那正是我们要的信号。
  it.fails("缺口：配额耗尽发生在目录树那一步时，仍被静默降级成「未能抓到源码文件」并继续调模型", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/quota-org/tree-quota-repo")) return jsonRes(publicMeta("quota-org/tree-quota-repo"));
      return new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "137" } });
    });

    const { POST } = await import("./route");
    const res = await POST(post({ term: "quota-org/tree-quota-repo", name: "核心模块", dir: "src" }));

    expect(urls.some((u) => u.includes("minimaxi")), "抓取其实失败了，不该继续烧 AI token").toBe(false);
    expect(res.status, "抓取失败必须如实报错，而不是伪装成「这个模块没源码」").toBe(429);
  });

  it("超大 keyFiles 被体积上限挡下（rockyou.txt 这种几十 MB 文件不能进 raw）", async () => {
    process.env.AI_API_KEY = "test-key";
    const urls = stubFetch((url) => {
      if (url.endsWith("/repos/acme/notes")) return jsonRes(publicMeta("acme/notes"));
      if (url.includes("/git/trees/"))
        return jsonRes({
          truncated: false,
          tree: [
            { path: "data/rockyou.txt", size: 53 * 1024 * 1024, type: "blob" },
            { path: "src/app.ts", size: 5_000, type: "blob" },
          ],
        });
      return new Response("export const app = 1;", { status: 206 });
    });

    const { POST } = await import("./route");
    const res = await POST(post({ term: "acme/notes", name: "主模块", keyFiles: ["data/rockyou.txt", "src/app.ts"] }));

    expect(res.status).toBe(200);
    expect(urls.some((u) => u.includes("rockyou")), "53MB 的文件不得被拉下来").toBe(false);
    expect(urls.some((u) => u.includes("src/app.ts"))).toBe(true);
  });
});
