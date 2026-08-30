/**
 * GitHub 项目 ingestor（服务端专用，仅供 /api/analyze 调用，不从前端 import）。
 *
 * 把 owner/repo 物化成一段有界文本 digest，交给统一的 LLM 深挖管线。
 *
 * 策略（单遍，v1）：仓库元信息 + README + 目录结构预览 + 若干精选核心文件。
 * 单遍足够覆盖"面向新手的入门解读 + Roadmap + 架构 + 模块拆解"；
 * 两遍式「先骨架 → 按需深读核心文件」留给将来 repo 报告变得不够时再做（见 prompt 注释）。
 *
 * 限流：未配置 GITHUB_TOKEN 时遵循 GitHub 公共 API 60 次/小时；本工具单仓库 ~10 次调用，
 * 个人学习场景远够用。配置 GITHUB_TOKEN 则享受 5000 次/小时。
 */

export interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  default_branch: string;
  homepage: string | null;
}

export interface RepoFile {
  path: string;
  size: number;
  type: "blob" | "tree";
}

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const TOKEN = process.env.GITHUB_TOKEN;

const HEADERS: Record<string, string> = TOKEN
  ? { Accept: "application/vnd.github+json", Authorization: `Bearer ${TOKEN}`, "User-Agent": "study-with-me" }
  : { Accept: "application/vnd.github+json", "User-Agent": "study-with-me" };

async function gh<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: HEADERS, signal });
  if (!res.ok) {
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("GitHub API 配额已用尽（未认证 60 次/小时），请稍后再试或配置 GITHUB_TOKEN");
    }
    throw new Error(`GitHub API ${res.status}（${path}）`);
  }
  return (await res.json()) as T;
}

