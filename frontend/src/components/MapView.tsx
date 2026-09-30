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
import { loadPosCache, savePosCache, type PosMap } from "@/lib/mapPosCache";
import type { StoredReport } from "@/lib/storage";

/**
 * 知识网络画布（v1.6 视觉深化版）
 * - 贝塞尔曲线边（不再用直线）
 * - "我学过的"节点：紫色径向渐变 + 暖琥珀光晕
 * - hover：高亮节点带柔光晕 + 周围节点暗下去
 * - 滚轮缩放（围绕光标）+ 拖拽平移 + 拖动节点（松手轻量重排）
 * - 加载 220ms 渐显，每条边走 stroke-dash 描边动画
 */
const VB_W = 1000;
const VB_H = 700;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

type Props = {
  reports: StoredReport[];
  maxNodes?: number;
  /** 是否画背景点阵；首页 hero 不画（避免与画布冲突） */
  dotted?: boolean;
  className?: string;
  /**
   * 点击节点时回调（用于在父组件打开预览抽屉）。
   * 不传则保持旧的直接跳转行为（/map 焦点模式用）。
   */
  onPreview?: (node: MapNode, report: StoredReport | null) => void;
};

export default function MapView({
  reports,
  maxNodes = 90,
  dotted = false,
  className = "relative h-full w-full",
  onPreview,
}: Props) {
  const router = useRouter();

  const graph = useMemo<ConceptGraph>(() => {
    const g = buildConceptGraph(reports);
    const laid = layout(trimGraph(g, maxNodes));
    // —— 把缓存位置套到节点上 ——
    const cache = loadPosCache();
    for (const n of laid.nodes) {
      const c = cache[n.id];
      if (c) {
        n.x = c.x;
        n.y = c.y;
      }
    }
    return laid;
  }, [reports, maxNodes]);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ts = new Set<string>();
    const now = Date.now();
    for (const r of reports) {
      if (!r.key.startsWith("drill:") && now - r.updatedAt < 1000 * 60 * 60 * 24 * 3) {
        ts.add(r.term);
      }
    }
    setRecentIds(ts);
  }, [reports]);

  // —— 画布平移（点空白处） ——
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const onBgPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
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

  // —— 滚轮缩放（围绕光标） ——
  // 必须用原生监听而不是 onWheel：wheel 走 React 根容器委托且以 passive:true
  // 注册，onWheel 里的 e.preventDefault() 会被忽略（控制台报 passive 警告），
  // 页面会跟着滚轮一起动。
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cx = ((e.clientX - rect.left) / rect.width) * VB_W;
      const cy = ((e.clientY - rect.top) / rect.height) * VB_H;
      // 指数映射而不是线性的 (1 + deltaY·k)：线性映射下 deltaY=400（一次快速
      // 滚动/触控板惯性）会直接把 scale 乘到 0.4 钉在 MIN_SCALE 上，且回滚时
      // 同样 400 只涨回 1.6 倍、上下不对称。指数映射一格（deltaY=100）缩放
      // 约 15%，无论多大的 deltaY 都不会越过上下限之外。
      const factor = Math.exp(-e.deltaY * 0.0015);
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        const ratio = next / prev;
        setPan((p) => ({
          x: cx - (cx - p.x) * ratio,
          y: cy - (cy - p.y) * ratio,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
    // svg 只在有节点时才渲染，依赖节点数保证挂载后能补挂监听
  }, [graph.nodes.length]);

  // —— 节点拖动 ——
  const nodeDragRef = useRef<{
    id: string;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const screenToView = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const vx = ((clientX - rect.left) / rect.width) * VB_W;
      const vy = ((clientY - rect.top) / rect.height) * VB_H;
      return {
        x: (vx - pan.x) / scale,
        y: (vy - pan.y) / scale,
      };
    },
    [pan.x, pan.y, scale]
  );

  const onNodePointerDown = (e: React.PointerEvent, n: MapNode) => {
    e.stopPropagation();
    if (n.x === undefined || n.y === undefined) return;
    nodeDragRef.current = {
      id: n.id,
      pointerX: e.clientX,
      pointerY: e.clientY,
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
    setHovered((h) => h); // 触发重渲染
  };
  const onNodePointerUp = (_e: React.PointerEvent) => {
    const d = nodeDragRef.current;
    if (!d) return;
    setPinnedIds((s) => new Set(s).add(d.id));
    nodeDragRef.current = null;
    relaxOnce(graph, pinnedIds);
    // —— 持久化所有非 pinned 节点的位置（轻量重排后） ——
    const cache: PosMap = loadPosCache();
    for (const n of graph.nodes) {
      if (n.x !== undefined && n.y !== undefined) {
        cache[n.id] = { x: n.x, y: n.y };
      }
    }
    savePosCache(cache);
  };

  // 打开节点：鼠标点击与键盘激活走同一条分支
  const openNode = (n: MapNode) => {
    if (nodeDragRef.current) return;
    const report = reports.find((r) => r.term === n.label) || null;
    if (onPreview) onPreview(n, report);
    else router.push(`/analyze/${encodeURIComponent(n.label)}`);
  };

  const mineCount = graph.nodes.filter((n) => n.kind === "mine").length;
  const relatedCount = graph.nodes.length - mineCount;

  if (graph.nodes.length === 0) return null;

  const edgeColor = (rel: RelationType) => RELATION_DEFS[rel]?.color ?? "#94a3b8";

  return (
    // 这里不再硬编码 relative：调用方传 absolute inset-0 时，.relative 与
    // .absolute 同特异性、由 CSS 生成顺序决定胜负（.relative 在后），容器会
    // 退化成内容高度、地图就填不满 /map 的 main。
    <div className={`overflow-hidden ${className}`}>
      {/* 背景：暖纸色 + 极淡点阵 */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.65) 0%, transparent 70%)",
        }}
      />
      {dotted && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="概念网络图"
        className="relative h-full w-full canvas-pannable select-none touch-none fade-up"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
      >
        <defs>
          {/* 我学过的节点：墨色径向渐变 */}
          <radialGradient id="mine-fill" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#43433d" />
            <stop offset="60%" stopColor="#2b2b27" />
            <stop offset="100%" stopColor="#141412" />
          </radialGradient>
          {/* hover 状态更亮 */}
          <radialGradient id="mine-fill-active" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#75756d" />
            <stop offset="55%" stopColor="#43433d" />
            <stop offset="100%" stopColor="#2b2b27" />
          </radialGradient>
          {/* 暖光晕（filter） */}
          <filter id="warm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* hover 时柔光晕 */}
          <filter id="hover-halo" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* 边：贝塞尔曲线 */}
          {graph.edges.map((e, idx) => {
            const s = graph.nodes.find((n) => n.id === e.source);
            const t = graph.nodes.find((n) => n.id === e.target);
            if (!s || !t || s.x === undefined || t.x === undefined) return null;
            const active = hovered === e.source || hovered === e.target;
            const color = edgeColor(e.relationType);
            // 贝塞尔控制点：水平方向偏移，给曲线"弧度"
            const dx = t.x - s.x;
            const c1x = s.x + dx * 0.5;
            const c1y = s.y;
            const c2x = s.x + dx * 0.5;
            const c2y = t.y;
            const path = `M ${s.x} ${s.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${t.x} ${t.y}`;
            return (
              <path
                key={`${e.source}->${e.target}`}
                d={path}
                stroke={color}
                strokeWidth={active ? 2.4 : 1.2}
                strokeOpacity={active ? 0.9 : hovered ? 0.08 : 0.35}
                fill="none"
                className="map-edge transition-all duration-200"
                style={{
                  // 描边动画：每条边错开 12ms
                  animationDelay: `${Math.min(idx * 12, 1200)}ms`,
                }}
              />
            );
          })}

          {/* 相关节点（外圈） */}
          {graph.nodes
            .filter((n) => n.kind === "related")
            .map((n) => {
              if (n.x === undefined || n.y === undefined) return null;
              const r = 5 + Math.min(n.weight, 10) * 0.7;
              const active = hovered === n.id || isNeighbor(graph.edges, hovered, n.id);
              const dim = hovered && !active;
              const recent = recentIds.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x},${n.y})`}
                  className={`${dim ? "opacity-20" : ""} transition-opacity duration-200`}
                  style={{ cursor: "grab" }}
                  role="button"
                  tabIndex={0}
                  aria-label={n.label}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNode(n);
                    }
                  }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    openNode(n);
                  }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* hover 光晕 */}
                  {active && (
                    <circle r={r + 8} fill="#d4d4ce" opacity="0.3" />
                  )}
                  <circle
                    r={active ? r + 2.5 : r}
                    fill={active ? "#f1f1ee" : "#ffffff"}
                    stroke={active ? "#1d1d1a" : recent ? "#b45309" : "#94a3b8"}
                    strokeWidth={active ? 2.2 : recent ? 1.8 : 1.2}
                    className={`transition-all duration-200 ${recent ? "recent-glow" : ""}`}
                  />
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fill={active ? "#1d1d1a" : "#475569"}
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

          {/* 我的概念（中心节点）：渐变 + 暖琥珀边框（最近学习） */}
          {graph.nodes
            .filter((n) => n.kind === "mine")
            .map((n) => {
              if (n.x === undefined || n.y === undefined) return null;
              const r = 16 + Math.min(n.weight, 8) * 2;
              const active = hovered === n.id || isNeighbor(graph.edges, hovered, n.id);
              const dim = hovered && !active;
              const recent = recentIds.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x},${n.y})`}
                  className={`${dim ? "opacity-25" : ""} transition-opacity duration-200`}
                  style={{ cursor: "grab" }}
                  role="button"
                  tabIndex={0}
                  aria-label={n.label}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNode(n);
                    }
                  }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    openNode(n);
                  }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* 外层柔光晕（最近学习的） */}
                  {recent && (
                    <circle
                      r={r + 12}
                      fill="none"
                      stroke="#b45309"
                      strokeOpacity="0.35"
                      strokeWidth={3}
                      className="recent-glow"
                    />
                  )}
                  {/* hover 时额外光晕 */}
                  {active && (
                    <circle
                      r={r + 6}
                      fill="#d4d4ce"
                      opacity="0.35"
                    />
                  )}
                  <circle
                    r={active ? r + 3 : r}
                    fill={active ? "url(#mine-fill-active)" : "url(#mine-fill)"}
                    stroke={recent ? "#b45309" : "#141412"}
                    strokeOpacity={recent ? "0.55" : "0.3"}
                    strokeWidth={recent ? 1.8 : 1.2}
                    className="transition-all duration-200"
                  />
                  <text
                    y={4}
                    textAnchor="middle"
                    fontSize="11.5"
                    fill="#ffffff"
                    fontWeight="700"
                    style={{ pointerEvents: "none", letterSpacing: "0.02em" }}
                  >
                    {clipLabel(n.label, 8)}
                  </text>
                  <title>{n.label}（我学过的概念）</title>
                </g>
              );
            })}
        </g>
      </svg>

      {/* 角标信息（左下） */}
      <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-500/80 tracking-wide">
        <span className="font-semibold text-ink-700/90">{mineCount}</span> 我的 ·
        <span className="text-slate-500/90"> {relatedCount}</span> 相关
      </div>
      {/* 操作提示（右下）：触屏没有滚轮，隐藏「滚轮缩放」那一段 */}
      <div className="pointer-events-none absolute bottom-3 right-4 text-[10.5px] text-slate-500/70 tracking-wide">
        <span className="[@media(hover:hover)]:inline">滚轮缩放 · </span>
        拖拽平移 · 拖动节点
      </div>
    </div>
  );
}

function isNeighbor(
  edges: ConceptGraph["edges"],
  hovered: string | null,
  id: string
): boolean {
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

/** 一次轻量弹簧重排：用户拖完节点后跑，O(E·iters) 而不是 O(n²) */
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