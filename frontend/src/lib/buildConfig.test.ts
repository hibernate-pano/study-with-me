/**
 * 构建基建契约测试（install/build contract）。
 *
 * 这组用例守护的是「干净环境装得上、lint 跑得起来、CI 会自动跑」三件事，
 * 全部是纯文件解析 + git 行为查询，不发网络请求、不渲染组件。
 *
 * 背景（2026-08 事故链）：
 *   1. eslint.config.mjs 顶层 import 了未在 package.json 声明的包，
 *      而 next build 默认跑 lint（next.config.ts 没开 eslint.ignoreDuringBuilds），
 *      干净环境下 lint 一跑就 ERR_MODULE_NOT_FOUND → 构建直接挂。
 *   2. package-lock.json 与 pnpm-lock.yaml 双锁并存且已漂移（npm 锁里没有 mermaid），
 *      Vercel 一旦改判 npm，`npm ci` 直接 hard-fail "not in sync"。
 *   3. 仓库零 CI，vitest 用例无人自动执行，坏测试静默进 main。
 *
 * 两处刻意的自我约束：
 *   - 本文件不许 import 任何未在 package.json 声明的包——那正是它要抓的同款错误。
 *     所以 YAML/锁文件解析全部手写，不引 `yaml` 之类的库。
 *   - 解析文件内容一律用 split/indexOf/slice，不用正则引擎去跑文件里的字符串。
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dirname, "..", ".."); // frontend/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // 仓库根

const BUILTINS = new Set(builtinModules);

// ---------------------------------------------------------------------------
// 文件读取
// ---------------------------------------------------------------------------

/** 绝对路径 → 读文本；文件不存在返回 null（供「必须被删掉」类断言使用） */
function readMaybe(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function read(file: string): string {
  const s = readMaybe(file);
  if (s === null) throw new Error(`文件不存在，测试前置条件被破坏：${file}`);
  return s;
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(read(file)) as Record<string, unknown>;
}

/** 去掉每行首尾空白，丢掉空行与纯注释行 */
function codeLines(src: string): string[] {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function unquote(s: string): string {
  const t = s.trim();
  return (t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')) ? t.slice(1, -1) : t;
}

/** YAML 固定缩进切片：前 n 个字符必须全是空格，否则返回 null */
function atIndent(line: string, n: number): string | null {
  if (line.length <= n) return null;
  for (let i = 0; i < n; i++) {
    if (line[i] !== " ") return null;
  }
  return line.slice(n);
}

/**
 * 是否真的调用了 npm（而不是命中 `pnpm install` 里 "npm install" 这个子串）。
 * 判据：每次命中的前一个字符都不是 p，才算一次真调用。
 */
function invokesNpm(src: string, cmd: string): boolean {
  let i = src.indexOf(cmd);
  while (i >= 0) {
    if (i === 0 || src[i - 1] !== "p") return true;
    i = src.indexOf(cmd, i + 1);
  }
  return false;
}

// ---------------------------------------------------------------------------
// git：参数一律是字面量数组，shell:false，绝不拼字符串
// ---------------------------------------------------------------------------

type GitResult = { code: number; out: string };

/**
 * 跑 git 并拿退出码，不抛异常。
 * check-ignore 用退出码区分「未忽略(1)」与「真出错(128)」，必须区分开。
 */
function git(args: string[]): GitResult {
  try {
    return { code: 0, out: execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    const err = e as { status?: number | null; stdout?: string | Buffer; stderr?: string | Buffer };
    return { code: typeof err.status === "number" ? err.status : 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

// ---------------------------------------------------------------------------
// eslint.config.mjs 的 import 抽取
// ---------------------------------------------------------------------------

/** 取包名：`@scope/name/sub` → `@scope/name`，`name/sub` → `name` */
function pkgNameOf(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function looksLikeImportWord(stmt: string): boolean {
  if (!stmt.startsWith("import")) return false;
  if (stmt.length === 6) return true;
  const c = stmt[6];
  return c === " " || c === '"' || c === "'" || c === "{";
}

/** 抽出 JS/MJS 里的裸 import 说明符（相对路径与 node 内置跳过） */
function bareImports(src: string): string[] {
  const out: string[] = [];
  for (const raw of src.split(";")) {
    const stmt = raw.trim();
    if (!looksLikeImportWord(stmt)) continue;
    const dq = stmt.indexOf('"');
    const sq = stmt.indexOf("'");
    let q = -1;
    if (dq >= 0 && sq >= 0) q = Math.min(dq, sq);
    else if (dq >= 0) q = dq;
    else q = sq;
    if (q < 0) continue;
    const quote = stmt[q];
    const end = stmt.indexOf(quote, q + 1);
    if (end < 0) continue;
    const spec = stmt.slice(q + 1, end);
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) continue;
    if (BUILTINS.has(spec)) continue;
    out.push(spec);
  }
  return out;
}

// ---------------------------------------------------------------------------
// pnpm-lock.yaml 的 importers['.'] 解析
// ---------------------------------------------------------------------------

/**
 * 只解析 `importers['.']` 那一段（缩进层级固定，手写够用）：
 *   importers:
 *     .:
 *       dependencies:
 *         jose:            ← 6 空格，包键
 *           specifier: ...  ← 8 空格，值
 * 返回 包名 → specifier。
 */
function parsePnpmImporter(lock: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = lock.split("\n");
  const rootIdx = lines.findIndex((l, i) => i > 0 && l === "  .:");
  if (rootIdx < 0) return out;

  let cur: string | null = null;
  for (let i = rootIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && line[0] !== " ") break; // 顶格 = 离开 importers 段，例如 "packages:"
    const six = atIndent(line, 6);
    if (six !== null && six.endsWith(":") && !six.includes(" ")) {
      cur = unquote(six.slice(0, -1));
      out.set(cur, "");
      continue;
    }
    const eight = atIndent(line, 8);
    if (cur !== null && eight !== null && eight.startsWith("specifier:")) {
      out.set(cur, unquote(eight.slice("specifier:".length)));
    }
  }
  return out;
}

function declaredDeps(): Map<string, { range: string; kind: "dependencies" | "devDependencies" }> {
  const pkg = readJson(path.join(APP_ROOT, "package.json"));
  const out = new Map<string, { range: string; kind: "dependencies" | "devDependencies" }>();
  for (const kind of ["dependencies", "devDependencies"] as const) {
    const block = (pkg[kind] ?? {}) as Record<string, string>;
    for (const [name, range] of Object.entries(block)) out.set(name, { range, kind });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CI 工作流用的极简 YAML 解析（只吃 workflows/ci.yml 这种缩进结构）
// ---------------------------------------------------------------------------

type YNode = { key: string; value: string; children: YNode[] };

/**
 * 按缩进建树。弹栈条件是 `indent <= 当前节点深度`；列表项 `- key: value`
 * 自身深度记为「行缩进」，于是同缩进的兄弟列表项会正确弹栈、
 * 而该项内更深缩进的后续键（with/run）会挂成它的子节点。
 */
function parseYaml(src: string): YNode {
  const root: YNode = { key: "", value: "", children: [] };
  const stack: Array<{ depth: number; node: YNode }> = [{ depth: -1, node: root }];

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;

    while (stack.length > 1 && indent <= stack[stack.length - 1].depth) stack.pop();
    const parent = stack[stack.length - 1].node;

    const body = line.startsWith("- ") ? line.slice(2) : line;
    const colon = body.indexOf(":");
    const node: YNode =
      colon < 0
        ? { key: body, value: "", children: [] }
        : { key: body.slice(0, colon).trim(), value: unquote(body.slice(colon + 1)), children: [] };
    parent.children.push(node);
    stack.push({ depth: indent, node });
  }
  return root;
}

function firstChild(node: YNode | undefined, key: string): YNode | undefined {
  return node?.children.find((c) => c.key === key);
}

const CI_FILE = path.join(REPO_ROOT, ".github/workflows/ci.yml");

/** 取工作流里全部 `run:` 命令（保持出现顺序） */
function ciRunCommands(src: string): string[] {
  const out: string[] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const body = line.startsWith("- ") ? line.slice(2) : line;
    if (body.startsWith("run:")) out.push(unquote(body.slice("run:".length)));
  }
  return out;
}

/** shell 函数体：`name() { ... }`（按行扫描） */
function shellFn(src: string, name: string): string {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => l.trim() === `${name}() {`);
  if (start < 0) throw new Error(`build.sh 里找不到函数 ${name}()`);
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "}") return body.join("\n");
    body.push(lines[i]);
  }
  throw new Error(`build.sh 里函数 ${name}() 没有闭合的 }`);
}

// ===========================================================================
// 1. eslint 依赖未声明 → 干净安装必崩
// ===========================================================================

describe("eslint 配置的依赖声明（ERR_MODULE_NOT_FOUND 防线）", () => {
  const eslintCfg = read(path.join(APP_ROOT, "eslint.config.mjs"));
  const imports = bareImports(eslintCfg);

  it("eslint 配置 import 的每个第三方包都必须在 package.json 里声明（干净安装下 lint 不得 ERR_MODULE_NOT_FOUND）", () => {
    expect(imports.length, "import 抽取器失效，一个裸包都没抓到").toBeGreaterThan(0);
    const declared = new Set(declaredDeps().keys());
    const undeclared = imports.map(pkgNameOf).filter((name) => !declared.has(name));
    expect(undeclared, "eslint.config.mjs import 了未声明的包，干净 pnpm 安装后 next build 的 lint 阶段会崩").toEqual([]);
  });

  it("eslint 配置 import 的每个包都必须在 pnpm-lock.yaml 的 importer 里登记（pnpm 隔离布局才会把它放到 node_modules 顶层）", () => {
    const importer = parsePnpmImporter(read(path.join(APP_ROOT, "pnpm-lock.yaml")));
    const missing = imports.map(pkgNameOf).filter((name) => !importer.has(name));
    expect(missing, "锁文件里没有该包，--frozen-lockfile 装出来的树里 eslint.config.mjs 顶层拿不到它").toEqual([]);
  });

  it("eslint 配置必须用 Next 15 的 flat config（@next/eslint-plugin-next 的 coreWebVitals），不得退回 eslintrc 结构对象", () => {
    expect(eslintCfg).toContain("@next/eslint-plugin-next");
    expect(eslintCfg.replace(/\s+/g, " ")).toContain("flatConfig.coreWebVitals");
    // eslint-config-next / @eslint/eslintrc 都是 eslintrc 结构对象：直接 import 会在
    // @rushstack/eslint-patch 里抛「calling module was not recognized」，
    // 把清晰的 ERR_MODULE_NOT_FOUND 换成更模糊的报错
    expect(imports, "不得 import eslintrc 结构对象").not.toContain("eslint-config-next");
    expect(imports, "不得 import eslintrc 结构对象").not.toContain("@eslint/eslintrc");
    expect(eslintCfg, "不得退回 FlatCompat 桥接").not.toContain("FlatCompat");
  });

  it("默认导出必须是 flat config 数组（Next 的 flat config 是数组，不是单个对象）", () => {
    const marker = "export default";
    const at = eslintCfg.indexOf(marker);
    expect(at, "没找到 export default <name>，eslint 配置结构可能变了").toBeGreaterThanOrEqual(0);
    const name = eslintCfg.slice(at + marker.length).trim().split(" ")[0].replace(";", "");
    expect(name.length).toBeGreaterThan(0);
    expect(eslintCfg.indexOf("const " + name + " = ["), `export default 的 ${name} 必须是数组字面量`).toBeGreaterThanOrEqual(0);
  });

  it("lint 脚本必须走 ESLint CLI（next lint 已废弃，Next 16 直接移除）", () => {
    const pkg = readJson(path.join(APP_ROOT, "package.json")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.lint, "lint 脚本必须是 eslint .").toBe("eslint .");
    expect(pkg.scripts?.lint).not.toContain("next lint");
    // eslint 自身也必须是 devDependency，否则干净安装里根本没有可执行的 lint
    expect(declaredDeps().has("eslint"), "eslint 必须在 devDependencies 里声明").toBe(true);
  });
});

// ===========================================================================
// 2. 双锁漂移
// ===========================================================================

/** 除 pnpm-lock.yaml 外，一切会把安装器引向 npm/yarn/bun 的锁文件 */
const FOREIGN_LOCKS = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lockb", "bun.lock"];

describe("锁文件单一化（双锁漂移防线）", () => {
  it("frontend 下不得残留第二份锁文件（只允许 pnpm-lock.yaml）", () => {
    const present = FOREIGN_LOCKS.filter((f) => fs.existsSync(path.join(APP_ROOT, f)));
    expect(present, "存在第二份锁文件：Vercel 一旦改判 npm/yarn，`npm ci` 会因 not in sync 直接 hard-fail").toEqual([]);
  });

  it("git 跟踪的锁文件只有 pnpm-lock.yaml", () => {
    const tracked = git(["ls-files", "--", "frontend"]).out.split("\n").map((s) => s.trim()).filter(Boolean);
    const locks = tracked.filter((f) => FOREIGN_LOCKS.includes(path.basename(f)));
    // 磁盘上删掉 ≠ 仓库里删掉：删除必须真的进索引（git rm / git add -A），
    // 否则 Vercel 拉到的仓库里那份漂移的 npm 锁还在，npm ci 依旧 not in sync
    expect(locks, "被跟踪的第二份锁文件必须真的从索引里移除：git rm frontend/package-lock.json").toEqual([]);
    expect(tracked).toContain("frontend/pnpm-lock.yaml");
  });

  it("package.json 声明的每个依赖都必须在 pnpm-lock.yaml 的 importer 里登记且版本范围一致（锁文件不得漂移）", () => {
    const importer = parsePnpmImporter(read(path.join(APP_ROOT, "pnpm-lock.yaml")));
    const problems: string[] = [];
    for (const [name, dep] of declaredDeps()) {
      if (!importer.has(name)) {
        problems.push(`${name} 未登记在 importers['.']`);
      } else if (importer.get(name) !== dep.range) {
        problems.push(`${name} 范围不一致：package.json=${dep.range} 锁=${importer.get(name)}`);
      }
    }
    expect(problems, "package.json 与 pnpm-lock.yaml 已漂移，--frozen-lockfile 会直接失败").toEqual([]);
  });

  it("packageManager 若写死必须是 Vercel 官方支持的 pnpm 版本（不得 pin 到未支持的大版本）", () => {
    const pm = readJson(path.join(APP_ROOT, "package.json")).packageManager;
    if (pm === undefined) return; // 不写 packageManager 是允许的（vercel.json 的 installCommand 无条件生效）
    expect(typeof pm, `packageManager 应为 pnpm@x.y.z 字符串，实际=${String(pm)}`).toBe("string");
    const seg = String(pm).split("@")[1] ?? "";
    // Vercel 官方支持表只列到 pnpm 6/7/8/9/10；lockfileVersion 9.0 对应 pnpm 9 或 10
    expect([9, 10], `pin 到了 Vercel 不支持的 pnpm 大版本：${String(pm)}`).toContain(Number(seg.split(".")[0]));
  });
});

// ===========================================================================
// 3. 零 CI
// ===========================================================================

describe("GitHub Actions（用例自动执行防线）", () => {
  const ci = readMaybe(CI_FILE);
  const src = ci ?? ""; // 文件缺失时下面各条会给出可读的失败信息，而不是 TypeError

  it("仓库必须有 .github/workflows/ci.yml", () => {
    expect(ci, "零 CI：vitest 用例在任何地方都不会自动执行，坏测试静默进 main").not.toBeNull();
  });

  it("工作流必须在 push 与 pull_request 上触发", () => {
    const on = firstChild(parseYaml(src), "on");
    expect(on, "工作流缺少 on: 触发器").toBeTruthy();
    const keys = on!.children.map((c) => c.key);
    expect(keys).toContain("push");
    expect(keys).toContain("pull_request");
  });

  it("工作流必须只留一个 job，且默认在 frontend 目录执行（前端才是唯一应用）", () => {
    const jobs = firstChild(parseYaml(src), "jobs");
    expect(jobs, "工作流缺少 jobs:").toBeTruthy();
    expect(jobs!.children, "只保留单个 job").toHaveLength(1);
    const run = firstChild(firstChild(jobs!.children[0], "defaults"), "run");
    expect(firstChild(run, "working-directory")?.value).toBe("frontend");
  });

  it("CI 必须依次跑：--frozen-lockfile 安装 → lint → tsc --noEmit → test → build", () => {
    const runs = ciRunCommands(src);
    const at = (needle: string) => {
      const i = runs.findIndex((r) => r.includes(needle));
      expect(i, `CI 缺少步骤：${needle}（实际步骤=${JSON.stringify(runs)}）`).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = [at("pnpm install --frozen-lockfile"), at("pnpm run lint"), at("tsc --noEmit"), at("pnpm test"), at("pnpm build")];
    expect(order, `CI 步骤顺序错乱：${JSON.stringify(runs)}`).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size, `CI 步骤被重复命中：${JSON.stringify(runs)}`).toBe(order.length);
  });

  it("CI 的 test 步骤必须真的跑全量 vitest（不重试、不吞失败，偶发红必须暴露）", () => {
    expect(src, "测试失败不得 continue-on-error").not.toContain("continue-on-error");
    for (const plugin of ["nick-fields/retry", "ncipollo/retry", "rtfp.github/test-reporter"]) {
      expect(src, `测试步骤不得引入重试/吞失败插件：${plugin}`).not.toContain(plugin);
    }
    for (const l of codeLines(src)) {
      expect(l.startsWith("retry:"), "测试步骤不设重试：偶发红必须暴露").toBe(false);
    }

    // package.json 的 test 脚本必须是单次全量跑，而不是 watch / 带路径过滤
    const pkg = readJson(path.join(APP_ROOT, "package.json")) as { scripts?: Record<string, string> };
    const testScript = pkg.scripts?.test ?? "";
    expect(testScript).toBe("vitest run");
    expect(testScript).not.toContain(".only");
  });

  it("CI 必须用 pnpm 缓存，且缓存键指向 pnpm-lock.yaml（缓存不指向锁文件等于没缓存）", () => {
    const flat = JSON.stringify(parseYaml(src));
    expect(flat).toContain("pnpm/action-setup");
    expect(flat).toContain("actions/setup-node");
    const lines = codeLines(src);
    expect(lines).toContain("cache: pnpm");
    expect(lines).toContain("cache-dependency-path: frontend/pnpm-lock.yaml");
  });
});

// ===========================================================================
// 3.5 vitest 双 project：组件行为层在 CI 里必须真的跑得到
// ===========================================================================

/**
 * 被守护的缺陷：AnalyzeView 的定时器/genId 守卫、Mermaid 的 error 复位、
 * MapView 的非 passive wheel 监听，全是 effect/cleanup 与原生事件时序——
 * 修复前 vitest 是单 project + environment:"node"，这一层**一行都跑不起来**
 * （.tsx 还会因为 tsconfig 的 "jsx":"preserve" 直接解析失败）。
 * 于是 303 个 node 用例全绿，这批改动坏掉也照样全绿：CI 照不到。
 *
 * 修法是拆 test.projects（node 收 *.test.ts / dom 收 *.test.tsx）。
 * 本组用例钉的是**基建本身**：哪天有人把 dom project 合回去、把 .tsx 从 include 里
 * 删掉、或从 devDependencies 里摘掉 jsdom，CI 会重新变成全绿且毫无察觉——
 * 这正是缺陷单说的「照不到」原样回来。
 */
describe("vitest 双 project（组件行为层可达性防线）", () => {
  const configSrc = read(path.join(APP_ROOT, "vitest.config.mts"));
  const pkg = readJson(path.join(APP_ROOT, "package.json")) as {
    devDependencies?: Record<string, string>;
  };

  it("必须用 test.projects 划成 node + dom 两个环境（单 project 满足不了相反的两个诉求）", () => {
    expect(configSrc, "vitest 必须拆 projects：node 用例不能整体进 jsdom，而 .tsx 又非 jsdom 不可").toMatch(/projects\s*:/);
    expect(configSrc, "缺少名为 node 的 project").toMatch(/name:\s*"node"/);
    expect(configSrc, "缺少名为 dom 的 project").toMatch(/name:\s*"dom"/);
  });

  it("dom project 必须真用 jsdom 环境，且只收 *.test.tsx", () => {
    expect(
      configSrc,
      "dom project 必须是 jsdom：effect/cleanup、原生 wheel 监听、preventDefault 在 node 环境全是空转",
    ).toMatch(/environment:\s*"jsdom"/);
    expect(configSrc, "dom project 的 include 应只收 *.test.tsx").toMatch(/include:\s*\[\s*"src\/\*\*\/\*\.test\.tsx"\s*\]/);
  });

  it("dom project 必须把 jsx 覆写成 automatic（tsconfig 是 jsx:preserve，不覆写则 .tsx 解析即失败）", () => {
    expect(
      configSrc,
      "缺 oxc.jsx=\"automatic\"：vite 的转换器会照 tsconfig 留下 JSX，报 Failed to parse source for import analysis",
    ).toMatch(/oxc:\s*\{\s*jsx:\s*"automatic"\s*\}/);
  });

  it("node project 必须原地不动：仍是 node 环境、只收 *.test.ts（别顺手把几百个用例拖进 jsdom）", () => {
    expect(configSrc, "node project 的 environment 必须还是 node").toMatch(/name:\s*"node"[\s\S]*?environment:\s*"node"/);
    expect(configSrc, "node project 的 include 应只收 *.test.ts").toMatch(
      /environment:\s*"node"[\s\S]*?include:\s*\[\s*"src\/\*\*\/\*\.test\.ts"\s*\]/
    );
  });

  it("两个 include 必须后缀互斥，否则同一个组件测试会在两个环境各跑一遍", () => {
    const includes = [...configSrc.matchAll(/include:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
    expect(includes, "应恰好有两个 project 的 include").toHaveLength(2);
    const nodeInclude = includes.find((i) => /\.test\.ts"/.test(i));
    const domInclude = includes.find((i) => /\.test\.tsx"/.test(i));
    expect(nodeInclude, "没找到 node project 的 include").toBeTruthy();
    expect(domInclude, "没找到 dom project 的 include").toBeTruthy();

    // 按 glob 逐条看后缀：不能用 includes(".test.ts") 判，"*.test.tsx" 里也含 ".test.ts" 子串
    const globs = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const nodeGlobs = globs(nodeInclude!);
    const domGlobs = globs(domInclude!);
    expect(
      nodeGlobs.filter((g) => g.endsWith(".test.tsx")),
      "node project 若也收 .tsx，同一个文件会在 node 和 jsdom 各跑一遍",
    ).toEqual([]);
    expect(
      domGlobs.filter((g) => g.endsWith(".test.ts")),
      "dom project 若也收 .ts，几百个纯逻辑用例会白跑一遍 jsdom",
    ).toEqual([]);
    expect(nodeGlobs.some((g) => g.endsWith(".test.ts")), "node project 至少要收 *.test.ts").toBe(true);
    expect(domGlobs.some((g) => g.endsWith(".test.tsx")), "dom project 至少要收 *.test.tsx").toBe(true);
  });

  it("jsdom 与 @testing-library/react 必须进 devDependencies（干净环境装得上，--frozen-lockfile 才不挂）", () => {
    const dev = Object.keys(pkg.devDependencies ?? {});
    expect(dev, "缺 jsdom：dom project 会直接报 environment 找不到").toContain("jsdom");
    expect(dev, "缺 @testing-library/react：组件用例没有 render/cleanup 可用").toContain("@testing-library/react");
  });

  it("组件行为用例真的存在（配置留着、用例删光 = CI 照样全绿）", () => {
    const tsxTests = fs.readdirSync(path.join(APP_ROOT, "src", "components")).filter((f) => f.endsWith(".test.tsx"));
    expect(tsxTests, "src/components 下一个 *.test.tsx 都没有，dom project 是空配置").not.toHaveLength(0);
    // 这两条是缺陷单点名要的最值钱的两条：Mermaid 的 error 复位、MapView 的非 passive wheel
    for (const required of ["Mermaid.test.tsx", "MapView.test.tsx"]) {
      expect(tsxTests, `组件行为用例缺失：${required}`).toContain(required);
    }
  });

  it("AST 结构层与行为层分工仍在：*.test.ts 留在 node 层，不得改成 .tsx", () => {
    const tsTests = fs.readdirSync(path.join(APP_ROOT, "src", "components")).filter((f) => f.endsWith(".test.ts"));
    expect(tsTests, "Mermaid.contract.test.ts 这类 AST 结构层用例应继续留在 node project").toContain("Mermaid.contract.test.ts");
  });
});

// ===========================================================================
// 3.6 D1 迁移流程文档：schema.sql 只是存档，改表结构必须手工跑迁移
// ===========================================================================

/**
 * 被守护的缺陷：`db/schema.sql` 每张表都是 `CREATE TABLE IF NOT EXISTS`，
 * 而它的文件头写着「已通过 Cloudflare API 自动创建（仅作存档与审计）」。
 * 表一旦存在，`IF NOT EXISTS` 就是 no-op —— **仓库里改 schema.sql 对线上 D1 毫无效果**。
 * auth-5 把 users.login 从 UNIQUE 降级时只改了存档，应用层还有 catch 兜底
 * （auth.ts 的 upsertUserFromGithub / getUserBySession），所以线上不报错，
 * 只表现为「同一浏览器换 GitHub 号后，明明登录了却是游客」。
 *
 * 这组用例守的是「下一个人改表结构时会知道有迁移这回事」：
 * 迁移脚本在 db/ 下、部署步骤写在 DEPLOY_VERCEL.md，缺一不可。
 * 脚本本身的行为（会不会级联删库）由 src/lib/d1Migration.test.ts 真跑 SQLite 验证。
 */
describe("D1 迁移流程（schema.sql 改了不算数）", () => {
  const deployDoc = read(path.join(REPO_ROOT, "DEPLOY_VERCEL.md"));

  it("DEPLOY_VERCEL.md 必须写明：schema.sql 只是存档，改表结构必须手工跑 db/migrate-*.sql", () => {
    expect(deployDoc, "部署文档没有 D1 迁移这一节，下一个人改 schema.sql 会以为已经生效").toMatch(/migrate-\*\.sql|migrate-\w/);
    // 「存档」这个词要出现在文档里，否则读者会以为 schema.sql 是部署源
    expect(deployDoc, "必须点明 schema.sql 只是存档、不影响线上").toMatch(/存档/);
    expect(deployDoc, "必须点明不改表结构就得手工跑迁移").toMatch(/手工|手动/);
  });

  it("db/ 下的每个迁移脚本都必须登记进部署文档（写了迁移忘了写进文档 = 没人会执行）", () => {
    const dbDir = path.join(APP_ROOT, "db");
    const migrations = fs.readdirSync(dbDir).filter((f) => f.startsWith("migrate-") && f.endsWith(".sql"));
    expect(migrations, "db/ 下没有迁移脚本").not.toHaveLength(0);
    for (const m of migrations) {
      expect(deployDoc, `迁移脚本 ${m} 没有登记进 DEPLOY_VERCEL.md`).toContain(m);
    }
  });

  it("必须写明执行前导出 SQL 备份（迁移脚本不含事务，备份是唯一回滚手段）", () => {
    expect(deployDoc, "必须要求执行前导出备份").toMatch(/备份/);
    expect(deployDoc, "必须说明为什么需要备份").toMatch(/导出|Export/);
    expect(deployDoc, "必须说明脚本不含事务、不能 ROLLBACK").toMatch(/ROLLBACK|回滚/);
  });

  it("必须禁用 wrangler d1 migrations apply（它会包事务，PRAGMA foreign_keys 静默失效 → 级联删库）", () => {
    expect(deployDoc, "必须点名禁用 wrangler d1 migrations apply").toMatch(/wrangler d1 migrations apply/);
    expect(deployDoc, "禁用说明附近应提到事务或 foreign_keys").toMatch(/foreign_keys/);
  });

  it("schema.sql 自己也要自述只是存档（表已存在时 CREATE TABLE IF NOT EXISTS 是 no-op）", () => {
    const schema = read(path.join(APP_ROOT, "db", "schema.sql"));
    expect(schema, "schema.sql 的文件头必须自述「仅作存档」").toMatch(/存档/);
    expect(schema, "schema.sql 必须自述无需手动执行").toMatch(/无需手动执行|已通过 Cloudflare API/);
    // 反过来钉：schema.sql 里绝不能出现裸的 CREATE TABLE（不带 IF NOT EXISTS）去「建」线上表
    expect(schema, "schema.sql 不该有裸 CREATE TABLE（线上表已存在，裸建表只会在新环境里造出一张结构不同的表）").not.toMatch(
      /^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/im
    );
  });
});

// ===========================================================================
// 4. 工具产物误入库
// ===========================================================================

describe(".gitignore 工具产物段", () => {
  it(".gitignore 必须显式忽略 .mimosa/ .v2c/ .zcode/", () => {
    const entries = codeLines(read(path.join(REPO_ROOT, ".gitignore")));
    for (const entry of [".mimosa/", ".v2c/", ".zcode/"]) {
      expect(entries, `.gitignore 缺少 ${entry} 规则`).toContain(entry);
    }
  });

  it("git 必须真的判定这些工具产物被忽略（不是只在 .gitignore 里写了个摆设）", () => {
    const probes = [
      ["check-ignore", "-v", "--", ".mimosa/probe.json"],
      ["check-ignore", "-v", "--", ".v2c/probe.json"],
      ["check-ignore", "-v", "--", ".zcode/probe.json"],
    ];
    for (const args of probes) {
      const r = git(args);
      expect(r.code, `git 未忽略 ${args[3]}；退出码 ${r.code}：${r.out}`).toBe(0);
    }
  });

  it("这些工具目录一旦误提交也必须从索引里摘掉", () => {
    const tracked = git(["ls-files", "--", ".mimosa", ".v2c", ".zcode"]).out.split("\n").map((s) => s.trim()).filter(Boolean);
    expect(tracked, "工具产物仍在 git 索引里，需要 git rm -r --cached").toEqual([]);
  });
});

// ===========================================================================
// 5. build.sh / vercel.json 与 pnpm 单一安装器对齐
// ===========================================================================

describe("安装器单一化：build.sh 与 vercel.json 必须走 pnpm", () => {
  const buildSh = read(path.join(REPO_ROOT, "build.sh"));

  it("build.sh 的 install_dependencies 必须用 pnpm install --frozen-lockfile", () => {
    const body = shellFn(buildSh, "install_dependencies");
    expect(body).toContain("pnpm install --frozen-lockfile");
    for (const forbidden of ["npm ci", "npm install", "npm i "]) {
      expect(invokesNpm(body, forbidden), `install_dependencies 不得 ${forbidden}：锁漂移时 npm 会静默解析出与 Vercel 不同的依赖树`).toBe(false);
    }
    expect(body).not.toContain("yarn");
  });

  it("build.sh 的 build_project 必须用 pnpm run build", () => {
    const body = shellFn(buildSh, "build_project");
    expect(body).toContain("pnpm run build");
    expect(invokesNpm(body, "npm run build")).toBe(false);
  });

  it("build.sh 全文不得出现 npm ci / npm install / npm run build", () => {
    for (const forbidden of ["npm ci", "npm install", "npm run build"]) {
      expect(invokesNpm(buildSh, forbidden), `build.sh 全文不得出现 ${forbidden}`).toBe(false);
    }
  });

  it("vercel.json 必须钉死 installCommand 为 pnpm install --frozen-lockfile（不依赖 packageManager 字段那条 Corepack 限定）", () => {
    const v = readJson(path.join(REPO_ROOT, "vercel.json")) as { installCommand?: unknown };
    expect(v.installCommand).toBe("pnpm install --frozen-lockfile");
  });

  it("DEPLOY_VERCEL.md 的构建说明与 pnpm 一致，不得再教 npm ci", () => {
    const doc = read(path.join(REPO_ROOT, "DEPLOY_VERCEL.md"));
    expect(doc).toContain("pnpm install --frozen-lockfile");
    for (const forbidden of ["npm ci", "npm install"]) {
      expect(invokesNpm(doc, forbidden), `部署文档不得再教 ${forbidden}（与 vercel.json 的 pnpm installCommand 矛盾）`).toBe(false);
    }
  });
});