/** 按 owner/repo 路径拉取原始文件文本（raw.githubusercontent，最省配额；repo 模块深挖也用） */
export async function fetchRawFile(owner: string, repo: string, branch: string, path: string, signal?: AbortSignal): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${RAW}/${owner}/${repo}/${branch}/${encoded}`, { signal });
  if (!res.ok) throw new Error(`RAW ${res.status}（${path}）`);
  return res.text();
}

export async function fetchRepoMeta(owner: string, repo: string, signal?: AbortSignal): Promise<RepoMeta> {
  return gh<RepoMeta>(`/repos/${owner}/${repo}`, signal);
}

export async function fetchReadme(owner: string, repo: string, signal?: AbortSignal): Promise<string> {
  const data = await gh<{ content?: string }>(`/repos/${owner}/${repo}/readme`, signal);
  if (!data.content) return "";
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function fetchTree(owner: string, repo: string, branch: string, signal?: AbortSignal): Promise<RepoFile[]> {
  const data = await gh<{ tree: { path?: string; size?: number; type?: string }[] }>(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    signal
  );
  return (data.tree ?? [])
    .filter((t) => t.path && (t.type === "blob" || t.type === "tree"))
    .map((t) => ({ path: t.path!, size: t.type === "blob" ? (t.size ?? 0) : 0, type: t.type as RepoFile["type"] }));
}

/** 从 "owner/repo" 参数拆出 owner 与 repo（第二个 "/" 之后的全并入 repo 名，含子路径忽略） */
export function parseRepoParam(s: string): { owner: string; repo: string } {
  const [owner, ...rest] = s.trim().split("/");
  const repo = rest.join("/") || owner;
  return { owner: owner || "unknown", repo };
}

// ---------------- 纯函数：文件精选 / digest 组装（可单测） ----------------

const HEAVY = /(^|\/)(node_modules|dist|build|\.next|\.git|vendor|target|\.venv|__pycache__|coverage|docs\/_build)(\/|$)/;
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tar|jar|class|wasm|min\.(js|css)|map|dll|ai|sketch|psd|fig|heic|mp4|mov|webm|mp3|wav)$/i;
/** 渲染产物页（生成文档/示例页）：对读代码无价值，且体量大爱抢占额度 */
const RENDER_DOC = /\.html?$/i;
/** 锁文件：纯噪音 */
const LOCKFILE = /(^|\/)(package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json|composer\.lock|go\.sum|gemfile\.lock|cargo\.lock|poetry\.lock|uv\.lock)$/i;
/** 代码类扩展名：选文件时优先于文档，避免大文档吃光额度 */
const CODEISH = /\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|rb|php|c|cc|cpp|h|hpp|cs|swift|kt|sh|sql|vue|svelte|astro|ya?ml|toml|json|css|scss|less|mdx|ipynb)$/i;
/** 「实现目录」加成：位于 src/lib/core/bin/cli 下的文件更可能承载核心逻辑（对扁平 monorepo 尤其重要） */
const SRC_DIR = /(^|\/)(src|lib|core|bin|cli)(\/|$)/;
/** 测试降权：同一预算里优先实现而非测试 */
const TEST_PATH = /(^|\/)(test|tests|spec|__tests__|__snapshots__)(\/|$)/;
/** 根层纯文档（README 系列/变更日志/路线图/设计稿）：对读代码无用，README 已由单独端点提供 */
const ROOT_DOC = /^[^/]+\.md$/i;
/** 任意层的噪音文档名：名字即说明其非核心代码 */
const NOISE_DOC = /(^|\/)(changelog|roadmap|design|product|todo|ideas?|notes?|spec|screenshots?)\.md$/i;
/** 根目录单文件清单：配置 / 清单 / 许可证 —— 高优先级但封顶，避免文档吃光全部额度 */
const KNOWN_ROOT = new Set([
  "package.json", "pyproject.toml", "go.mod", "cargo.toml", "pom.xml", "build.gradle",
  "requirements.txt", "setup.py", "gemfile", "composer.json", "makefile", "dockerfile",
  "docker-compose.yml", "tsconfig.json", "webpack.config.js", "vite.config.ts", "vite.config.js",
  "next.config.js", "wrangler.toml", "backend.toml", "license", "license.md", "copying",
]);

/** 精选要深读的文件：排除重型/二进制/纯文档噪音，优先根层已知配置（封顶 3 个），其余额度至少一半留给真源码 */
export function selectFiles(
  files: RepoFile[],
  opts: { max?: number; maxSize?: number; maxKnown?: number } = {}
): RepoFile[] {
  const max = opts.max ?? 8;
  const maxSize = opts.maxSize ?? 100 * 1024;
  const maxKnown = opts.maxKnown ?? 3;
  const blobs = files.filter(
    (f) =>
      f.type === "blob" &&
      f.size > 0 &&
      f.size <= maxSize &&
      !HEAVY.test(f.path) &&
      !BINARY.test(f.path) &&
      !RENDER_DOC.test(f.path) &&
      !ROOT_DOC.test(f.path) &&
      !NOISE_DOC.test(f.path) &&
      !LOCKFILE.test(f.path)
  );
  // ponytail: 采样启发式，无完美解；密度+实现目录+降权测试后即为 v1 上限，换两遍式深读前不再加规则
  const scored = blobs.map((f) => {
    const depth = f.path.split("/").length;
    return {
      ...f,
      depth,
      codeish: CODEISH.test(f.path) ? 1 : 0,
      srcBonus: SRC_DIR.test(f.path) ? 1 : 0,
      testPenalty: TEST_PATH.test(f.path) ? 1 : 0,
      topdir: depth === 1 ? "" : f.path.split("/")[0],
    };
  });
  // 顶层目录代码密度（该目录有多少代码文件）——"主源码树"的便宜近似，避免构建脚本/示例抢走额度
  const density = new Map<string, number>();
  for (const f of scored) density.set(f.topdir, (density.get(f.topdir) ?? 0) + f.codeish);
  const isKnown = (f: { path: string; depth: number }) => f.depth === 1 && KNOWN_ROOT.has(f.path.toLowerCase());
  const known = scored.filter(isKnown).slice(0, maxKnown);
  const other = scored
    .filter((f) => !isKnown(f))
    .sort(
      (a, b) =>
        b.srcBonus - a.srcBonus ||
        (density.get(b.topdir) ?? 0) - (density.get(a.topdir) ?? 0) ||
        b.codeish - a.codeish ||
        a.depth - b.depth ||
        a.testPenalty - b.testPenalty ||
        b.size - a.size
    );
  const otherBudget = Math.max(max - known.length, Math.ceil(max / 2));
  return [...known, ...other.slice(0, otherBudget)].slice(0, max);
}

/** 截断文本到上限（保留头部信息最浓的部分） */
export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…（已截断）";
}

/** 目录结构预览：只展示前 depth 层，单行一节点 */
export function treePreview(files: RepoFile[], depth = 2, maxLines = 50): string {
  const roots = new Set<string>();
  const lines: string[] = [];
  for (const f of files) {
    const parts = f.path.split("/");
    // 顶层目录先聚合一次（展示"有哪些大块"）
    if (f.type === "tree" && parts.length <= depth) {
      if (roots.has(f.path)) continue;
      roots.add(f.path);
    } else if (f.type === "blob" && parts.length > depth + 1) {
      continue; // 深层文件不在目录预览里（避免淹没）
    }
    lines.push(`${"  ".repeat(parts.length - 1)}- ${parts[parts.length - 1]}${f.type === "tree" ? "/" : ""}`);
    if (lines.length >= maxLines) {
      lines.push("…（更多略）");
      break;
    }
  }
  return lines.join("\n");
}

/** 把仓库物化成一段有界 digest 文本，交给 LLM */
export function buildDigest(
  meta: Pick<RepoMeta, "full_name" | "description" | "stargazers_count" | "language" | "topics" | "homepage">,
  readme: string,
  tree: RepoFile[],
  contents: Map<string, string>
): string {
  const topics = (meta.topics ?? []).slice(0, 6).join(", ");
  const parts: string[] = [];

  parts.push(
    `# ${meta.full_name}\n\n` +
    `- ⭐ ${meta.stargazers_count?.toLocaleString?.() ?? meta.stargazers_count ?? 0} 星` +
    (meta.language ? ` | 语言 ${meta.language}` : "") +
    (meta.description ? `\n- 一句话简介：${meta.description}` : "") +
    (topics ? `\n- 主题：${topics}` : "") +
    (meta.homepage ? `\n- 官网：${meta.homepage}` : "")
  );

  const readmeText = clamp(readme || "（无 README）", 6000);
  parts.push(`## README（仓库官方文档）\n${readmeText}`);

  if (tree.length > 0) {
    parts.push(`## 目录结构（前 2 层）\n${treePreview(tree)}`);
  }

  const fileParts: string[] = [];
  for (const f of tree.filter((t) => t.type === "blob")) {
    const text = contents.get(f.path);
    if (text == null) continue;
    fileParts.push(`### ${f.path}\n${clamp(text, 2500)}`);
  }
  if (fileParts.length > 0) {
    parts.push(`## 精选核心文件\n${fileParts.join("\n\n")}`);
  }

  return parts.join("\n\n");
}

