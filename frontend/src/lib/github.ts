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
 *
 * 安全红线：GITHUB_TOKEN 必须是 fine-grained 且**不给任何 repository scope**。
 * 本工具只处理公开仓库，fetchRepoMeta 见到 private 立即拒绝——否则带 token 的请求
 * 会把私有仓库的 README / 完整目录树 / 源码原样读出，再转发给第三方 AI 服务。
 */

export interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  default_branch: string;
  homepage: string | null;
  /** GitHub 运行时 JSON 里有这个字段；true = 私有仓库，一律拒绝（见 fetchRepoMeta） */
  private: boolean;
}

export interface RepoFile {
  path: string;
  size: number;
  type: "blob" | "tree";
}

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
/** 可选。必须是 fine-grained PAT 且不给任何 repository scope：本工具只读公开仓库，多给一个权限就多一份外泄面 */
const TOKEN = process.env.GITHUB_TOKEN;

const HEADERS: Record<string, string> = TOKEN
  ? { Accept: "application/vnd.github+json", Authorization: `Bearer ${TOKEN}`, "User-Agent": "study-with-me" }
  : { Accept: "application/vnd.github+json", "User-Agent": "study-with-me" };

/** 单文件抓取上限：raw 支持 Range，只取头部，几十 MB 的文件不会进内存 */
const RAW_RANGE_BYTES = 20_000;

/**
 * 「必须让用户知道」的抓取失败。
 *
 * 静默降级（空 README / 空目录树）比直接报错坏得多：prompt 里「仓库真实文件路径清单」
 * 会是空的，而 schema 又要求 keyFiles 逐字来自清单，模型只能编造并落库成复习卡。
 * 所以除「仓库确实没有 README」外，readme/tree 的任何失败都抛这个类型，不在调用处吞。
 */
export class GitHubFetchError extends Error {
  /** 失败性质：调用方据此给出可操作的文案，而不是一律"请稍后重试" */
  readonly reason: "private" | "quota" | "http" | "network" | "parse";
  /** HTTP 状态码；网络层失败（DNS / 超时 / 连接中断）为 undefined */
  readonly status: number | undefined;
  /** 建议等待秒数：配额耗尽时来自 Retry-After / X-RateLimit-Reset，回传给客户端 */
  readonly retryAfter: number | undefined;
  constructor(
    message: string,
    opts: { reason: "private" | "quota" | "http" | "network" | "parse"; status?: number; retryAfter?: number }
  ) {
    super(message);
    this.name = "GitHubFetchError";
    this.reason = opts.reason;
    this.status = opts.status;
    this.retryAfter = opts.retryAfter;
  }
}

/** 配额耗尽时算「多久后再试」：优先 Retry-After，其次 X-RateLimit-Reset（epoch 秒） */
function retryAfterFrom(res: Response): number | undefined {
  const ra = Number(res.headers.get("retry-after"));
  if (Number.isFinite(ra) && ra > 0) return Math.ceil(ra);
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return Math.max(60, Math.ceil(reset - Date.now() / 1000));
  return undefined;
}

async function gh<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: HEADERS, signal });
  } catch {
    // DNS / 连接 / 超时同样不能吞：吞了就变成"空仓库"喂给模型
    throw new GitHubFetchError(`GitHub 网络请求失败（${path}）`, { reason: "network" });
  }
  if (!res.ok) {
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      throw new GitHubFetchError("GitHub API 配额已用尽（未认证 60 次/小时），请稍后再试或配置 GITHUB_TOKEN", {
        reason: "quota",
        status: res.status,
        retryAfter: retryAfterFrom(res),
      });
    }
    throw new GitHubFetchError(`GitHub API ${res.status}（${path}）`, { reason: "http", status: res.status });
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new GitHubFetchError(`GitHub 响应解析失败（${path}）`, { reason: "parse", status: res.status });
  }
}

/** 按 owner/repo 路径拉取原始文件文本（raw.githubusercontent，不吃 API 配额；repo 模块深挖也用） */
export async function fetchRawFile(owner: string, repo: string, branch: string, path: string, signal?: AbortSignal): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  // 刻意不带 Authorization：raw 对私有库本就 404，源码不会因 token 而外泄；
  // Range 把单文件物化量钉死在 20KB（下游 clamp 本来也只取前 2500/3500 字符）
  const res = await fetch(`${RAW}/${owner}/${repo}/${branch}/${encoded}`, {
    signal,
    headers: { Range: `bytes=0-${RAW_RANGE_BYTES - 1}` },
  });
  if (!res.ok && res.status !== 206) throw new Error(`RAW ${res.status}（${path}）`);
  return res.text();
}

