/**
 * /today 页面的结构性契约（AST 级）。
 *
 * ## 为什么不是行为测试
 *
 * 同 Mermaid.contract.test.ts 的两条硬限制，都是实测确认的：
 * tsconfig 是 `"jsx": "preserve"`，任何 import .tsx 的测试在 vite:import-analysis 阶段就炸；
 * 加上 vitest 是 environment: "node" 且没有 jsdom/happy-dom/react-test-renderer，
 * useState / useMemo 的重渲染与 useEffect 时序在单测里根本跑不出来。
 * 仓库里已有的 src/components/SectionCard.test.ts 也是靠 mock 掉 .tsx 才跑得通的。
 *
 * 这里用 TypeScript 编译器 API 解析 page.tsx，断言本次修复依赖的三条结构事实。
 * 它们不是格式检查：改缩进、调换 JSX 属性顺序、改文案都不会误报；
 * 把代码退回「空提交照样写库 / streak 靠 setState 手动同步」会立刻变红。
 */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const SRC_PATH = path.resolve(import.meta.dirname, "page.tsx");
const source = fs.readFileSync(SRC_PATH, "utf8");
const sf = ts.createSourceFile(SRC_PATH, source, ts.ScriptTarget.ESNext, /* setParentNodes */ true, ts.ScriptKind.TSX);

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walk(c, visit));
}

/** `const onSaveReflection = async (…) => {…}` / `const onAdd = …` 的函数体 */
function handlerBody(name: string): ts.Node | null {
  let found: ts.Node | null = null;
  walk(sf, (n) => {
    if (found || !ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== name) return;
    const init = n.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) found = init.body;
  });
  return found;
}

/** 形如 `const a = String(formData.get("autopilot") || "").trim()` 里的变量名 */
function formFieldVar(body: ts.Node, field: string): string | null {
  let name: string | null = null;
  walk(body, (n) => {
    if (name || !ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name)) return;
    const text = n.initializer?.getText(sf) ?? "";
    if (text.includes(`get("${field}")`) || text.includes(`get('${field}')`)) name = n.name.text;
  });
  return name;
}

/** `if (!a && !s) return;` —— 条件是两项取反的 &&，then 分支是裸 return */
function isEmptyBothGuard(stmt: ts.IfStatement, names: string[]): boolean {
  if (!ts.isReturnStatement(stmt.thenStatement) || stmt.thenStatement.expression) return false;
  const c = stmt.expression;
  if (!ts.isBinaryExpression(c) || c.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) return false;
  const operands = [c.left, c.right].map((o) =>
    ts.isPrefixUnaryExpression(o) && o.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(o.operand) ? o.operand.text : null
  );
  return names.every((nm) => operands.includes(nm));
}

function findEmptyBothGuard(body: ts.Node, names: string[]): ts.IfStatement | null {
  let found: ts.IfStatement | null = null;
  walk(body, (n) => {
    if (!found && ts.isIfStatement(n) && isEmptyBothGuard(n, names)) found = n;
  });
  return found;
}

