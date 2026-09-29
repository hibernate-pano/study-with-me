import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initCloudSync } from "./sync";
import {
  clearAllLocalData,
  deleteReport,
  getCard,
  getReport,
  putCard,
  saveReport,
  setCloudPusher,
  type StoredReport,
} from "./storage";
import { newCard } from "./cards";

/**
 * 云同步链路的静默数据损坏回归测试。
 * 覆盖四个独立的损坏点：
 *   ① 拉取时云端旧版无条件覆盖本地新版（saveReport 丢弃 r.updated_at）
 *   ② 待推队列纯 append → 同一 payload 里 upsert 与 delete 打架 / 跨标签页丢条目
 *   ③ 服务端「先 upsert 后 delete」让过期 delete 获胜
 *   ④ 换 GitHub 账号：队列与本机数据归属错位 → 混数据
 */

const PENDING_KEY = "cd_pending_sync";
const OWNER_KEY = "cd_sync_owner";

interface PostBody {
  reports?: Array<{ key: string }>;
  cards?: Array<{ key: string }>;
  deleteReports?: string[];
  deleteCards?: string[];
}

function mockFetchRoutes(opts: {
  meUser?: { id: number; login: string; avatar_url: string | null } | null;
  cloudReports?: unknown[];
  cloudCards?: unknown[];
}) {
  const posts: PostBody[] = [];
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
      posts.push(JSON.parse(String(init?.body)) as PostBody);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, posts };
}

function makeReport(key: string, updatedAt: number, fullText = `## ${key}`): StoredReport {
  return { key, term: key, fullText, related: [], createdAt: 1, updatedAt };
}

function readPending(): {
  reports: Array<{ key: string }>;
  deleteReports: string[];
  cards: Array<{ key: string }>;
  deleteCards: string[];
  user?: string;
} {
  const raw = localStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw) : { reports: [], deleteReports: [], cards: [], deleteCards: [] };
}

const ALICE = { id: 1, login: "alice", avatar_url: null };
const CLOUD_NONEMPTY = [
  { key: "云端已有", term: "云端已有", full_text: "x", related: [], created_at: 1, updated_at: 1 },
];

