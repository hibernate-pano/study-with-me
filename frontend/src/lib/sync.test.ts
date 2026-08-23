import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initCloudSync } from "./sync";
import { clearAllLocalData, saveReport, putCard, setCloudPusher } from "./storage";
import { newCard } from "./cards";

/**
 * 首次登录合并上传：云端空 + 本地有数据 → 全量推一次。
 * /api/auth/me 与 /api/sync 都用 mock fetch 模拟。
 */

function mockFetchRoutes(opts: {
  meUser?: { id: number; login: string; avatar_url: string | null } | null;
  cloudReports?: unknown[];
  cloudCards?: unknown[];
  syncPosts?: Array<{ reports?: unknown[]; cards?: unknown[] }>;
}) {
  const posts: Array<{ reports?: unknown[]; cards?: unknown[] }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) {
      return new Response(JSON.stringify({ user: opts.meUser ?? null }), { status: 200 });
    }
    if (url.endsWith("/api/sync")) {
      if ((init?.method ?? "GET") === "GET") {
        return new Response(
          JSON.stringify({ reports: opts.cloudReports ?? [], cards: opts.cloudCards ?? [] }),
          { status: 200 }
        );
      }
      const body = JSON.parse(String(init?.body)) as { reports?: unknown[]; cards?: unknown[] };
      posts.push(body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, posts };
}

const REPORT = {
  key: "本地旧概念",
  term: "本地旧概念",
  fullText: "# 旧报告",
  related: [],
  createdAt: 1,
  updatedAt: 1,
};

describe("initCloudSync 首次登录合并上传", () => {
  beforeEach(async () => {
    await clearAllLocalData();
    setCloudPusher(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("未登录：不拉取、不上传", async () => {
    const { posts } = mockFetchRoutes({ meUser: null });
    const r = await initCloudSync();
    expect(r.user).toBeNull();
    expect(posts).toHaveLength(0);
  });

  it("登录 + 云端空 + 本地有报告 → 全量推一次", async () => {
    // 预写本地数据（登录前产生的）
    await saveReport({ ...REPORT });
    const { posts } = mockFetchRoutes({ meUser: { id: 1, login: "j", avatar_url: null } });

    const r = await initCloudSync();
    expect(r.user?.login).toBe("j");
    expect(posts).toHaveLength(1);
    expect(posts[0].reports).toHaveLength(1);
    expect(posts[0].reports?.[0]).toMatchObject({ key: "本地旧概念", term: "本地旧概念" });
  });

  it("登录 + 云端空 + 本地有卡片 → 卡片一并上传", async () => {
    const card = newCard("本地旧概念", { question: "什么是X?", answer: "答案" }, 1);
    await putCard(card);
    const { posts } = mockFetchRoutes({ meUser: { id: 1, login: "j", avatar_url: null } });

    await initCloudSync();
    expect(posts[0].cards ?? []).toHaveLength(1);
    expect(posts[0].cards?.[0]).toMatchObject({ key: card.key, question: "什么是X?" });
  });

  it("登录 + 云端已有数据 → 不再全量上传（避免覆盖）", async () => {
    await saveReport({ ...REPORT });
    const { posts } = mockFetchRoutes({
      meUser: { id: 1, login: "j", avatar_url: null },
      cloudReports: [{ key: "云端已有", term: "云端已有", full_text: "x", related: [], created_at: 1, updated_at: 1 }],
    });

    const r = await initCloudSync();
    expect(r.user?.login).toBe("j");
    expect(posts).toHaveLength(0); // 云端非空 → 跳过全量上传
  });

  it("登录 + 云端空 + 本地空 → 不上传", async () => {
    const { posts } = mockFetchRoutes({ meUser: { id: 1, login: "j", avatar_url: null } });
    await initCloudSync();
    expect(posts).toHaveLength(0);
  });

  it("失败后队列保留，下次启动补推（不丢数据）", async () => {
    await saveReport({ ...REPORT });
    // 第一次登录：云端空、本地有 → 首次合并上传（先成功清库，模拟"推送失败"较难，
    // 直接验证核心语义：队列里的数据在下次启动会再推）
    // 先推一次成功
    const { posts, fetchMock } = mockFetchRoutes({ meUser: { id: 1, login: "j", avatar_url: null } });
    await initCloudSync();
    expect(posts).toHaveLength(1);

    // 模拟"写入后没等防抖就关页面 → 队列滞留"：
    // 直接向 localStorage 写一条（等价于 debouncedPush 已持久化但页面关闭）
    const pendingBefore = localStorage.getItem("cd_pending_sync");
    // 通过触发一次写操作，立即取队列（不等待 3s 防抖）：
    // 我们无法直接调用未导出的 debouncedPush，这里模拟闭包后的行为：
    // 直接注入一个 pending 任务到 localStorage，再"重新打开页面"
    localStorage.setItem(
      "cd_pending_sync",
      JSON.stringify({
        reports: [{ key: "队列残留报告", term: "队列残留报告", parent_term: null, relation_type: null, full_text: "x", related: [] }],
        cards: [],
        deleteReports: [],
        deleteCards: [],
      })
    );

    // 模拟新会话（重新 init）→ 应补推残留队列
    const { posts: posts2 } = mockFetchRoutes({ meUser: { id: 1, login: "j", avatar_url: null }, cloudReports: [{ key: "已有", term: "已有", full_text: "y", related: [], created_at: 1, updated_at: 1 }] });
    await initCloudSync();
    const pendingKeys = posts2.flatMap((p) => (p.reports ?? []).map((r) => (r as { key: string }).key));
    expect(pendingKeys).toContain("队列残留报告");
    // 补推后队列应清空
    expect(localStorage.getItem("cd_pending_sync")).toBeNull();
  });

  it("失败回填：推送失败后队列保留可重试", async () => {
    await saveReport({ ...REPORT });
    // 首次合并上传失败
    const failFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return new Response(JSON.stringify({ user: { id: 1, login: "j", avatar_url: null } }), { status: 200 });
      }
      if (url.endsWith("/api/sync")) {
        if ((init?.method ?? "GET") === "GET") {
          return new Response(JSON.stringify({ reports: [], cards: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", failFetch);
    await initCloudSync();
    // 失败后，待推队列应保留在 localStorage（供下次重试）
    const leftover = localStorage.getItem("cd_pending_sync");
    expect(leftover).not.toBeNull();
    const parsed = JSON.parse(leftover!);
    expect(parsed.reports[0].key).toBe("本地旧概念");
  });
});