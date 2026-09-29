/**
 * jsdom project 的 setup（只服务 *.test.tsx 组件行为测试）。
 *
 * 1. @testing-library/react 的自动 cleanup 依赖全局 afterEach；本仓库不开 `globals: true`
 *    （开了会波及 node project 的 300+ 用例），所以这里显式挂。
 * 2. jsdom 缺 PointerEvent / setPointerCapture，MapView 的画布交互一碰就 TypeError。
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// jsdom 没实现 PointerEvent（Pointer Events Level 2），React 的 onPointer* 事件靠它构造。
if (typeof globalThis.PointerEvent === "undefined") {
  class JsdomPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = JsdomPointerEvent as unknown as typeof PointerEvent;
}

// MapView.onBgPointerDown 会调 setPointerCapture，jsdom 的 Element 上没有这个方法。
if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {};
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}