beforeEach(async () => {
  setCloudPusher(null);
  localStorage.clear();
  await clearAllLocalData();
  // sync.ts 的内存队列是模块级私有状态，没法从外部重置 → 先跑一次
  // 「云端空 + 本地空 + 已登录」的 init，把上个用例残留在内存里的待推条目
  // drain 掉（推到下面的 mock 上，随用例一起丢弃），否则会串到下一个用例。
  mockFetchRoutes({ meUser: ALICE });
  await initCloudSync();
  setCloudPusher(null);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("① 拉取不静默回滚本地新版", () => {
  it("云端 updated_at 更旧 → 保留本地内容与本地时间戳", async () => {
    await saveReport(makeReport("概念X", 5000, "本地新版"));
    mockFetchRoutes({
      meUser: ALICE,
      cloudReports: [
        { key: "概念X", term: "概念X", full_text: "云端旧版", related: [], created_at: 1, updated_at: 1000 },
      ],
    });

    await initCloudSync();

    const got = (await getReport("概念X"))!;
    expect(got.fullText).toBe("本地新版");
    // 时间戳不能被刷成 now（否则 UI 显示「刚刚更新」+ 旧内容）
    expect(got.updatedAt).toBe(5000);
  });

  it("云端 updated_at 更新 → 覆盖本地，且沿用云端时间戳", async () => {
    await saveReport(makeReport("概念Y", 1000, "本地旧版"));
    mockFetchRoutes({
      meUser: ALICE,
      cloudReports: [
        { key: "概念Y", term: "概念Y", full_text: "云端新版", related: [], created_at: 1, updated_at: 9000 },
      ],
    });

    await initCloudSync();

    const got = (await getReport("概念Y"))!;
    expect(got.fullText).toBe("云端新版");
    expect(got.updatedAt).toBe(9000);
  });

  it("卡片同理：云端更旧的副本不覆盖本地复习进度", async () => {
    const local = { ...newCard("概念Z", { question: "Q?", answer: "A" }, 1), updatedAt: 8000, reps: 3 };
    await putCard(local);
    mockFetchRoutes({
      meUser: ALICE,
      cloudReports: [{ key: "占位", term: "占位", full_text: "x", related: [], created_at: 1, updated_at: 1 }],
      cloudCards: [
        {
          key: local.key,
          term: "概念Z",
          question: "Q?",
          answer: "A",
          due_at: 1,
          interval_days: 0,
          reps: 0,
          status: "new",
          created_at: 1,
          updated_at: 100,
        },
      ],
    });

    await initCloudSync();

    const got = (await getCard(local.key))!;
    expect(got.reps).toBe(3);
    expect(got.updatedAt).toBe(8000);
  });
});

describe("② 待推队列按 key 归并（入队时）", () => {
  it("先写后删：同 key 只留 delete，不同时出现在两个列表", async () => {
    mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();

    await saveReport(makeReport("概念K", 1));
    await deleteReport("概念K");

    const q = readPending();
    expect(q.reports.map((r) => r.key)).toEqual([]);
    expect(q.deleteReports).toEqual(["概念K"]);
  });

  it("先删后写：同 key 只留 upsert（过期的 delete 不能赢）", async () => {
    mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();

    await deleteReport("概念K");
    await saveReport(makeReport("概念K", 1, "重建后的内容"));

    const q = readPending();
    expect(q.deleteReports).toEqual([]);
    expect(q.reports.map((r) => r.key)).toEqual(["概念K"]);
  });

  it("不同 key 互不影响，各自都保留", async () => {
    mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();

    await saveReport(makeReport("A", 1));
    await saveReport(makeReport("B", 1));
    await deleteReport("C");

    const q = readPending();
    expect(q.reports.map((r) => r.key).sort()).toEqual(["A", "B"]);
    expect(q.deleteReports).toEqual(["C"]);
  });

  it("跨标签页：drain 读「内存 ∪ localStorage」，被别的标签页覆盖掉的条目不滞留", async () => {
    mockFetchRoutes({ meUser: ALICE, cloudReports: CLOUD_NONEMPTY });
    await initCloudSync();

    // 本 tab 写入 → 进内存队列
    await saveReport(makeReport("本标签页写的", 1));
    // 另一个标签页入队后写满整份 localStorage，把本 tab 那条抹掉了
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        reports: [{ key: "别的标签页写的", term: "别的标签页写的", parent_term: null, relation_type: null, full_text: "y", related: [] }],
        cards: [],
        deleteReports: [],
        deleteCards: [],
        user: "alice",
      })
    );

    const second = mockFetchRoutes({ meUser: ALICE, cloudReports: CLOUD_NONEMPTY });
    await initCloudSync();

    const keys = second.posts.flatMap((p) => (p.reports ?? []).map((r) => r.key));
    expect(keys).toContain("本标签页写的");
    expect(keys).toContain("别的标签页写的");
    // 排空后不留残骸
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("drain 后队列真正排空：推送一次后，后续启动不再重推历史", async () => {
    const routes = () => mockFetchRoutes({ meUser: ALICE, cloudReports: CLOUD_NONEMPTY });

    routes();
    await initCloudSync();
    await saveReport(makeReport("历史概念", 1));

    // 第 1 次启动：补推这条，并真的把队列排空
    const first = routes();
    await initCloudSync();
    expect(first.posts.flatMap((p) => (p.reports ?? []).map((r) => r.key))).toEqual(["历史概念"]);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();

    // 之后每次启动都推 0 条 —— persistPending 若被改成读-改-写，这里会每次重推全部历史
    for (let i = 0; i < 2; i++) {
      const { posts } = routes();
      await initCloudSync();
      expect(posts).toHaveLength(0);
    }
  });
});

describe("④ 换账号不混数据", () => {
  it("本机数据归属另一个账号 → 跳过首次合并上传", async () => {
    await saveReport(makeReport("alice的报告", 1));
    const first = mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();
    expect(first.posts).toHaveLength(1); // alice 首次登录：并入自己的云端空间
    expect(localStorage.getItem(OWNER_KEY)).toBe("alice");

    // bob 登录，本机还躺着 alice 的数据 → 不能再传一次
    const second = mockFetchRoutes({ meUser: { id: 2, login: "bob", avatar_url: null } });
    await initCloudSync();
    expect(second.posts).toHaveLength(0);
    // 本地数据必须留着（local-first：不 clearAllLocalData）
    expect(await getReport("alice的报告")).toBeDefined();
  });

  it("归属一致时后续登录仍可正常合并上传", async () => {
    await saveReport(makeReport("同账号报告", 1));
    mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();

    await saveReport(makeReport("第二份", 1));
    const again = mockFetchRoutes({ meUser: ALICE });
    await initCloudSync();
    expect(again.posts.flatMap((p) => (p.reports ?? []).map((r) => r.key))).toContain("第二份");
  });

  it("队列带写入时账号标记：换账号后只推当前账号的条目，旧账号的丢弃", async () => {
    mockFetchRoutes({
      meUser: ALICE,
      cloudReports: [{ key: "云端已有", term: "云端已有", full_text: "x", related: [], created_at: 1, updated_at: 1 }],
    });
    await initCloudSync();
    await saveReport(makeReport("alice的待推", 1));
    expect(readPending().user).toBe("alice");

    const bob = mockFetchRoutes({
      meUser: { id: 2, login: "bob", avatar_url: null },
      cloudReports: [{ key: "云端已有", term: "云端已有", full_text: "x", related: [], created_at: 1, updated_at: 1 }],
    });
    await initCloudSync();
    expect(bob.posts).toHaveLength(0);
  });
});
