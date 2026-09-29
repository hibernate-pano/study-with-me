/**
 * Mermaid 组件的**行为**测试：流式生成时"失败一次 → 图永久退化"这条时序。
 *
 * 配套的 Mermaid.contract.test.ts 用 TS 编译器 API 断言结构（那层是在没有 DOM 环境时的
 * 权宜之计）。本文件是真跑 effect 的那一层，直接验行为：
 *   第 1 轮 code 是流式半截的 "graph"（mermaid 必然解析失败）→ error 置上、回退源码块；
 *   第 2 轮 code 补全成合法图 → 必须能重绘出 SVG。
 * 这条时序依赖 Mermaid.tsx 的两件事同时成立：
 *   - effect 每轮开头 setError(null)（:18），否则上一轮的 error 粘住后续所有重试；
 *   - 画图容器常驻、不挂在 error 分支上（:43），否则 error 一置上 ref.current 就变 null，
 *     下一轮 effect 在 `if (cancelled || !ref.current) return` 直接返回 —— 双向锁死。
 * 两件任一退回修复前的样子，下面两个用例立刻变红。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/** mermaid.render 的行为开关：默认失败，按用例切到成功。 */
const mmd = vi.hoisted(() => ({ shouldFail: true, renderCalls: [] as string[] }));

vi.mock("mermaid", () => ({
  default: {
    initialize: () => {},
    render: (id: string, code: string) => {
      mmd.renderCalls.push(code);
      if (mmd.shouldFail) return Promise.reject(new Error("Parse error on line 1"));
      return Promise.resolve({ svg: `<svg data-mmd="ok"><g>${code.length}</g></svg>` });
    },
  },
}));

import Mermaid from "./Mermaid";

/** 画图容器：常驻的 div（无 role/aria，用 className 区分 hidden） */
function canvas(): HTMLElement {
  const el = document.querySelector<HTMLElement>("div.my-3 > div");
  if (!el) throw new Error("没找到画图容器");
  return el;
}

beforeEach(() => {
  mmd.shouldFail = true;
  mmd.renderCalls.length = 0;
});

afterEach(() => {
  cleanup();
});

describe("Mermaid：流式半截代码的失败不得让图永久退化", () => {
  it("第 1 轮解析失败 → 置 error、回退显示原始源码", async () => {
    render(<Mermaid code="graph" />);

    await waitFor(() => expect(document.querySelector("pre code")?.textContent).toBe("graph"));
    expect(mmd.renderCalls).toEqual(["graph"]);
  });

  it("code 补全后必须重绘出图（error 复位 + 容器常驻），而不是停在上一轮的源码块", async () => {
    const { rerender } = render(<Mermaid code="graph" />);
    await waitFor(() => expect(document.querySelector("pre code")).not.toBeNull());
    expect(canvas().innerHTML, "失败帧画图容器应当是空的（内容不丢，但没画出图）").toBe("");

    // —— 关键一步：流式补全，代码变合法 ——
    mmd.shouldFail = false;
    rerender(<Mermaid code={"graph TD\nA-->B"} />);

    // 重绘成功后：SVG 出来了，源码兜底同时消失
    await waitFor(() => expect(canvas().querySelector("svg")).not.toBeNull());
    expect(document.querySelector("pre code"), "出图后不该还挂着源码兜底").toBeNull();
    expect(canvas().className, "恢复后画图容器要重新可见").not.toContain("hidden");
    expect(mmd.renderCalls).toEqual(["graph", "graph TD\nA-->B"]);
  });

  it("容器必须常驻：失败帧不能把它卸载（ref.current 会随之变 null，重试就永远画不出图）", async () => {
    const { rerender } = render(<Mermaid code="graph" />);
    await waitFor(() => expect(document.querySelector("pre code")).not.toBeNull());

    const before = canvas();
    expect(before.className, "失败时应靠 hidden 隐藏容器，而不是卸载它").toContain("hidden");

    mmd.shouldFail = false;
    rerender(<Mermaid code={"graph TD\nA-->B"} />);
    await waitFor(() => expect(canvas().querySelector("svg")).not.toBeNull());

    expect(canvas(), "恢复后拿到的不该是另一个新节点（说明中途被卸载重建过）").toBe(before);
  });

  it("卸载后不得再有 setState 风暴：组件已卸载时 render 失败要静默", async () => {
    const { unmount } = render(<Mermaid code="graph" />);
    await waitFor(() => expect(document.querySelector("pre code")).not.toBeNull());
    // 卸载后迟到的 promise 落地：cleanup 里的 cancelled=true 必须挡住 setError
    expect(() => unmount()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});
