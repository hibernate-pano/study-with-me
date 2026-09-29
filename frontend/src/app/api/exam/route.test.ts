import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUserBySession: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  run: vi.fn(async () => []),
}));

vi.mock("@/lib/rateLimit", () => ({
  aiAccess: vi.fn(async () => ({ allowed: true })),
  rateLimitedResponse: vi.fn(() => new Response("limited", { status: 429 })),
}));

describe("POST /api/exam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_API_KEY;
  });

  it("调用模型并把结构化题库返回给前端", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "测试题库",
                    knowledgePoints: ["进程"],
                    questions: [
                      {
                        type: "single_choice",
                        stem: "进程是什么？",
                        options: ["资源分配单位", "指令"],
                        answerIndex: 0,
                        explanation: "教材定义。",
                        knowledgePoint: "进程",
                        difficulty: 1,
                        sourcePage: 3,
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "操作系统",
          sourceText: "进程是操作系统进行资源分配的基本单位。".repeat(10),
          focus: "进程",
          questionCount: 8,
          difficulty: 1,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { bank: { questions: unknown[] } };
    expect(body.bank.questions).toHaveLength(1);
  });

  it("资料太短时在调用模型前拒绝", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "空", sourceText: "太短" }),
      })
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("超过 6 万字的资料在调用模型前被拒绝（与前端上限、prompt 截断一致）", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "教材", sourceText: "字".repeat(60_001) }),
      })
    );

    expect(res.status).toBe(413);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("6 万字"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("恰好 6 万字放行到模型调用", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "教材", sourceText: "字".repeat(60_000) }),
      })
    );

    expect(res.status).not.toBe(413);
    expect(fetchMock).toHaveBeenCalled();
  });
});
