"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildConceptGraph,
  layout,
  trimGraph,
  type ConceptGraph,
  type MapNode,
} from "@/lib/map";
import { RELATION_DEFS, type RelationType } from "@/lib/network";
import type { StoredReport } from "@/lib/storage";

/**
 * 可复用的知识网络画布：
 * - 滚轮缩放（围绕光标中心）
 * - 拖拽平移
 * - 拖动节点（松手触发一次轻量弹簧重排）
 * - hover 高亮关系线 / 相邻节点
 * - 加载即显，无外部依赖（不引 D3）
 */
const VB_W = 1000;
const VB_H = 700;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

type Props = {
  reports: StoredReport[];
  /** 最大节点数限制；超过会按 weight 裁剪 */
  maxNodes?: number;
  /** 背景点阵开关——首页 hero 关掉（自己就是背景） */
  dotted?: boolean;
  /** 容器 className，便于首页/地图页共用 */
  className?: string;
};

export default function MapView({ reports, maxNodes = 90, dotted = true, className = "" }: Props) {
  const router = useRouter();
  // 1) 构图 + 力导向（client 端跑一次）
  const graph = useMemo<ConceptGraph>(() => {
    const g = buildConceptGraph(reports);
    return layout(trimGraph(g, maxNodes));
  }, [reports, maxNodes]);

  // 2) 视口状态：平移 + 缩放
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  // 客户端时间戳触发 hover 动效：避免 SSR 时读不到 Date.now
  useEffect(() => {
    const ts = new Set<string>();
    for (const r of reports) {
      if (!r.key.startsWith("drill:") && Date.now() - r.updatedAt < 1000 * 60 * 60 * 24 * 3) {
        ts.add(r.term);
      }
    }
    setRecentIds(ts);
  }, [reports]);

  // 3) 拖拽平移（不是节点时）
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const onBgPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return; // 点到节点别抢
    panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    setPan({ x: p.px + (e.clientX - p.x), y: p.py + (e.clientY - p.y) });
  };
  const onBgPointerUp = () => {
    panRef.current = null;
  };

  // 4) 滚轮缩放（围绕光标中心）
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * VB_W;
    const cy = ((e.clientY - rect.top) / rect.height) * VB_H;
    const delta = -e.deltaY * 0.0015;
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * (1 + delta)));
      // 围绕光标：调整 pan，使光标下的逻辑点保持原位
      const ratio = next / prev;
      setPan((p) => ({
        x: cx - (cx - p.x) * ratio,
        y: cy - (cy - p.y) * ratio,
      }));
      return next;
    });
  };

  // 5) 拖动节点（松手触发一次轻量重排）
  const nodeDragRef = useRef<{
    id: string;
    pointerX: number;
    pointerY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const screenToView = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * VB_W;
    const vy = ((clientY - rect.top) / rect.height) * VB_H;
    // 反向应用 viewBox transform
    return {
      x: (vx - pan.x) / scale,
      y: (vy - pan.y) / scale,
    };
  }, [pan.x, pan.y, scale]);

  const onNodePointerDown = (e: React.PointerEvent, n: MapNode) => {
    e.stopPropagation();
    if (n.x === undefined || n.y === undefined) return;
    nodeDragRef.current = {
      id: n.id,
      pointerX: e.clientX,
      pointerY: e.clientY,
      origX: n.x,
      origY: n.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = nodeDragRef.current;
    if (!d) return;
    const node = graph.nodes.find((nn) => nn.id === d.id);
    if (!node) return;
    const v = screenToView(e.clientX, e.clientY);
    node.x = v.x;
    node.y = v.y;
    // 触发 React 重渲染：用 setHovered 借道也可以，最简单是 force 一次
    setHovered((h) => h); // 触发 rerender
  };
  const onNodePointerUp = (_e: React.PointerEvent) => {
    const d = nodeDragRef.current;
    if (!d) return;
    // 标记为 pinned，松手后这个节点不再被力推动
    setPinnedIds((s) => new Set(s).add(d.id));
    nodeDragRef.current = null;
    // 一次轻量重排（无 pinned 节点参与）
    relaxOnce(graph, pinnedIds);
  };

  // 6) 数据统计（放在图例/边角）
  const mineCount = graph.nodes.filter((n) => n.kind === "mine").length;
  const relatedCount = graph.nodes.length - mineCount;

  if (graph.nodes.length === 0) return null;

  const edgeColor = (rel: RelationType) => RELATION_DEFS[rel]?.color ?? "#64748b";

  return (
    <div
      className={`relative overflow-hidden ${dotted ? "[background-image:radial-gradient(#e9ecf6_1px,transparent_1px)] [background-size:22px_22px]" : ""} ${className}`}
      onWheel={onWheel}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full canvas-pannable select-none touch-none"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* 边 */}
          {graph.edges.map((e) => {
            const s = graph.nodes.find((n) => n.id === e.source);
            const t = graph.nodes.find((n) => n.id === e.target);
            if (!s || !t || s.x === undefined || t.x === undefined) return null;
            const active = hovered === e.source || hovered === e.target;
            return (
              <line
                key={`${e.source}->${e.target}`}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={edgeColor(e.relationType)}
                strokeWidth={active ? 2.4 : 1.1}
                strokeOpacity={active ? 0.85 : hovered ? 0.1 : 0.32}
                className="transition-all duration-200"
              />
            );
          })}

          {/* 相关节点（外圈） */}
          {graph.nodes
            .filter((n) => n.kind === "related")
            .map((n) => {
              if (n.x === undefined || n.y === undefined) return null;
              const r = 4 + Math.min(n.weight, 10) * 0.6;
              const active = hovered === n.id || isNeighbor(graph.edges, hovered, n.id);
              const dim = hovered && !active;
              const recent = recentIds.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x},${n.y})`}
                  className={dim ? "opacity-25" : ""}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onClick={(e) => {
                    if (nodeDragRef.current) return; // 拖完不触发
                    e.stopPropagation();
                    router.push(`/analyze/${encodeURIComponent(n.label)}`);
                  }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "grab" }}
                >
                  <circle
                    r={active ? r + 3 : r}
                    fill="#fff"
                    stroke={active ? "#6366f1" : recent ? "#b45309" : "#94a3b8"}
                    strokeWidth={active ? 2 : recent ? 1.6 : 1.2}
                    className={`transition-all duration-150 ${recent ? "recent-glow" : ""}`}
                  />
                  <text
                    y={16 + r}
                    textAnchor="middle"
                    fontSize="11"
                    fill={active ? "#4338ca" : "#64748b"}
                    fontWeight={active ? 600 : 400}
                    style={{ pointerEvents: "none" }}
                  >
                    {clipLabel(n.label, 14)}
                  </text>
                  {n.description && (
                    <title>
                      {n.label}（{n.description.slice(0, 80)}）
                    </title>
                  )}
                </g>
              );
            })}

          {/* 我的概念（中心节点） */}
          {graph.nodes
            .filter((n) => n.kind === "mine")
            .map((n) => {
              if (n.x === undefined || n.y === undefined) return null;
              const r = 14 + Math.min(n.weight, 8) * 2;
              const active = hovered === n.id || isNeighbor(graph.edges, hovered, n.id);
              const dim = hovered && !active;
              const recent = recentIds.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x},${n.y})`}
                  className={dim ? "opacity-25" : ""}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onClick={(e) => {
                    if (nodeDragRef.current) return;
                    e.stopPropagation();
                    router.push(`/analyze/${encodeURIComponent(n.label)}`);
                  }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "grab" }}
                >
                  <circle
                    r={active ? r + 4 : r}
                    fill={active ? "#4f46e5" : recent ? "#7c3aed" : "#6366f1"}
                    stroke="#312e81"
                    strokeOpacity="0.25"
                    strokeWidth="1.2"
                    className={`transition-all duration-150 ${recent && !active ? "recent-glow" : ""}`}
                  />
                  <text
                    y={4}
                    textAnchor="middle"
                    fontSize="11.5"
                    fill="#fff"
                    fontWeight="700"
                    style={{ pointerEvents: "none" }}
                  >
                    {clipLabel(n.label, 8)}
                  </text>
                  <title>{n.label}（我学过的概念）</title>
                </g>
              );
            })}
        </g>
      </svg>

      {/* 浮动数据角标——左下 */}
      <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-400/80 tracking-wider">
        <span className="font-bold text-indigo-600/80">{mineCount}</span> 个我的 ·
        <span className="font-bold text-slate-500/80"> {relatedCount}</span> 个相关
      </div>
      {/* 操作提示——右下 */}
      <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] text-slate-400/80">
        滚轮缩放 · 拖拽平移 · 拖动节点 · 点击深挖
      </div>
    </div>
  );
}

