/** 我的知识网络地图：把所有报告的知识网络聚合出一张概念图（纯逻辑，便于测试）。
 * 不引入 D3 —— 节点几十个，手写力导向布局足够。
 */

import type { StoredReport } from "./storage";
import type { RelationType } from "./network";

export type NodeKind = "mine" | "related";

export interface MapNode {
  id: string; // 概念名（用作 id）
  label: string;
  kind: NodeKind;
  weight: number; // 出现/被提及次数，决定圆大小
  description?: string; // 相关概念的一句话介绍（取一个）
  x?: number;
  y?: number;
}

export interface MapEdge {
  source: string;
  target: string;
  relationType: RelationType;
}

export interface ConceptGraph {
  nodes: MapNode[];
  edges: MapEdge[];
}

/** judge：这个报告是否属于「主概念」（对比报告的展示名是 A ⚖️ B，不算） */
function isMainReport(key: string): boolean {
  return !key.startsWith("drill:") && !key.startsWith("compare:");
}

/**
 * 聚合全部报告 → 概念图。
 * - mine 节点：主报告的主题 + 抽屉深挖过的概念（都是我“学过”的）
 * - related 节点：任何报告知识网络里提到过的概念，weight = 被提及次数
 * - 边：报告主题 → 它提到的每个相关概念，relationType 取最先出现的
 */
export function buildConceptGraph(reports: StoredReport[]): ConceptGraph {
  const nodes = new Map<string, MapNode>();
  const edges = new Map<string, MapEdge>();
  const seenEdgeKeys = new Set<string>();

  const ensureNode = (
    label: string,
    kind: NodeKind,
    extra?: Partial<MapNode>
  ): MapNode => {
    const clean = label.trim();
    if (!clean) throw new Error("empty concept name");
    const existing = nodes.get(clean);
    if (existing) {
      existing.weight++;
      if (!existing.description && extra?.description) {
        existing.description = extra.description;
      }
      return existing;
    }
    const node: MapNode = {
      id: clean,
      label: clean,
      kind,
      weight: 1,
      ...extra,
    };
    nodes.set(clean, node);
    return node;
  };

  for (const report of reports) {
    const subject = report.term;
    if (!subject) continue;
    const subjectIsMain = isMainReport(report.key);
    if (subjectIsMain || report.key.startsWith("drill:")) {
      ensureNode(subject, "mine");
    }
    // related 已在保存报告时解析入库；防呆：空描述也传
    for (const c of report.related ?? []) {
      if (!c.name) continue;
      ensureNode(c.name, "related", { description: c.description || undefined });
      if (subjectIsMain || report.key.startsWith("drill:")) {
        const edgeKey = `${subject}\u0000${c.name}`;
        if (!seenEdgeKeys.has(edgeKey)) {
          seenEdgeKeys.add(edgeKey);
          edges.set(edgeKey, {
            source: subject,
            target: c.name,
            relationType: c.relationType,
          });
        }
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

/** 限制规模：保留最重要的 N 个节点（mine 优先，然后按 weight），防止力导向 O(n²) 失控 */
export function trimGraph(graph: ConceptGraph, maxNodes = 80): ConceptGraph {
  const { nodes, edges } = graph;
  if (nodes.length <= maxNodes) return graph;
  const sorted = [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "mine" ? -1 : 1;
    return b.weight - a.weight;
  });
  const keep = new Set(sorted.slice(0, maxNodes).map((n) => n.id));
  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter(
      (e) => keep.has(e.source) && keep.has(e.target)
    ),
  };
}

/** 遍历相关概念时可能出现的超长名字截断（地图不能无限长） */
export function clipLabel(label: string, max = 14): string {
  return label.length > max ? label.slice(0, max) + "…" : label;
}

/** 简单力导向布局：给定节点与边，迭代把坐标写到 node.x/y 上，返回 viewBox 尺寸建议 */
export function layout(
  graph: ConceptGraph,
  width = 1000,
  height = 700,
  iterations = 220
): { nodes: MapNode[]; edges: MapEdge[] } {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return graph;

  // 初始位置：围绕中心随机散布
  const cx = width / 2;
  const cy = height / 2;
  for (const n of nodes) {
    const angle = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * Math.min(width, height) * 0.35;
    n.x = cx + Math.cos(angle) * r;
    n.y = cy + Math.sin(angle) * r;
  }

  const k = Math.sqrt((width * height) / nodes.length); // 理想边长（Fruchterman-Reingold 风格）
  const C = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 10 * (1 - iter / iterations);

    // 斥力：所有节点两两推开
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined)
          continue;
        const dx = (a.x ?? cx) - (b.x ?? cy);
        const dy = (a.y ?? cx) - (b.y ?? cy);
        const dist = Math.hypot(dx, dy) || 1;
        const force = (k * k) / dist * C;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.x! -= fx;
        a.y! -= fy;
        b.x! += fx;
        b.y! += fy;
      }
    }

    // 弹簧：边上的节点互相吸引到理想距离
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b || a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined)
        continue;
      const dx = (b.x ?? cx) - a.x;
      const dy = (b.y ?? cy) - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = ((dist - k) / dist) * 0.04;
      a.x! += dx * force;
      a.y! += dy * force;
      b.x! -= dx * force;
      b.y! -= dy * force;
    }

    // 位移限制（温度）与边界钳制
    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue;
      const centerDist = Math.hypot(n.x - cx, n.y - cy);
      if (centerDist > Math.min(width, height) * 0.48) {
        const scale = (Math.min(width, height) * 0.48) / centerDist;
        n.x = cx + (n.x - cx) * scale;
        n.y = cy + (n.y - cy) * scale;
      }
      const vx = Math.random() * temp - temp / 2;
      const vy = Math.random() * temp - temp / 2;
      n.x += vx;
      n.y += vy;
    }
  }

  return graph;
}