describe("空反思不得被当成打卡（onSaveReflection 守卫）", () => {
  const body = handlerBody("onSaveReflection");

  it("能从 formData 里取出 autopilot 与 stretch 两栏", () => {
    expect(body, "没找到 onSaveReflection 的函数体，页面结构可能变了").not.toBeNull();
    expect(formFieldVar(body!, "autopilot"), "没读到 autopilot 栏").toBeTruthy();
    expect(formFieldVar(body!, "stretch"), "没读到 stretch 栏").toBeTruthy();
  });

  it("两栏皆空时必须早退，不写库", () => {
    const a = formFieldVar(body!, "autopilot")!;
    const s = formFieldVar(body!, "stretch")!;
    // 修复前只有 `String(formData.get(...) || "").trim()`，没有「皆空就 return」：
    // 空提交照样写一条空反思进库，被 activeDays 算成一次打卡，🔥 凭空 +1
    expect(findEmptyBothGuard(body!, [a, s]), `onSaveReflection 缺少 \`if (!${a} && !${s}) return;\` 守卫`).toBeTruthy();
  });

  it("写库调用的位置必须在守卫之后（早退之后才是 saveReflection）", () => {
    const a = formFieldVar(body!, "autopilot")!;
    const s = formFieldVar(body!, "stretch")!;
    const guard = findEmptyBothGuard(body!, [a, s]);
    expect(guard, "没找到两栏皆空的早退守卫").toBeTruthy();

    let saveIdx = -1;
    walk(body!, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "saveReflection") saveIdx = n.getStart(sf);
    });
    expect(saveIdx, "onSaveReflection 里没有 saveReflection 调用").toBeGreaterThanOrEqual(0);
    expect(guard!.getStart(sf), "守卫必须写在 saveReflection 之前，否则空提交仍会落库").toBeLessThan(saveIdx);
  });

  it("提交按钮的 disabled 状态与实际行为一致（两栏皆空时按钮不可点）", () => {
    const disabledExprs: string[] = [];
    walk(sf, (n) => {
      if (ts.isJsxAttribute(n) && n.name.getText(sf) === "disabled" && n.initializer) {
        disabledExprs.push(n.initializer.getText(sf));
      }
    });
    const guarded = disabledExprs.find((e) => e.includes("autopilot") && e.includes("stretch"));
    expect(guarded, "提交按钮没有随两栏内容变化的 disabled，按钮可点但点了不写库").toBeTruthy();
    expect(guarded).toContain("trim()");
  });
});

describe("连续签到必须是派生值，不是手动同步的状态", () => {
  it("streak 由 useMemo 从 tasks/reflections 派生（与趋势页同一套写法）", () => {
    // 修复前是 const [streak, setStreak] = useState(0) —— 解构绑定，这里一并认出来，
    // 好让失败信息直指「你用的是 setState 手动同步」而不是含糊的「没找到 streak」
    let init: ts.Expression | undefined;
    let form = "const streak = …";
    walk(sf, (n) => {
      if (!ts.isVariableDeclaration(n)) return;
      if (ts.isIdentifier(n.name) && n.name.text === "streak") {
        init = n.initializer;
        form = "const streak = …";
      } else if (
        ts.isArrayBindingPattern(n.name) &&
        n.name.elements.some((e) => ts.isBindingElement(e) && ts.isIdentifier(e.name) && e.name.text === "streak")
      ) {
        init = n.initializer;
        form = "const [streak, setStreak] = useState(…)";
      }
    });
    expect(init, "没找到 streak 的声明").toBeTruthy();
    expect(
      ts.isCallExpression(init!) && ts.isIdentifier(init!.expression) && init!.expression.text === "useMemo",
      `streak 必须是 useMemo 派生值；当前写法是 \`${form}\`（setState 手动同步，加/删任务后忘了刷就停在陈旧值）`
    ).toBe(true);
    const memoFn = (init as ts.CallExpression).arguments[0];
    const memoText = memoFn?.getText(sf) ?? "";
    expect(memoText, "useMemo 里应当直接算 calcStreak(activeDays(tasks, reflections), today)").toContain("calcStreak(activeDays(");
  });

  it("整个文件里不得再出现 setStreak：加了/删了任务后忘了刷新，🔥 会停在陈旧值", () => {
    const offenders: string[] = [];
    walk(sf, (n) => {
      if (!ts.isIdentifier(n)) return;
      if (n.text === "setStreak" || n.text === "refreshStreak") offenders.push(n.text);
    });
    expect(offenders, "streak 既然是派生值，就不该再有手动同步的 setter").toEqual([]);
  });

  it("onToggle 不刷 streak：activeDays 不读 done/zone，勾选完成与否算不出连续签到", () => {
    const body = handlerBody("onToggle");
    expect(body, "没找到 onToggle").not.toBeNull();
    const touched: string[] = [];
    walk(body!, (n) => {
      if (ts.isIdentifier(n) && /[Ss]treak|activeDays/.test(n.text)) touched.push(n.text);
    });
    expect(touched, "onToggle 是死代码路径：加刷新既没用又掩盖真正的问题").toEqual([]);
  });
});
