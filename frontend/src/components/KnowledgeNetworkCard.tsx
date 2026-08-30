"use client";

import { useMemo } from "react";
import { parseNetworkMarkdown, type FlatConcept } from "@/lib/network";

/**
 * 知识网络卡片视图（v1.7 typographic 版）
 * - 每组：serif 标签 + 小色点 + 副标题（更少 chrome）
 * - 每个概念：serif 名称 + 一句话描述（无 border box，更杂志感）
 * - 整组按类型用淡色背景分组（前置/兄弟/后继/对立/类比）
 */

interface Props {
  markdown: string;
  streaming: boolean;
  onConceptClick?: (concept: FlatConcept) => void;
}

export default function KnowledgeNetworkCard({ markdown, streaming, onConceptClick }: Props) {
  const groups = useMemo(() => parseNetworkMarkdown(markdown), [markdown]);

  if (groups.length === 0 && streaming) {
    return (
      <div className="space-y-5 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="shimmer h-3 w-16 mb-2.5" />
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <div className="shimmer h-4 w-24" />
              <div className="shimmer h-4 w-32" />
              <div className="shimmer h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <div className="space-y-5 py-1">
      {groups.map((g, gi) => (
        <div
          key={gi}
          className="rounded-xl px-4 py-3.5"
          style={{ background: g.bg + "80" }}
        >
          {/* 组标签：色点 + serif 标签 + 副标题 */}
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: g.color }}
            />
            <span
              className="font-serif-zh text-[13.5px] font-semibold tracking-wide"
              style={{ color: g.color }}
            >
              {g.label}
            </span>
            <span className="text-[11.5px] text-slate-500 tracking-wide">
              {g.subtitle}
            </span>
            <span className="flex-1 border-t border-dashed border-slate-200/60 ml-1 mb-1" />
            <span className="text-[10.5px] text-slate-500 font-mono tabular-nums">
              {g.concepts.length}
            </span>
          </div>

          {/* 概念：typographic 列表（不像 chip，像杂志的索引） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {g.concepts.map((c, ci) => (
              <button
                key={ci}
                onClick={() => onConceptClick?.(c)}
                className="group text-left cursor-pointer"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif-zh text-[14.5px] font-medium group-hover:underline underline-offset-2"
                    style={{ color: c.color }}
                  >
                    {c.name}
                  </span>
                </div>
                {c.description && (
                  <div className="mt-0.5 text-[12px] text-slate-500 leading-[1.55]">
                    {c.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] text-slate-500/80 mt-1 pl-1">
        点击任意概念 → 在右侧抽屉深挖，不离开当前报告。
      </p>
    </div>
  );
}