"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllReports } from "@/lib/storage";
import {
  buildConceptGraph,
  trimGraph,
  layout,
  clipLabel,
  type ConceptGraph,
} from "@/lib/map";
import { RELATION_DEFS } from "@/lib/network";

const W = 1000;
const H = 700;

/** 🗺 我的知识网络：把你所有报告里的知识网络聚合画成一张地图（纯本地数据、手写力导向、无 D3）。 */
export default function MapPage() {
  const router = useRouter();
  const [graph, setGraph] = useState<ConceptGraph | null>(null); // null = 加载中
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getAllReports()
      .then((reports) => {
        const g = buildConceptGraph(reports);
        setGraph(layout(trimGraph(g, 90)));
      })
      .catch(() => setGraph({ nodes: [], edges: [] }));
  }, []);

  const mineCount = graph?.nodes.filter((n) => n.kind === "mine").length ?? 0;
  const relatedCount =
    (graph?.nodes.length ?? 0) - mineCount;

  const edgeColor = (relationType: keyof typeof RELATION_DEFS) =>
    RELATION_DEFS[relationType]?.color ?? "#64748b";

  const isNeighbor = (id: string) =>
    hovered
      ? graph?.edges.some(
          (e) =>
            (e.source === hovered && e.target === id) ||
            (e.target === hovered && e.source === id)
        ) ?? false
      : false;

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回首页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">🗺 我的知识网络</div>
          <div className="flex-1" />
          {graph && graph.nodes.length > 0 && (
            <span className="text-[12px] text-slate-400">
              学过的概念 <span className="font-bold text-indigo-600">{mineCount}</span> ·
              相关概念 <span className="font-bold text-slate-600">{relatedCount}</span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-8">
        {/* 图例 */}
        {graph && graph.nodes.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
              我学过的概念
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-400 bg-slate-100" />
              相关概念
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded bg-cyan-400" />
              前置知识
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded bg-violet-400" />
              兄弟概念
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded bg-emerald-400" />
              后继深入
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded bg-red-400" />
              对立
            </span>
            <span className="text-slate-400">· 悬停看关系，点击打开概念报告</span>
          </div>
        )}

        {/* 空态 */}
        {graph && graph.nodes.length === 0 && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-12 text-center">
            <div className="text-[34px]">🗺️</div>
            <div className="mt-3 text-[15px] font-bold text-slate-700">
              地图还是空的
            </div>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-slate-500 leading-relaxed">
              去深挖几个概念，每个报告里的「🌐 知识网络」会自动连成一张属于你的概念地图。
              学得越多，这张网越密。
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-[13.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              去学第一个概念 →
            </button>
          </div>
        )}

        {/* 地图 */}
        {graph && graph.nodes.length > 0 && (
          <div className="overflow-auto rounded-2xl border border-[var(--line)] bg-white [background-image:radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:22px_22px]">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]">
              {/* 边 */}
              {graph.edges.map((e) => {
                const s = graph.nodes.find((n) => n.id === e.source);
                const t = graph.nodes.find((n) => n.id === e.target);
                if (!s || !t || s.x === undefined || t.x === undefined) return null;
                const active =
                  hovered === e.source || hovered === e.target;
                return (
                  <line
                    key={`${e.source}->${e.target}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={edgeColor(e.relationType)}
                    strokeWidth={active ? 2.2 : 1.1}
                    strokeOpacity={active ? 0.75 : hovered ? 0.12 : 0.3}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* 相关节点 */}
              {graph.nodes
                .filter((n) => n.kind === "related")
                .map((n) => {
                  if (n.x === undefined || n.y === undefined) return null;
                  const r = 4 + Math.min(n.weight, 10) * 0.6;
                  const active = hovered === n.id || isNeighbor(n.id);
                  const dim = hovered && !active;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      className="cursor-pointer"
                      style={{ opacity: dim ? 0.25 : 1 }}
                      onClick={() =>
                        router.push(`/analyze/${encodeURIComponent(n.label)}`)
                      }
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <circle
                        r={active ? r + 2.5 : r}
                        fill="#fff"
                        stroke={active ? "#6366f1" : "#94a3b8"}
                        strokeWidth={active ? 2 : 1.2}
                        className="transition-all duration-150"
                      />
                      <text
                        y={16 + r}
                        textAnchor="middle"
                        fontSize="11"
                        fill={active ? "#4338ca" : "#64748b"}
                        fontWeight={active ? 600 : 400}
                      >
                        {clipLabel(n.label, 12)}
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
                  const r = 16 + Math.min(n.weight, 8) * 2;
                  const active = hovered === n.id || isNeighbor(n.id);
                  const dim = hovered && !active;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      className="cursor-pointer"
                      style={{ opacity: dim ? 0.25 : 1 }}
                      onClick={() =>
                        router.push(`/analyze/${encodeURIComponent(n.label)}`)
                      }
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <circle
                        r={active ? r + 3 : r}
                        fill={active ? "#4f46e5" : "#6366f1"}
                        stroke="#312e81"
                        strokeOpacity="0.25"
                        strokeWidth="1.2"
                        className="transition-all duration-150"
                      />
                      <text
                        y={3.5}
                        textAnchor="middle"
                        fontSize="11.5"
                        fill="#fff"
                        fontWeight="700"
                      >
                        {clipLabel(n.label, 8)}
                      </text>
                      <title>{n.label}（我学过的概念）</title>
                    </g>
                  );
                })}
            </svg>
          </div>
        )}

        {graph && graph.nodes.length > 0 && (
          <p className="mt-3 text-center text-[11.5px] text-slate-400">
            图由你本地存档自动生成 —— 悬停看关系线，点到哪个概念都会打开/生成它的报告
          </p>
        )}
      </main>
    </div>
  );
}