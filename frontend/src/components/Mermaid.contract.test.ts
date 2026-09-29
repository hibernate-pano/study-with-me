/**
 * Mermaid 组件的结构性契约（AST 级）—— 快，但浅。
 *
 * ## 和 Mermaid.test.tsx 的分工
 *
 * 本文件走 TypeScript 编译器 API 解析 Mermaid.tsx 的 AST，不起 DOM、不跑 effect，
 * 因此待在 vitest.config.mts 的 `node` project 里，毫秒级钉住两条**承重**结构不变量。
 * 行为层（真跑 effect：失败 → error 置上 → code 补全 → 必须重绘出图）在
 * **Mermaid.test.tsx**，跑 `dom` project（jsdom + @testing-library/react）。
 * 两层都在 CI 里跑：结构层抓"三元分支/短路被重排"，行为层抓"时序退化成永久失败"。
 *
 * 早期这里只写 AST 层是因为当时 vitest 是单 project、environment: "node"，
 * 且 tsconfig.json 的 `"jsx": "preserve"` 会让 vite 的转换器把 JSX 原样留下
 * （`Error: Failed to parse source for import analysis ... make sure to not set jsx to preserve`），
 * 任何 .tsx 用例都起不来。两条限制现在都已解除（见 vitest.config.mts 的 `dom` project：
 * `oxc: { jsx: "automatic" }` + jsdom），但本层保留 —— 它更便宜，且能在结构被重排、
 * 行为一时看不出差别时先报警。
 *
 * 被守护的缺陷：error 一旦置上就永不清空 + 带 ref 的容器被 error 分支整个卸载，
 * 双向锁死 → 流式生成时 Mermaid 永久停在原始代码块（内容不丢，但图永远出不来）。
 */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const SRC_PATH = path.resolve(import.meta.dirname, "Mermaid.tsx");
const source = fs.readFileSync(SRC_PATH, "utf8");
const sf = ts.createSourceFile(SRC_PATH, source, ts.ScriptTarget.ESNext, /* setParentNodes */ true, ts.ScriptKind.TSX);

const isJsxAttr = (p: ts.JsxAttributeLike, name: string): p is ts.JsxAttribute =>
  ts.isJsxAttribute(p) && p.name.getText(sf) === name;

/** <div …>…</div> 与自闭合的 <div … /> 两种写法都要认 */
type El = ts.JsxElement | ts.JsxSelfClosingElement;
const isEl = (n: ts.Node): n is El => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);
/** 两种写法的标签名与属性都藏在 JsxAttributes 里：自闭合元素是 .attributes，<div>…</div> 是 .openingElement.attributes */
const tagNameOf = (el: El): string =>
  (ts.isJsxSelfClosingElement(el) ? el.tagName : el.openingElement.tagName).getText(sf);
const attrsOf = (el: El): readonly ts.JsxAttributeLike[] =>
  (ts.isJsxSelfClosingElement(el) ? el.attributes : el.openingElement.attributes).properties;

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walk(c, visit));
}

/** useEffect(() => { ... }) 的回调体 */
function useEffectBody(): ts.Node | null {
  let found: ts.Node | null = null;
  walk(sf, (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "useEffect") {
      const arg = n.arguments[0];
      if (arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) found = arg.body;
    }
  });
  return found;
}

/** 携带 ref 属性的 JSX 元素（画图容器） */
function refContainers(): El[] {
  const out: El[] = [];
  walk(sf, (n) => {
    if (isEl(n) && attrsOf(n).some((p) => isJsxAttr(p, "ref"))) out.push(n);
  });
  return out;
}

/** 该元素是否被挂在某个条件分支下（挂上去就意味着会被卸载，ref.current 随之变 null） */
function conditionalAncestor(el: ts.Node): string | null {
  let p: ts.Node | undefined = el.parent;
  while (p) {
    if (ts.isConditionalExpression(p)) return "三元表达式 ? : 的某个分支";
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return "&& 短路分支";
    if (ts.isIfStatement(p)) return "if/else 分支";
    p = p.parent;
  }
  return null;
}

describe("Mermaid 失败态可恢复（流式半截代码不得让图永久退化）", () => {
  it("每轮 code 变化都要先清空 error，否则上一轮的失败会粘住后续所有重试", () => {
    const body = useEffectBody();
    expect(body, "没找到 useEffect 回调体，组件结构可能变了").not.toBeNull();

    let hasReset = false;
    let alsoSetsError = false;
    walk(body!, (n) => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== "setError") return;
      const arg = n.arguments[0];
      if (arg && arg.kind === ts.SyntaxKind.NullKeyword) hasReset = true;
      else alsoSetsError = true;
    });

    expect(hasReset, "effect 开头必须有 setError(null)：流式时前半截代码必然解析失败，不清空就永久停在代码块").toBe(true);
    expect(alsoSetsError, "渲染失败时仍要置上 error 走兜底").toBe(true);
  });

  it("带 ref 的画图容器必须常驻：ref 元素不能挂在任何条件分支里", () => {
    const containers = refContainers();
    expect(containers, "没找到带 ref 的画图容器").toHaveLength(1);
    // 修复前：{error ? <pre>…</pre> : <div ref={ref} />} —— error 一置上容器就被卸载，
    // 下一轮 effect 在 `if (cancelled || !ref.current) return` 直接返回，双向锁死
    expect(conditionalAncestor(containers[0]), "ref 元素被条件挂载，error 一置上它就被卸载，ref.current 变 null 后永远画不出图").toBeNull();
  });

  it("失败时用 className 隐藏容器，而不是卸载它（可见性切换不等于生命周期切换）", () => {
    const container = refContainers()[0];
    const attr = attrsOf(container).find((p) => isJsxAttr(p, "className"));
    expect(attr, "画图容器应当有 className").toBeTruthy();
    const text = ts.isJsxAttribute(attr!) ? attr!.initializer?.getText(sf) ?? "" : "";
    expect(text, "容器的 className 必须随 error 切换（隐藏），而不是随 error 卸载").toContain("error");
  });

  it("容器常驻后，渲染新图前必须先清空，否则错误态恢复那一帧会露出上一次的过期 SVG", () => {
    const clears = source.includes("ref.current.innerHTML =") && /innerHTML\s*=\s*""/.test(source);
    expect(clears, "画图容器常驻了，就必须在 render 前清空，否则失败态恢复那帧显示的是与当前代码不符的旧图").toBe(true);
  });
});

describe("Mermaid 失败兜底不得被这次修复顺手删掉", () => {
  it("失败时仍要显示原始源码（<pre><code>），内容不丢", () => {
    let fallback = false;
    walk(sf, (n) => {
      if (isEl(n) && tagNameOf(n) === "pre") {
        let hasCode = false;
        walk(n, (c) => {
          if (isEl(c) && tagNameOf(c) === "code") hasCode = true;
        });
        if (hasCode) fallback = true;
      }
    });
    expect(fallback, "渲染失败必须回退为原样代码块，修复可恢复性不等于可以删兜底").toBe(true);
  });

  it("兜底 <pre> 仍然只挂在 error 上（正常出图时不要多出一坨源码）", () => {
    expect(source).toMatch(/\{error\s*&&?\s*\(?\s*<pre/);
  });
});