export async function fetchRepoMeta(owner: string, repo: string, signal?: AbortSignal): Promise<RepoMeta> {
  const meta = await gh<RepoMeta>(`/repos/${owner}/${repo}`, signal);
  // 私有仓库一律拒。fetchRepoMeta 是 ingestRepo / fetchModuleDigest 的第一个调用，
  // 在这里 throw 之后 README / 目录树 / 源码根本不会发出请求。
  if (meta.private) throw new GitHubFetchError("不支持私有仓库，请提供公开仓库地址", { reason: "private" });
  return meta;
}

export async function fetchReadme(owner: string, repo: string, signal?: AbortSignal): Promise<string> {
  let data: { content?: string };
  try {
    data = await gh<{ content?: string }>(`/repos/${owner}/${repo}/readme`, signal);
  } catch (e) {
    // 唯一合法的空：仓库确实没有 README。其余失败照常冒泡，不能伪装成"这个仓库没文档"
    if (e instanceof GitHubFetchError && e.status === 404) return "";
    throw e;
  }
  if (!data.content) return "";
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export interface TreeResult {
  files: RepoFile[];
  /** GitHub 对大仓库按字母序砍尾（recursive=1 上限），砍掉的路径是真实存在的，不能当"完整清单"用 */
  truncated: boolean;
}

const EMPTY_TREE: TreeResult = { files: [], truncated: false };

export async function fetchTree(owner: string, repo: string, branch: string, signal?: AbortSignal): Promise<TreeResult> {
  const data = await gh<{ tree: { path?: string; size?: number; type?: string }[]; truncated?: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    signal
  );
  return {
    files: (data.tree ?? [])
      .filter((t) => t.path && (t.type === "blob" || t.type === "tree"))
      .map((t) => ({ path: t.path!, size: t.type === "blob" ? (t.size ?? 0) : 0, type: t.type as RepoFile["type"] })),
    truncated: data.truncated === true,
  };
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
/**
 * 单文件深读体积上限。
 *
 * 这条同时卡住三条入口：精选文件、keyFiles（客户端可控）、以及喂给模型的真实路径清单——
 * 清单里出现 1.4MB 的文件，模型就会把它写进 keyFiles，一路上无人校验直到 raw 把它全量下回来。
 */
const MAX_FILE_SIZE = 100 * 1024;

/** 精选要深读的文件：排除重型/二进制/纯文档噪音，优先根层已知配置（封顶 3 个），其余额度至少一半留给真源码 */
export function selectFiles(
  files: RepoFile[],
  opts: { max?: number; maxSize?: number; maxKnown?: number } = {}
): RepoFile[] {
  const max = opts.max ?? 8;
  const maxSize = opts.maxSize ?? MAX_FILE_SIZE;
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

/**
 * 真实路径清单：喂给 LLM 选 keyFiles，防止模型编造不存在的路径（见 prompt 注释）。
 *
 * 排序不是照抄 GitHub 返回的树序（那按字母序，文件多的仓库里 monorepo 的 packages/* 等
 * 排在后面的顶层目录永远挤不进前 max），而是按"可读性"排：代码文件优先、浅层优先。
 * 体积上限与 MAX_FILE_SIZE 对齐——清单里出现的路径必须是后面真能抓下来的。
 */
export function rankPathList(files: RepoFile[], max = 200): string {
  const usable = files.filter(
    (f) => f.type === "blob" && f.size > 0 && f.size <= MAX_FILE_SIZE && !HEAVY.test(f.path) && !BINARY.test(f.path)
  );
  const sorted = usable
    .map((f) => ({ path: f.path, rank: (CODEISH.test(f.path) ? 0 : 2) + (f.path.split("/").length <= 3 ? 0 : 1) }))
    .sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path));
  const paths = sorted.slice(0, max).map((p) => p.path);
  const more = sorted.length > max ? `\n…（其余 ${sorted.length - max} 个文件略）` : "";
  return paths.join("\n") + more;
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
export async function ingestRepo(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<{ meta: RepoMeta; digest: string; tree: RepoFile[]; partial: boolean }> {
  const meta = await fetchRepoMeta(owner, repo, signal); // 私有仓库在此拒绝，README/树/源码根本不会发请求
  const branch = meta.default_branch;
  // readme/tree 不再各自 catch 成空值：fetchReadme 内部已经把 404（无 README）变成合法的空串，
  // 剩下的配额 / 5xx / DNS / 超时都是 GitHubFetchError，必须冒泡给用户，不能伪装成"空仓库"
  const [readme, treeRes] = await Promise.all([
    fetchReadme(owner, repo, signal),
    fetchTree(owner, repo, branch, signal),
  ]);
  const tree = treeRes.files;

  const blobs = tree.filter((f) => f.type === "blob");
  const selected = selectFiles(blobs);
  const contents = new Map<string, string>();
  await Promise.all(
    selected.map(async (f) => {
      try {
        contents.set(f.path, await fetchRawFile(owner, repo, branch, f.path, signal));
      } catch {
        /* 单个文件失败跳过，不阻塞整体：树是完整的，模型仍能拿到真实路径清单 */
      }
    })
  );

  return { meta, digest: buildDigest(meta, readme, tree, contents), tree, partial: treeRes.truncated };
}

/* ---------- digest 内存缓存：重试 / 重新分析直接复用，避免同一仓库反复打 GitHub ---------- */

interface IngestResult {
  digest: string;
  tree: RepoFile[]; // 完整目录树（repo 地图 prompt 用它列真实路径，防模型编造 keyFiles）
  /** 目录树被 GitHub 截断（按字母序砍尾）：路径清单不完整，route 直接 502，且不入缓存 */
  partial: boolean;
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
  const { digest, tree, partial } = await ingestRepo(owner, repo, signal);
  // 残缺结果不进缓存：否则 15 分钟内重试拿到的还是同一份被砍掉一半的路径清单
  if (partial) return { digest, tree, partial, cached: false };
  if (digestCache.size >= DIGEST_CACHE_MAX) {
    const oldest = digestCache.keys().next().value;
    if (oldest != null) digestCache.delete(oldest);
  }
  const result: IngestResult = { digest, tree, partial };
  digestCache.set(key, { result, at: Date.now() });
  return { ...result, cached: false };
}

/* ---------- 模块级抓取：供 /api/repo/module（源码走读）与 /api/repo/module/atlas（内部地图）共用 ---------- */

/** 深读文件精选：keyFiles 优先（封顶 max）；缺失时退化为 dir 前缀下的代码文件按体积挑 */
const MODULE_CODEISH = /\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|rb|php|c|cc|cpp|h|hpp|cs|swift|kt|sh|sql|vue|svelte|ya?ml|toml)$/i;

export function pickModuleFiles(keyFiles: string[], tree: RepoFile[], dir: string, max = 4): string[] {
  const sizeByPath = new Map(tree.filter((f) => f.type === "blob").map((f) => [f.path, f.size]));
  const fromKeys = keyFiles
    .filter((p) => p.trim() && !p.split("/").includes("..") && MODULE_CODEISH.test(p))
    .filter((p) => {
      // keyFiles 来自客户端/模型，同样要卡体积：rockyou.txt.tar.gz 这类几十 MB 的文件
      // 光靠 clamp(3500) 拦不住（clamp 发生在全文已进内存之后）。树里查得到体积才判，
      // 查不到（树没抓到）时保留路径，不因为校验不了就把整份 keyFiles 丢光。
      const size = sizeByPath.get(p);
      return size == null || (size > 0 && size <= MAX_FILE_SIZE);
    })
    .slice(0, max);
  if (fromKeys.length > 0) return fromKeys;
  const prefix = dir ? dir.replace(/\/?$/, "/") : "";
  return tree
    .filter((f) => f.type === "blob" && f.size > 0 && f.size <= MAX_FILE_SIZE && f.path.startsWith(prefix) && MODULE_CODEISH.test(f.path))
    .sort((a, b) => b.size - a.size)
    .slice(0, max)
    .map((f) => f.path);
}

/** 抓取模块源码物化成有界 digest：元信息(拿 branch + 私有仓库拦截) → 树(体积校验/dir 兜底) → 并行拉文件（单文件失败跳过） */
export async function fetchModuleDigest(
  owner: string,
  repo: string,
  keyFiles: string[],
  dir: string,
  signal?: AbortSignal
): Promise<string> {
  const meta = await fetchRepoMeta(owner, repo, signal); // 私有仓库在此拒绝
  // keyFiles 非空时也要抓树：否则客户端给的路径完全没有体积上限（rockyou 那种几十 MB 的文件）。
  // 树抓失败不致命——pickModuleFiles 在没有体积信息时会保留 keyFiles 兜底。
  // dir 与 keyFiles 都为空时不抓：没有筛选依据，交给上层如实报"没抓到"，不随便挑全仓文件充数。
  const tree =
    keyFiles.length > 0 || dir ? (await fetchTree(owner, repo, meta.default_branch, signal).catch(() => EMPTY_TREE)).files : [];
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
