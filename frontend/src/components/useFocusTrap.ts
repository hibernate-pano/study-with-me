"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 模态无障碍三件套：焦点移入 / 焦点归还 / 背景隔离，外加 Tab 循环。
 *
 * 为什么光有 aria-modal 不算隔离：
 *  aria-modal="true" 只是告诉读屏软件「背景可以忽略」。读屏的虚拟光标会照做，
 *  键盘不会——Tab 会从面板走到遮罩后面的页面控件，Enter 顺手把它激活。
 *  背景被「声明」成惰性、实际却不是，比不声明更糟。所以这里用两件事把它坐实：
 *  ① inert（真阻断鼠标 / 键盘 / AT）② Tab 循环（键盘层面的兜底 + 越界回收）。
 */

/* ------------------------------------------------------------------ *
 * 可聚焦元素
 * ------------------------------------------------------------------ */

/** 对齐浏览器默认 Tab 顺序的那一批。textarea 在列——SearchBox 用的是多行输入。 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "summary",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

/**
 * Tab / Shift+Tab 循环后的目标下标。抽成纯函数是为了让两端环绕的边界可以单测——
 * 环绕写错（少 1 / 多 1 / Shift 反向写反）是这类循环最常见的 bug。
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  // 焦点不在列表里（-1：落在容器自身、或已经逃到 body）：从两端起算
  if (current < 0 || current >= count) return shift ? count - 1 : 0;
  return shift ? (current - 1 + count) % count : (current + 1) % count;
}

function isTabbable(el: HTMLElement): boolean {
  if (el.tabIndex < 0) return false; // [tabindex="-1"]、无 href 的 a
  if (el.hasAttribute("disabled")) return false; // disabled 按钮的 tabIndex 仍是 0
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest("[inert]")) return false; // 被上层模态隔离掉了
  // offsetParent 对 position:fixed 恒为 null，判断不了；getClientRects 为空即「没被渲染」
  return el.getClientRects().length > 0;
}

/** 容器内当前可 Tab 到的元素，按文档顺序。每次现算，避免列表变化后拿到过期快照。 */
export function tabbableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable);
}

/* ------------------------------------------------------------------ *
 * 背景隔离
 * ------------------------------------------------------------------ */

/**
 * 当前打开的模态根，后开的后进先出。
 * 用模块级而不是每个 hook 各管各的，是为了处理叠开：抽屉开着时再按 ⌘K，
 * 若两处各自「把兄弟节点置 inert」，面板自己的遮罩正好是抽屉的兄弟，
 * 会被抽屉置成 inert，整个面板（含面板内部所有按钮）就点不动了。
 */
const openModalRoots: HTMLElement[] = [];
let currentRestore: (() => void) | null = null;

function markInertOutside(
  child: Element,
  roots: HTMLElement[],
  out: Array<[HTMLElement, boolean]>
): void {
  if (roots.some((r) => r === child)) return; // 本身就是模态根，整棵子树留着
  // 两个方向都要判：child 可能是模态的祖先（该往里走去找它），
  // 也可能是模态的后代（在模态路径上，同样得往里走而不是把整块置 inert）。
  // 只判「模态包含 child」的话，嵌在页面深处的抽屉会被它上面的 <main> 整个 inert 掉。
  if (roots.some((r) => r.contains(child) || child.contains(r))) {
    for (const c of Array.from(child.children)) markInertOutside(c, roots, out);
    return;
  }
  const el = child as HTMLElement;
  if (!("inert" in el)) return; // SVG 之类没有 inert 属性
  // 已经对辅助技术隐藏的装饰遮罩跳过：inert 会连它的「点击空白处关闭」一起废掉
  if (el.getAttribute("aria-hidden") === "true") return;
  out.push([el, el.inert]);
  el.inert = true;
}

function reapplyIsolation(): void {
  currentRestore?.();
  currentRestore = null;
  const roots = openModalRoots.filter((r) => r.isConnected);
  const touched: Array<[HTMLElement, boolean]> = [];
  if (roots.length > 0 && typeof document !== "undefined" && document.body) {
    for (const child of Array.from(document.body.children)) {
      markInertOutside(child, roots, touched);
    }
  }
  currentRestore = () => {
    for (const [el, was] of touched) if (el.isConnected) el.inert = was;
    currentRestore = null;
  };
}

/**
 * 登记一个「已打开」的模态根，重新计算背景隔离。
 * 返回的函数在模态关闭时调用：还原并按剩余的模态重算。
 */
export function registerModalRoot(root: HTMLElement): () => void {
  openModalRoots.push(root);
  reapplyIsolation();
  return () => {
    const i = openModalRoots.indexOf(root);
    if (i >= 0) openModalRoots.splice(i, 1);
    reapplyIsolation();
  };
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

export type FocusTrapOptions = {
  /** 打开时焦点落点：first=容器内第一个可聚焦元素；container=容器自身；none=不动 */
  initialFocus?: "first" | "container" | "none";
  /** 是否把模态之外的元素置 inert。非模态面板（无遮罩、背景仍可交互）必须关掉。 */
  isolateBackground?: boolean;
  /** 是否拦截 Tab 做循环。非模态面板必须关掉——Tab 应当能走出去。 */
  trapTab?: boolean;
};

/**
 * 把一个容器升级成真正的模态：
 *  1. 打开时把焦点移进去，关闭时归还给打开前那个元素
 *  2. 把容器之外的东西置 inert（背景对鼠标 / 键盘 / AT 一起失效）
 *  3. Tab / Shift+Tab 在容器内循环，且焦点一旦跑丢（落到 body）也能被拉回来
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {}
): void {
  // options 走 ref 读：effect 只依赖 active。调用方若传了每次新建的对象/表达式，
  // 直接进依赖数组会让 effect 反复重跑，而重跑会把 prevFocus 记成容器自己，焦点就还不回来了。
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const prevFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 1) 焦点移入
    const mode = optsRef.current.initialFocus ?? "first";
    if (mode !== "none" && !container.contains(document.activeElement)) {
      const target = mode === "first" ? tabbableWithin(container)[0] ?? container : container;
      target.focus?.();
    }

    // 2) 背景隔离
    const unregister =
      optsRef.current.isolateBackground === false ? null : registerModalRoot(container);

    // 3) Tab 循环：挂在 document 的捕获阶段，而不是容器的 onKeyDown。
    //    容器的 onKeyDown 只在焦点还在面板内时才触发，而这个 bug 的表现恰恰是
    //    焦点已经逃到 body——那时 onKeyDown 根本不会响，循环就漏了。
    const onKeyDown = (e: KeyboardEvent) => {
      if (optsRef.current.trapTab === false) return;
      if (e.key !== "Tab") return;
      const items = tabbableWithin(container);
      e.preventDefault();
      if (items.length === 0) {
        container.focus?.();
        return;
      }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      items[nextFocusIndex(items.length, idx, e.shiftKey)]?.focus?.();
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      unregister?.();
      // 归还焦点：仅当焦点确实还在模态里（或已经掉到 body）时才还，
      // 不抢用户自己已经移走的焦点；原元素被路由卸载了就放弃
      const now = document.activeElement;
      if (!prevFocus?.isConnected) return;
      if (now && now !== document.body && !container.contains(now)) return;
      prevFocus.focus?.();
    };
  }, [active, containerRef]);
}
