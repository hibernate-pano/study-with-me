/**
 * Repo 项目地图（Atlas）：repo 学习模式的独立数据协议。
 *
 * 与概念报告（Markdown 按 "##" 切卡）完全不同：repo 走「结构化 JSON」——
 * 因为 UI 是交互地图（架构图 + 阅读路线 + 模块卡），不是一篇文档。
 * LLM 输出一个 ```json 代码块，parseAtlas 负责提取与校验，坏数据返回 null 走重试。
 */

export interface AtlasModule {
  id: string;
  name: string;
  /** 对应的仓库目录/文件 */
  dir: string;
  /** 职责，1-2 句 */
  role: string;
  keyFiles: string[];
  /** 依赖/协作的其他模块 id */
  talksTo: string[];
  /** 自测题：检验是否理解该模块 */
  questions: string[];
}

export interface AtlasStep {
  moduleId: string;
  title: string;
  /** 这一站要弄懂什么 */
  goal: string;
}

export interface Atlas {
  /** 一句话：这是什么、牛在哪 */
  pitch: string;
  stats?: { stars?: number; language?: string; topics?: string[] };
  /** 为什么值得学 / 核心亮点（3-5 条） */
  why: string[];
  modules: AtlasModule[];
  /** 推荐阅读路线（有序，跟读模式） */
  path: AtlasStep[];
}

/** 从模型原始输出里提取 JSON 文本：优先 ```json 围栏，退化为首个 { 到最后一个 } */
export function extractAtlasJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

/** 解析并校验：缺 pitch 或 modules 为空/结构坏 → null（调用方提示重新生成） */
export function parseAtlas(raw: string): Atlas | null {
  const json = extractAtlasJson(raw);
  if (!json) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof data.pitch !== "string" || !data.pitch.trim()) return null;
  if (!Array.isArray(data.modules) || data.modules.length === 0) return null;

  // 降级容错：单个坏模块跳过（不因一处结构错误而让用户重烧全部 token）；id 空白/重复去重
  const modules: AtlasModule[] = [];
  const seenIds = new Set<string>();
  for (const m of data.modules) {
    if (typeof m !== "object" || m === null) continue;
    const o = m as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.role !== "string") continue;
    const id = o.id.trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    modules.push({
      id,
      name: o.name.trim(),
      dir: typeof o.dir === "string" ? o.dir : "",
      role: o.role.trim(),
      keyFiles: strArray(o.keyFiles),
      talksTo: strArray(o.talksTo),
      questions: strArray(o.questions),
    });
  }
  if (modules.length === 0) return null;
  const validIds = seenIds;

  const statsRaw = data.stats as Record<string, unknown> | undefined;
  const stats =
    statsRaw && typeof statsRaw === "object"
      ? {
          stars: typeof statsRaw.stars === "number" ? statsRaw.stars : undefined,
          language: typeof statsRaw.language === "string" ? statsRaw.language : undefined,
          topics: strArray(statsRaw.topics).slice(0, 6),
        }
      : undefined;

  const path: AtlasStep[] = Array.isArray(data.path)
    ? (data.path as unknown[])
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null &&
            typeof (s as Record<string, unknown>).moduleId === "string" &&
            validIds.has((s as Record<string, unknown>).moduleId as string)
        )
        .map((s) => ({
          moduleId: s.moduleId as string,
          title: typeof s.title === "string" ? s.title : "",
          goal: typeof s.goal === "string" ? s.goal : "",
        }))
    : [];

  return {
    pitch: data.pitch.trim(),
    stats,
    why: strArray(data.why),
    modules,
    path,
  };
}
