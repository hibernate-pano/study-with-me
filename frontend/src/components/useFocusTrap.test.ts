import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { nextFocusIndex, registerModalRoot, FOCUSABLE_SELECTOR } from "./useFocusTrap";

/**
 * useFocusTrap 里的可测内核：
 *  1. nextFocusIndex —— Tab 环绕的边界数学
 *  2. registerModalRoot —— 背景 inert 隔离（谁该被置 inert、谁必须留着）
 *
 * Hook 本体要 React + DOM 跑得起来，而本仓 vitest 是 node 环境（没装 jsdom），
 * 所以这里只测这两个不依赖渲染的纯逻辑；DOM 侧用最小手写替身，不引新依赖。
 */

/* ---------- 最小 DOM 替身 ---------- */

type FakeEl = {
  tag: string;
  children: FakeEl[];
  parent: FakeEl | null;
  inert: boolean;
  isConnected: boolean;
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
  contains(other: FakeEl): boolean;
};

function el(tag: string, attrs: Record<string, string> = {}): FakeEl {
  const node: FakeEl = {
    tag,
    children: [],
    parent: null,
    inert: false,
    isConnected: true,
    attrs,
    getAttribute: (n) => (n in node.attrs ? node.attrs[n] : null),
    contains(other) {
      let cur: FakeEl | null = other;
      while (cur) {
        if (cur === node) return true;
        cur = cur.parent;
      }
      return false;
    },
  };
  return node;
}

function append(parent: FakeEl, child: FakeEl): FakeEl {
  child.parent = parent;
  parent.children.push(child);
  return child;
}

/* ---------- nextFocusIndex ---------- */

describe("nextFocusIndex", () => {
  it("Tab 正向：末尾回到开头", () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it("Tab 正向：中间往下走一格", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
  });

  it("Shift+Tab 反向：开头绕到末尾", () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it("Shift+Tab 反向：中间往上走一格", () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
  });

  it("只有一个可聚焦元素时按 Tab 不动（不越界）", () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  it("焦点不在列表里（-1，即焦点已逃到 body）：正向拉回第一个、反向拉回最后一个", () => {
    expect(nextFocusIndex(4, -1, false)).toBe(0);
    expect(nextFocusIndex(4, -1, true)).toBe(3);
  });

  it("current 越界时同样退回两端，不产生 undefined 下标", () => {
    expect(nextFocusIndex(3, 99, false)).toBe(0);
    expect(nextFocusIndex(3, 99, true)).toBe(2);
  });

  it("列表为空返回 -1（调用方据此把焦点钉回容器）", () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
    expect(nextFocusIndex(0, -1, true)).toBe(-1);
  });

  it("在 5 个元素上跑完整圈，正反向都严格覆盖 0..4 各一次", () => {
    for (const shift of [false, true]) {
      const seen: number[] = [];
      let i = 0;
      for (let n = 0; n < 5; n++) {
        i = nextFocusIndex(5, i, shift);
        seen.push(i);
      }
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
  });
});

describe("FOCUSABLE_SELECTOR", () => {
  it("覆盖 textarea —— SearchBox 用的是多行输入，漏了它面板打开就没焦点落点", () => {
    expect(FOCUSABLE_SELECTOR).toContain("textarea");
  });

  it("覆盖 button / a[href] / [tabindex] 这三类命令面板里真实存在的可聚焦元素", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button");
    expect(FOCUSABLE_SELECTOR).toContain("a[href]");
    expect(FOCUSABLE_SELECTOR).toContain("[tabindex]");
  });
});

/* ---------- registerModalRoot ---------- */

