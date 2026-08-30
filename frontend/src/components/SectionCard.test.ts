import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { markdownCodeComponents } from "@/components/codeRenderer";

// CodeBlock.tsx 含 JSX（vitest 因 tsconfig jsx:preserve 无法解析 .tsx），用轻量替身：
// 真实 CodeBlock 的行为就是把内容包进单个 <pre><code>，替身保持一致即可验证分支逻辑
vi.mock("@/components/CodeBlock", () => ({
  default: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    createElement("pre", null, createElement("code", { className }, children)),
}));

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { components: markdownCodeComponents }, content)
  );
}

describe("SectionCard markdown code 渲染", () => {
  it("行内 code 渲染为行内 <code>，不被 <pre> 包裹", () => {
    const html = renderMarkdown("这里强调 `useMemo` 的作用");
    expect(html).toContain("<code");
    expect(html).not.toContain("<pre");
  });

  it("块级代码块走 CodeBlock，渲染为单个 <pre>", () => {
    const html = renderMarkdown("示例：\n\n```ts\nconst a = 1;\n```");
    expect(html).toContain("<pre");
    expect(html.match(/<pre/g)?.length).toBe(1);
  });
});
