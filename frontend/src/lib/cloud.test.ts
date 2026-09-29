import { afterEach, describe, expect, it, vi } from "vitest";
import { pushCloud } from "./cloud";

describe("pushCloud", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("HTTP 200 但服务端报告部分失败时仍抛错，避免客户端清空重试队列", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: false, failures: ["report:关键报告"] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(
      pushCloud({
        reports: [
          {
            key: "关键报告",
            term: "关键报告",
            parent_term: null,
            relation_type: null,
            full_text: "x",
            related: [],
          },
        ],
      })
    ).rejects.toThrow("部分数据同步失败");
  });
});