/** 编排：抓元信息 → README + 目录树 → 精选文件 → 拼 digest（tree 一并返回，供地图 prompt 列真实路径） */
export async function ingestRepo(owner: string, repo: string, signal?: AbortSignal): Promise<{ meta: RepoMeta; digest: string; tree: RepoFile[] }> {
  const meta = await fetchRepoMeta(owner, repo, signal);
  const branch = meta.default_branch;
  const [readme, tree] = await Promise.all([
    fetchReadme(owner, repo, signal).catch(() => ""),
    fetchTree(owner, repo, branch, signal).catch(() => [] as RepoFile[]),
  ]);

  const blobs = tree.filter((f) => f.type === "blob");
  const selected = selectFiles(blobs);
  const contents = new Map<string, string>();
  await Promise.all(
    selected.map(async (f) => {
      try {
        contents.set(f.path, await fetchRawFile(owner, repo, branch, f.path, signal));
      } catch {
        /* 单个文件失败跳过，不阻塞整体 */
      }
    })
  );

  return { meta, digest: buildDigest(meta, readme, tree, contents), tree };
}

/* ---------- digest 内存缓存：重试 / 重新分析直接复用，避免同一仓库反复打 GitHub ---------- */

interface IngestResult {
  digest: string;
  tree: RepoFile[]; // 完整目录树（repo 地图 prompt 用它列真实路径，防模型编造 keyFiles）
}

