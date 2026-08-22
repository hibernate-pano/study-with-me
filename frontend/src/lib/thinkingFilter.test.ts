import { describe, it, expect } from "vitest";
import { ThinkingFilter } from "./thinkingFilter";

describe("ThinkingFilter", () => {
  it("透明转发：没有 thinking 标签的 delta 应原样返回", () => {
    const f = new ThinkingFilter();
    expect(f.push("你好")).toBe("你好");
    expect(f.push("世界")).toBe("世界");
    expect(f.flush()).toBe("");
  });

  it("过滤单个完整 thinking 块", () => {
    const f = new ThinkingFilter();
    expect(f.push("<think>内部思考</think>可见内容")).toBe("可见内容");
    expect(f.flush()).toBe("");
  });

  it("过滤 thinking 块前后都有内容", () => {
    const f = new ThinkingFilter();
    expect(f.push("前置<think>思考中</think>后置")).toBe("前置后置");
  });

  it("保留开始标签之前的可见内容 + 屏蔽标签后内容", () => {
    const f = new ThinkingFilter();
    expect(f.push("前面<think>思考中")).toBe("前面");
    // 后续 push 不应让 thinking 里的内容泄漏
    expect(f.push("还在思考")).toBe("");
    expect(f.flush()).toBe("");
  });

  it("跨多个 delta 拼出开始标签（流式边界保护）", () => {
    const f = new ThinkingFilter();
    // 真实 SSE 边界：'<' 与 'think>' 分跨两帧，拼接后能识别出 <think>
    expect(f.push("前面<")).toBe("前面");
    expect(f.push("think>")).toBe("");
    expect(f.push("思考中</think>后面")).toBe("后面");
  });

  it("跨多个 delta 拼出结束标签", () => {
    const f = new ThinkingFilter();
    f.push("<think>思考");
    expect(f.push("中</think>")).toBe("");
    expect(f.push("尾巴")).toBe("尾巴");
  });

  it("处理连续多个 thinking 块", () => {
    const f = new ThinkingFilter();
    const input = "A<think>1</think>B<think>2</think>C";
    expect(f.push(input)).toBe("ABC");
  });

  it("flush() 在 thinking 仍未关闭时丢弃剩余内容", () => {
    const f = new ThinkingFilter();
    f.push("<think>思考到一半");
    // 没遇到结束标签就结束，flush 应丢弃
    expect(f.flush()).toBe("");
  });

  it("flush() 在正常状态下吐出挂起的尾巴", () => {
    const f = new ThinkingFilter();
    f.push("前半");
    f.push("后半");
    // 正常结束，flush 应清空（前半后半已在 push 里输出）
    expect(f.flush()).toBe("");
  });

  it("done 状态后再次 push 是 no-op（防御性）", () => {
    const f = new ThinkingFilter();
    f.push("x");
    f.flush();
    // flush 后 done=true
    expect(f.push("y")).toBe("");
  });

  it("空字符串 push 返回空字符串", () => {
    const f = new ThinkingFilter();
    expect(f.push("")).toBe("");
  });
});