"use client";

import { useMemo } from "react";
import { flattenGroups, parseNetworkMarkdown, type FlatConcept } from "@/lib/network";

/**
 * 知识网络卡片视图（按关联类型分组）。
 *
 * 设计目的：让用户一眼看到「这个概念在知识网络里处于什么位置」
 * - 每组一个标签（前置 / 兄弟 / 后继 / 对立 / 跨领域类比）
 * - 每组每个概念是一张 chip：粗体名称 + 一句话描述
 * - 点击 chip → onConceptClick 回调（在右侧抽屉里深挖，不离开当前报告）
 */

interface Props {
  markdown: string;
  streaming: boolean;
  onConceptClick?: (concept: FlatConcept) => void;
}

export default function KnowledgeNetworkCard({ markdown, streaming, onConceptClick }: Props) {
  const groups = useMemo(() => parseNetworkMarkdown(markdown), [markdown]);
  const allConcepts = useMemo(() => flattenGroups(groups), [groups]);

  if (groups.length === 0 && streaming) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <div className="shimmer h-4 w-1/4 mb-3" />
            <div className="flex flex-wrap gap-2">
              <div className="shimmer h-12 w-40 rounded-lg" />
              <div className="shimmer h-12 w-48 rounded-lg" />
              <div className="shimmer h-12 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div
          key={gi}
          className="rounded-xl border border-[var(--line)] bg-white p-4"
          style={{ background: g.bg + "55" }}
        >
          <div className="flex items-baseline gap-2 mb-2.5">
            <span
              className="inline-block px-2 py-0.5 rounded-md text-[11.5px] font-bold text-white shrink-0"
              style={{ background: g.color }}
            >
              {g.label}
            </span>
            <span className="text-[12px] text-slate-500">{g.subtitle}</span>
          </div>

          <div className="space-y-2">
            {g.concepts.map((c, ci) => {
              // 从 allConcepts 反查，拿到完整 FlatConcept（含 color / relationType）
              const flat = allConcepts.find((x) => x.name === c.name) ?? {
                name: c.name,
                description: c.description,
                relationType: g.type,
                groupLabel: g.label,
                color: g.color,
              };
              return (
                <button
                  key={ci}
                  onClick={() => onConceptClick?.(flat)}
                  className="group w-full text-left rounded-lg border bg-white pl-3 pr-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                  style={{ borderColor: g.color + "55" }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: g.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13.5px] font-bold" style={{ color: g.color }}>
                          {c.name}
                        </span>
                        <span className="text-[10.5px] text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          点击深挖 →
                        </span>
                      </div>
                      {c.description && (
                        <div className="mt-0.5 text-[12px] text-slate-500 leading-relaxed line-clamp-2">
                          {c.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[11.5px] text-slate-400 mt-1">
        点击任意概念 → 右侧抽屉滑出深挖报告，不离开当前页面。
      </p>
    </div>
  );
}