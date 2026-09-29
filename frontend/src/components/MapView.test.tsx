/**
 * MapView 滚轮缩放的行为测试 —— 守 ui-2 修复的核心回归。
 *
 * ## 为什么单独一个文件、单独一个 project
 *
 * 这一层要验的是**原生事件监听 + effect 时序**，node 环境里 EventTarget / 事件派发那一套
 * 跟浏览器不是一回事（MapView 绕开 React 根容器委托，直接对画布 <svg> 挂 wheel 原生监听）。
 * 所以本文件只在 vitest.config.mts 的 dom project（jsdom）里跑。
 *
 * ## 被守护的缺陷（MapView.tsx:99-128）
 *
 * 修复前用 React 的 onWheel：wheel 事件经 React 根容器委托、且以 passive:true 注册，
 * 事件里的 preventDefault 被浏览器忽略 → 页面跟着滚轮一起滚。修复改成对 <svg> 直接挂
 * 一个 passive:false 的原生 wheel 监听。
 * 三个不变量任一被改回去，下面就有用例变红：
 *   1. 监听必须挂在 <svg> 自身、且第三个参数是 passive:false（jsdom 里 passive 监听器
 *      调 preventDefault 是 no-op，defaultPrevented 永远 false）；
 *   2. 必须真的 preventDefault —— 否则页面会跟着滚；
 *   3. 缩放必须是指数映射 exp(-deltaY·0.0015)：线性映射下 deltaY=400 一次就把 scale
 *      钉死在 MIN_SCALE=0.4，且反向只涨回 1.6 倍、上下不对称。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import type { StoredReport } from "@/lib/storage";

// MapView 用了 useRouter —— App Router 上下文之外必须打桩，否则 import 即炸
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import MapView from "./MapView";

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

function report(key: string, term: string, related: string[]): StoredReport {
  return {
    key,
    term,
    fullText: "",
    related: related.map((name, i) => ({
      name,
      description: `${name} 说明`,
      relationType: i % 2 === 0 ? "前置知识" : "兄弟概念",
      groupLabel: "",
      color: "",
    })),
    createdAt: 0,
    updatedAt: 0,
  };
}

const REPORTS: StoredReport[] = [
  report("乐观锁", "乐观锁", ["版本号", "CAS", "重试"]),
  report("悲观锁", "悲观锁", ["版本号", "行锁"]),
];

/** jsdom 里 getBoundingClientRect 全返回 0×0，handler 会提前 return，缩放根本不会动 */
function stubRect() {
  return vi
    .spyOn(SVGSVGElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700,
      toJSON: () => ({}),
    } as DOMRect);
}

function mount() {
  const utils = render(<MapView reports={REPORTS} />);
  // 优先用 aria-label 认画布，但**不能只认它**：aria-label 是这轮大改里另一处（无障碍）
  // 带进来的，若哪天被改回去，挂载就会抛「没找到画布 svg」，
  // 6 条滚轮用例会集体变成同一个无关的红，滚轮回归反而被这层噪音盖住。
  const svg =
    utils.container.querySelector<SVGSVGElement>('svg[aria-label="概念网络图"]') ??
    utils.container.querySelector<SVGSVGElement>("svg");
  if (!svg) throw new Error("没找到画布 svg：图谱为空时 MapView 会 return null");
  return { ...utils, svg };
}

/** 当前画布 <g transform> 里的 scale */
function scaleOf(svg: SVGSVGElement): number {
  const attr = svg.querySelector("g[transform]")?.getAttribute("transform") ?? "";
  const m = attr.match(/scale\(([-\d.e]+)\)/);
  if (!m) throw new Error(`没解析出 scale：${attr}`);
  return parseFloat(m[1]);
}