const digestCache = new Map<string, { result: IngestResult; at: number }>();
const DIGEST_TTL_MS = 15 * 60 * 1000;
const DIGEST_CACHE_MAX = 40;

/** 带缓存入口：15 分钟内同一仓库不重复抓取（服务端进程内存，冷启动后自动回退为真实抓取） */
export async function ingestRepoCached(owner: string, repo: string, signal?: AbortSignal): Promise<IngestResult & { cached: boolean }> {
  const key = `${owner}/${repo}`;
  const hit = digestCache.get(key);
  if (hit && Date.now() - hit.at < DIGEST_TTL_MS) {
    return { ...hit.result, cached: true };
  }
  const { digest, tree } = await ingestRepo(owner, repo, signal);
  if (digestCache.size >= DIGEST_CACHE_MAX) {
    const oldest = digestCache.keys().next().value;
    if (oldest != null) digestCache.delete(oldest);
  }
  const result: IngestResult = { digest, tree };
  digestCache.set(key, { result, at: Date.now() });
  return { ...result, cached: false };
}

/* ---------- 模块级抓取：供 /api/repo/module（源码走读）与 /api/repo/module/atlas（内部地图）共用 ---------- */

/** 深读文件精选：keyFiles 优先（封顶 max）；缺失时退化为 dir 前缀下的代码文件按体积挑 */
const MODULE_CODEISH = /\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|rb|php|c|cc|cpp|h|hpp|cs|swift|kt|sh|sql|vue|svelte|ya?ml|toml)$/i;

export function pickModuleFiles(keyFiles: string[], tree: RepoFile[], dir: string, max = 4): string[] {
  const fromKeys = keyFiles.filter((p) => p.trim() && !p.split("/").includes("..")).slice(0, max);
  if (fromKeys.length > 0) return fromKeys;
  const prefix = dir ? dir.replace(/\/?$/, "/") : "";
  return tree
    .filter((f) => f.type === "blob" && f.size > 0 && f.size <= 100 * 1024 && f.path.startsWith(prefix) && MODULE_CODEISH.test(f.path))
    .sort((a, b) => b.size - a.size)
    .slice(0, max)
    .map((f) => f.path);
}

/** 抓取模块源码物化成有界 digest：元信息(拿 branch) → 树(仅缺 keyFiles 时) → 并行拉文件（单文件失败跳过） */
export async function fetchModuleDigest(
  owner: string,
  repo: string,
  keyFiles: string[],
  dir: string,
  signal?: AbortSignal
): Promise<string> {
  const meta = await fetchRepoMeta(owner, repo, signal);
  let tree: RepoFile[] = [];
  if (keyFiles.length === 0 && dir) {
    tree = await fetchTree(owner, repo, meta.default_branch, signal).catch(() => []);
  }
  const picked = pickModuleFiles(keyFiles, tree, dir);
  // 每个文件用独立超时：不用外部 signal，避免整体快到点时把所有文件一并静默吞掉
  const contents = await Promise.all(
    picked.map(async (p) => {
      try {
        const text = await fetchRawFile(owner, repo, meta.default_branch, p, AbortSignal.timeout(25_000));
        return `### ${p}\n${clamp(text, 3500)}`;
      } catch {
        return ""; // 单文件失败跳过，不阻塞整体
      }
    })
  );
  return contents.filter(Boolean).join("\n\n");
}
