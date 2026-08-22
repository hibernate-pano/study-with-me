/** 知识网络 Markdown 解析器，从 LLM 输出里抽「关联类型 + 概念 + 描述」 */

export interface Concept {
  name: string;
  description: string;
}

export type RelationType = "前置知识" | "兄弟概念" | "后继深入" | "对立" | "类比" | "其他";

/** 概念 + 所属分组的元信息。chip 直接持有本类型，免去反查。 */
export interface FlatConcept extends Concept {
  relationType: RelationType;
  groupLabel: string;
  color: string;
}

export interface Group {
  type: RelationType;
  label: string;
  subtitle: string;
  concepts: FlatConcept[];
  color: string;
  bg: string;
}

export const RELATION_DEFS: Record<
  RelationType,
  { match: RegExp; color: string; bg: string; defaultLabel: string; defaultSubtitle: string }
> = {
  前置知识: {
    match: /前置知识|先懂这些|先决条件|依赖/,
    color: "#0891b2",
    bg: "#ecfeff",
    defaultLabel: "前置知识",
    defaultSubtitle: "先懂这些，才能理解主概念",
  },
  兄弟概念: {
    match: /兄弟概念|相似概念|同一层级|同类/,
    color: "#7c3aed",
    bg: "#f5f3ff",
    defaultLabel: "兄弟概念",
    defaultSubtitle: "同一层级的相似概念",
  },
  后继深入: {
    match: /后继|后续|延伸|深入|进阶方向|下一步/,
    color: "#059669",
    bg: "#ecfdf5",
    defaultLabel: "后继深入",
    defaultSubtitle: "学完这个，往哪走",
  },
  对立: {
    match: /对立|反例|对照|反面/,
    color: "#dc2626",
    bg: "#fef2f2",
    defaultLabel: "对立 / 反例",
    defaultSubtitle: "换个角度理解",
  },
  类比: {
    match: /跨领域|类比|其他领域|不同领域/,
    color: "#ea580c",
    bg: "#fff7ed",
    defaultLabel: "跨领域类比",
    defaultSubtitle: "在别的领域有类似思想",
  },
  其他: {
    match: /.*/,
    color: "#64748b",
    bg: "#f1f5f9",
    defaultLabel: "其他关联",
    defaultSubtitle: "相关概念",
  },
};

/** 解析"知识网络"模块的 markdown，返回分组结果 */
export function parseNetworkMarkdown(md: string): Group[] {
  const lines = md.split("\n");
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const subMatch = line.match(/^###\s+(.+)$/);
    if (subMatch) {
      const heading = subMatch[1].trim();
      const def = Object.values(RELATION_DEFS).find((d) => d.match.test(heading)) ||
        RELATION_DEFS.其他;
      const label = heading.replace(/[（(].*?[)）]/g, "").trim() || def.defaultLabel;
      const parenMatch = heading.match(/[（(](.+?)[)）]/);
      current = {
        type: def === RELATION_DEFS.其他 ? "其他" : (Object.keys(RELATION_DEFS) as RelationType[]).find((k) => RELATION_DEFS[k] === def)!,
        label,
        subtitle: parenMatch?.[1] || def.defaultSubtitle,
        concepts: [],
        color: def.color,
        bg: def.bg,
      };
      groups.push(current);
      continue;
    }

    if (!current) continue;

    const itemMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (!itemMatch) continue;

    const item = itemMatch[1];
    const nameMatch = item.match(/^\*\*(.+?)\*\*/);
    if (!nameMatch) continue;

    const name = cleanInlineMarkdown(nameMatch[1]).trim();
    const desc = cleanInlineMarkdown(
      item
        .slice(nameMatch[0].length)
        .replace(/^[\s:,;:\u3000\uFF1A\uFF0C\uFF1B\u2014\u2013\u2212]+/, "")
        .trim()
    );

    current.concepts.push({
      name,
      description: desc,
      relationType: current.type,
      groupLabel: current.label,
      color: current.color,
    });
  }

  return groups.filter((g) => g.concepts.length > 0);
}

/**
 * 清理文本里的内联 Markdown 符号（**加粗**、`代码`）。
 * 知识网络 chip 的副标题是单行/两行轻量展示，不需要完整 Markdown 渲染，
 * 把 `**xx**` 原样露出会丢脸。保守实现：只动双星号与反引号，避开单个 `*`
 * （可能出现在中文里造成误伤）。
 */
function cleanInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/** 扁平化所有概念（保留供未来「跨分组的全局节点视图」使用）。 */
export function flattenGroups(groups: Group[]): FlatConcept[] {
  return groups.flatMap((g) => g.concepts);
}