describe("registerModalRoot（背景隔离）", () => {
  let body: FakeEl;
  let main: FakeEl;
  let authBar: FakeEl;
  let palette: FakeEl;
  let restoreDoc: (() => void) | null;

  beforeEach(() => {
    body = el("body");
    main = append(body, el("main"));
    authBar = append(body, el("div")); // layout 里的 AuthBar
    palette = append(body, el("div")); // layout 里的 CommandPalette 挂载点
    restoreDoc = null;
    if (!("document" in globalThis)) {
      Object.defineProperty(globalThis, "document", {
        value: { body },
        configurable: true,
        writable: true,
      });
    } else {
      (globalThis as { document: unknown }).document = { body };
    }
  });

  afterEach(() => {
    // 每个用例的登记都必须注销，否则模块级状态会漏到下一个用例
    restoreDoc?.();
    restoreDoc = null;
  });

  it("模态打开后，body 下的其他兄弟节点被置 inert", () => {
    const close = registerModalRoot(palette as unknown as HTMLElement);
    restoreDoc = close;
    expect(main.inert).toBe(true);
    expect(authBar.inert).toBe(true);
    expect(palette.inert).toBe(false);
  });

  it("关闭后 inert 被还原，背景恢复可交互", () => {
    const close = registerModalRoot(palette as unknown as HTMLElement);
    close();
    restoreDoc = null;
    expect(main.inert).toBe(false);
    expect(authBar.inert).toBe(false);
  });

  it("模态嵌在页面深处时，只隔离通往它的那条路径之外的旁支", () => {
    const page = append(main, el("div"));
    const sidebar = append(main, el("aside"));
    const drawer = append(page, el("aside"));
    const other = append(page, el("div"));

    const close = registerModalRoot(drawer as unknown as HTMLElement);
    restoreDoc = close;

    expect(drawer.inert).toBe(false);
    expect(page.inert).toBe(false); // 通往抽屉的容器本身不动
    expect(sidebar.inert).toBe(true); // 同级旁支被隔离
    expect(other.inert).toBe(true); // 容器内部的旁支也被隔离
    expect(main.inert).toBe(false); // 祖先不能整体置 inert，否则连抽屉一起废掉
    expect(authBar.inert).toBe(true); // body 下的无关节点照旧隔离
  });

  it("叠开两个模态时，先开的那个不被后来的置成 inert（否则整个面板点不动）", () => {
    const closeDrawer = registerModalRoot(palette as unknown as HTMLElement);
    // 命令面板在抽屉之后打开：抽屉的兄弟是 body 的另一个子节点
    const secondModal = append(body, el("div"));
    const closeSecond = registerModalRoot(secondModal as unknown as HTMLElement);
    restoreDoc = () => {
      closeSecond();
      closeDrawer();
    };

    expect(secondModal.inert).toBe(false);
    expect(palette.inert).toBe(false); // 已登记的模态根一律保留
    expect(main.inert).toBe(true);

    closeSecond();
    expect(palette.inert).toBe(false); // 关掉上层后，下层仍是活的
    expect(main.inert).toBe(true); // 下层还开着，背景继续隔离
  });

  it("aria-hidden 的装饰遮罩不参与隔离 —— 否则「点击空白处关闭」会被 inert 吃掉", () => {
    const overlay = append(body, el("div", { "aria-hidden": "true" }));
    const close = registerModalRoot(palette as unknown as HTMLElement);
    restoreDoc = close;
    expect(overlay.inert).toBe(false);
    expect(main.inert).toBe(true); // 隔离本身没被跳过
  });

  it("还原的是登记前各自的状态，不会把别人已经置上的 inert 抹掉", () => {
    main.inert = true; // 事先就被别的逻辑置过
    const close = registerModalRoot(palette as unknown as HTMLElement);
    expect(main.inert).toBe(true);
    close();
    restoreDoc = null;
    expect(main.inert).toBe(true); // 还原成 true，而不是无脑清成 false
  });

  it("反复开关不漏状态：第二、第三次打开时背景照常隔离，关闭后照常还原", () => {
    // 守住模块级登记表不泄漏——一旦漏一条，后续每次打开都会把整页留在 inert 上
    for (let i = 0; i < 3; i++) {
      const close = registerModalRoot(palette as unknown as HTMLElement);
      expect(main.inert).toBe(true);
      expect(authBar.inert).toBe(true);
      expect(palette.inert).toBe(false);
      close();
      expect(main.inert).toBe(false);
      expect(authBar.inert).toBe(false);
    }
  });

  it("已卸载的模态根不再「保护」子树——重算时按普通背景处理", () => {
    const close = registerModalRoot(palette as unknown as HTMLElement);
    expect(palette.inert).toBe(false);

    palette.isConnected = false; // 根脱离文档（路由跳走）
    const other = append(body, el("div"));
    const closeOther = registerModalRoot(other as unknown as HTMLElement);
    restoreDoc = () => {
      closeOther();
      close();
    };

    expect(other.inert).toBe(false); // 新模态照常工作
    expect(main.inert).toBe(true); // 背景照常被隔离
    expect(palette.inert).toBe(true); // 旧根已失效，它自己反倒成了背景的一部分
  });
});