function isNeighbor(edges: ConceptGraph["edges"], hovered: string | null, id: string): boolean {
  if (!hovered) return false;
  return edges.some(
    (e) =>
      (e.source === hovered && e.target === id) ||
      (e.target === hovered && e.source === id)
  );
}

function clipLabel(label: string, max: number): string {
  return label.length > max ? label.slice(0, max) + "…" : label;
}

/**
 * 一次轻量重排——只在用户拖完节点后跑，避开 O(n²) 全图。
 * 只动非 pinned 节点，按弹簧向原理想距离拉近。
 */
function relaxOnce(graph: ConceptGraph, pinned: Set<string>, iters = 30) {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return;
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const k = Math.sqrt((VB_W * VB_H) / nodes.length);
  for (let it = 0; it < iters; it++) {
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b) continue;
      if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) continue;
      if (pinned.has(a.id) && pinned.has(b.id)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = ((dist - k) / dist) * 0.06;
      const fx = dx * force;
      const fy = dy * force;
      if (!pinned.has(a.id)) {
        a.x += fx;
        a.y += fy;
      }
      if (!pinned.has(b.id)) {
        b.x -= fx;
        b.y -= fy;
      }
    }
  }
  // 边界保护
  for (const n of nodes) {
    if (n.x === undefined || n.y === undefined) continue;
    const cd = Math.hypot(n.x - cx, n.y - cy);
    const lim = Math.min(VB_W, VB_H) * 0.48;
    if (cd > lim) {
      n.x = cx + (n.x - cx) * (lim / cd);
      n.y = cy + (n.y - cy) * (lim / cd);
    }
  }
}