/** 当前画布 <g transform> 里的 translate x/y */
function panOf(svg: SVGSVGElement): { x: number; y: number } {
  const attr = svg.querySelector("g[transform]")?.getAttribute("transform") ?? "";
  const m = attr.match(/translate\(([-\d.e]+),([-\d.e]+)\)/);
  if (!m) throw new Error(`没解析出 translate：${attr}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** 在 act 里派发一个 **cancelable** 的 wheel —— 非 cancelable 的话 preventDefault 无效、defaultPrevented 恒 false */
function wheel(svg: SVGSVGElement, deltaY: number, clientX = 500, clientY = 350): WheelEvent {
  let ev!: WheelEvent;
  act(() => {
    ev = new WheelEvent("wheel", {
      deltaY,
      clientX,
      clientY,
      bubbles: true,
      cancelable: true,
    });
    svg.dispatchEvent(ev);
  });
  return ev;
}

beforeEach(() => {
  localStorage.clear();
  stubRect();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MapView 滚轮缩放：必须用非 passive 的原生监听", () => {
  it("wheel 监听挂在 <svg> 自己身上，且显式声明 passive:false", () => {
    const addSpy = vi.spyOn(EventTarget.prototype, "addEventListener");
    const { svg } = mount();

    const onSvg = addSpy.mock.calls.filter((_c, i) => addSpy.mock.instances[i] === svg);
    const wheelRegistrations = onSvg.filter((c) => c[0] === "wheel");
    expect(
      wheelRegistrations,
      "wheel 监听必须直接挂在 <svg> 上（React onWheel 走根容器委托 + passive，preventDefault 会被忽略）",
    ).toHaveLength(1);
    expect(
      wheelRegistrations[0][2],
      "第三个参数必须是 passive:false，否则 preventDefault 是 no-op",
    ).toEqual({ passive: false });
  });

  it("监听要在 cleanup 里摘掉（节点数变化会重跑 effect，重复挂载会叠加缩放）", () => {
    const removeSpy = vi.spyOn(EventTarget.prototype, "removeEventListener");
    const { svg, unmount } = mount();

    unmount();

    const removedOnSvg = removeSpy.mock.calls.filter((_c, i) => removeSpy.mock.instances[i] === svg);
    expect(
      removedOnSvg.some((c) => c[0] === "wheel"),
      "卸载时必须摘掉 wheel 监听，否则重挂后一次滚轮会被处理多次",
    ).toBe(true);
  });

  it("派发 wheel → defaultPrevented 为 true（页面不会跟着滚）且 scale 真的变了", () => {
    const { svg } = mount();
    const before = scaleOf(svg);

    const ev = wheel(svg, 100);

    expect(ev.defaultPrevented, "preventDefault 被忽略了 —— 页面会跟着滚轮一起动（ui-2 修复前的老症状）").toBe(true);
    const after = scaleOf(svg);
    expect(after, "scale 必须变").not.toBe(before);
    expect(after, "deltaY>0（向下滚）应当缩小").toBeLessThan(before);
  });

  it("缩放走指数映射：deltaY=400 一格不钉死在 MIN_SCALE，且上下对称", () => {
    const { svg } = mount();

    // 线性映射（1 - deltaY·0.0015）在 deltaY=400 时正好把 scale 乘到 0.4 → 钉死在下限
    const down = wheel(svg, 400);
    expect(down.defaultPrevented).toBe(true);
    const zoomedOut = scaleOf(svg);
    expect(zoomedOut, "一次 deltaY=400 不该把 scale 打到 MIN_SCALE 上").toBeGreaterThan(MIN_SCALE);
    expect(zoomedOut).toBeCloseTo(Math.exp(-400 * 0.0015), 5);

    // 对称性：再反向滚同样的量，必须回到 1（线性映射只涨回 1.6 倍，吸走了一半缩放）
    const up = wheel(svg, -400);
    expect(up.defaultPrevented).toBe(true);
    expect(scaleOf(svg)).toBeCloseTo(1, 5);
  });

  it("上下限仍然生效（无论 deltaY 多大都钉在 [0.4, 3]）", () => {
    const { svg } = mount();

    for (let i = 0; i < 12; i++) wheel(svg, 1000);
    expect(scaleOf(svg)).toBeCloseTo(MIN_SCALE, 5);

    for (let i = 0; i < 24; i++) wheel(svg, -1000);
    expect(scaleOf(svg)).toBeCloseTo(MAX_SCALE, 5);
  });

  it("缩放围绕光标：光标在右下角放大时，平移量把该点顶回原屏幕位置", () => {
    const { svg } = mount();
    const g = svg.querySelector("g[transform]")!;
    expect(g.getAttribute("transform")).toBe("translate(0,0) scale(1)");

    const ev = wheel(svg, -100, 1000, 700); // 放大，光标在画布右下角
    expect(ev.defaultPrevented).toBe(true);

    // 光标处视图坐标 = (1000/1000)*1000 = VB_W → 放大后 pan 要往负方向拉，
    // 保证 (VB_W - pan.x)/scale 仍等于 VB_W，即 pan.x = VB_W(1 - 1/scale) < 0
    expect(scaleOf(svg)).toBeGreaterThan(1);
    const pan = panOf(svg);
    expect(pan.x, "围绕右下角放大，x 平移必须为负").toBeLessThan(0);
    expect(pan.y, "围绕右下角放大，y 平移必须为负").toBeLessThan(0);
  });
});
