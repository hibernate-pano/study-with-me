"use client";

/**
 * 可交互架构图（L1 项目全景 / L2 模块内部共用）：
 * 手写 SVG 椭圆布局 + 数据流箭头，零依赖。
 * - 箭头终点按矩形边缘射线求交（斜向边不悬空）；
 * - 曲线穿过中间节点时翻转到另一侧绕行；
 * - 节点可点击（onSelect），悬停 title 看全名与职责。
 */

import type { AtlasModule } from "@/lib/atlas";

export const SVG_W = 660;
export const SVG_H = 470;
const NODE_W = 128;
const NODE_H = 44;

/** 节点均匀摆在椭圆上（宽 > 高，贴合横版卡片） */
function circleLayout(count: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: SVG_W / 2, y: SVG_H / 2 }];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: SVG_W / 2 + (SVG_W / 2 - NODE_W / 2 - 8) * Math.cos(angle),
      y: SVG_H / 2 + (SVG_H / 2 - NODE_H / 2 - 14) * Math.sin(angle),
    };
  });
}

interface Props {
  modules: AtlasModule[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** 无边时 SVG 中心的兜底文案 */
  emptyEdgeHint?: string;
}

export default function AtlasGraph({ modules, selected, onSelect, emptyEdgeHint = "这次没有标注依赖关系" }: Props) {
  const byId = new Set(modules.map((m) => m.id));
  const edges = modules.flatMap((m) =>
    m.talksTo.filter((t) => t !== m.id && byId.has(t)).map((t) => ({ from: m.id, to: t }))
  );
  const positions = circleLayout(modules.length);

  return (
    <div className="overflow-x-auto scroll-thin">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full min-w-[560px]" role="img" aria-label="架构图">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          </marker>
          <marker id="arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = positions[modules.findIndex((m) => m.id === e.from)];
          const b = positions[modules.findIndex((m) => m.id === e.to)];
          if (!a || !b) return null;
          const hi = selected === e.from || selected === e.to;
          // 弯曲方向：默认统一侧偏；若曲线会穿过中间节点，翻转到另一侧绕开
          const crossesMid = modules.some((m, j) => {
            if (m.id === e.from || m.id === e.to) return false;
            const p = positions[j];
            if (!p) return false;
            return [0.35, 0.5, 0.65].some((t) => {
              const cx0 = (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * ((a.x + b.x) / 2 + (b.y - a.y) * 0.18) + t * t * b.x;
              const cy0 = (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * ((a.y + b.y) / 2 - (b.x - a.x) * 0.18) + t * t * b.y;
              return Math.abs(cx0 - p.x) < NODE_W / 2 + 4 && Math.abs(cy0 - p.y) < NODE_H / 2 + 4;
            });
          });
          const k = crossesMid ? -0.26 : 0.18;
          const mx = (a.x + b.x) / 2 + (b.y - a.y) * k;
          const my = (a.y + b.y) / 2 - (b.x - a.x) * k;
          // 终点回缩到目标矩形边缘（射线求交，斜向边不悬空）
          const dx = b.x - mx, dy = b.y - my;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const tEdge = Math.min(
            (NODE_W / 2) / Math.max(Math.abs(ux), 1e-6),
            (NODE_H / 2) / Math.max(Math.abs(uy), 1e-6)
          );
          const ex = b.x - ux * tEdge, ey = b.y - uy * tEdge;
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${ex} ${ey}`}
              fill="none"
              stroke={hi ? "#6366f1" : "#cbd5e1"}
              strokeWidth={hi ? 2 : 1.4}
              markerEnd={hi ? "url(#arrow-hi)" : "url(#arrow)"}
            />
          );
        })}
        {modules.map((m, i) => {
          const p = positions[i];
          if (!p) return null;
          const active = selected === m.id;
          const label = m.name.length > 8 ? m.name.slice(0, 8) + "…" : m.name;
          return (
            <g key={m.id} onClick={() => onSelect(m.id)} className="cursor-pointer" role="button" aria-label={m.name}>
              <rect
                x={p.x - NODE_W / 2} y={p.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={10}
                className="transition-all"
                fill={active ? "#4f46e5" : "#ffffff"}
                stroke={active ? "#4f46e5" : "#e2e8f0"}
                strokeWidth={1.5}
              />
              <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fontWeight={active ? 600 : 500} fill={active ? "#ffffff" : "#334155"}>
                {label}
              </text>
              <title>{`${m.name}（${m.dir || "—"}）：${m.role}`}</title>
            </g>
          );
        })}
        {edges.length === 0 && modules.length > 1 && (
          <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fontSize={13} fill="#94a3b8">
            {emptyEdgeHint}
          </text>
        )}
      </svg>
    </div>
  );
}
