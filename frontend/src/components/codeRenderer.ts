import { createElement, Fragment, type ComponentPropsWithoutRef, type ReactNode } from "react";
import CodeBlock from "./CodeBlock";

type CodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };

/**
 * markdown `code` 渲染器（SectionCard 等共用）：
 * - 块级代码块（有 language- class 或内容含换行）走 CodeBlock（含 <pre>）
 * - 行内 `code` 渲染为行内 <code>，不能走 CodeBlock，否则被块级化（非法嵌套 <p><pre> / 双重 <pre>）
 *
 * 用 createElement 而非 JSX，保持本文件为纯 .ts，可被 vitest（jsx: preserve）导入测试。
 */
export function renderCode({ className, children, node, ...rest }: CodeProps) {
  if (className || String(children).includes("\n")) {
    return createElement(CodeBlock, { className }, children);
  }
  return createElement(
    "code",
    {
      className:
        "font-mono text-[12.5px] bg-[var(--bg-soft)] border border-[var(--line)] rounded px-1 py-0.5 text-slate-700",
      ...rest,
    },
    children
  );
}

/** 块级代码块外层的 <pre> 由 renderCode 自己包，react-markdown 默认的 <pre> 只透传，避免双重包裹 */
function renderPre({ children }: { children?: ReactNode }) {
  return createElement(Fragment, null, children);
}

/** ReactMarkdown components：code/pre 分支处理，配合 `a` 之外的原生渲染 */
export const markdownCodeComponents = {
  code: renderCode,
  pre: renderPre,
};
