"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { extractSectionText } from "@/lib/stream";
import type { MapNode } from "@/lib/map";
import type { StoredReport } from "@/lib/storage";

/**
 * 节点预览抽屉：地图上点击节点后，右侧弹出预览面板。
 * - "我学过的"节点 → 显示已存报告的一句话定义 + 关系 + 跳转按钮
 * - "相关概念"节点 → 显示 LLM 当时给的一句话描述 + 「深挖」按钮
 */

type Props = {
  node: MapNode;
  report: StoredReport | null;
  onClose: () => void;
  /** 来自节点所在的图（用于"我学过的"显示其相关概念） */
  relatedFromHere?: { name: string; relationType: string; color: string }[];
};

export default function ConceptPreview({ node, report, onClose, relatedFromHere }: Props) {
  const router = useRouter();

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMine = node.kind === "mine";
  const definition = report
    ? extractSectionText(report.fullText, "定义") || extractSectionText(report.fullText, "辨析") || ""
    : "";
  const takeaways = report
    ? extractSectionText(report.fullText, "核心重点").slice(0, 220)
    : "";
  const conceptDesc = node.description || "";

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[380px] pointer-events-none fade-up"
      role="dialog"
      aria-modal
    >
      <div className="h-full pointer-events-auto surface border-l border-white/40 rounded-none sm:rounded-l-2xl overflow-y-auto scroll-thin">
        <div className="px-6 py-5">
          {/* 关闭按钮 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold ${
                  isMine
                    ? "bg-gradient-to-br from-violet-400 to-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                {node.label.slice(0, 1)}
              </span>
              <span
                className={`text-[10.5px] font-bold tracking-wider uppercase ${
                  isMine ? "text-indigo-600" : "text-slate-500"
                }`}
              >
                {isMine ? "我学过的" : "相关概念"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              title="关闭（Esc）"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 标题 */}
          <h2 className="mt-3 text-[22px] font-extrabold leading-tight text-slate-900">
            {node.label}
          </h2>

          {/* 权重条（出现频次） */}
          {node.weight > 1 && (
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-slate-500">
              <span>在网络中</span>
              <span className="font-bold text-slate-700">{node.weight}</span>
              <span>次关联</span>
              <span className="ml-2 inline-block h-1 flex-1 max-w-[120px] rounded-full bg-slate-100 overflow-hidden">
                <span
                  className="block h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full"
                  style={{ width: `${Math.min(100, node.weight * 14)}%` }}
                />
              </span>
            </div>
          )}

          {/* 主体 */}
          <div className="mt-5">
            {isMine && report ? (
              <MineBody definition={definition} takeaways={takeaways} />
            ) : (
              <RelatedBody description={conceptDesc} />
            )}
          </div>

          {/* 我学过的：相关概念 mini 列表 */}
          {isMine && relatedFromHere && relatedFromHere.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-[10.5px] font-bold tracking-wider text-slate-500 mb-2">
                这个概念的关联
              </div>
              <div className="flex flex-wrap gap-1.5">
                {relatedFromHere.slice(0, 8).map((c) => (
                  <button
                    key={c.name}
                    onClick={() => router.push(`/analyze/${encodeURIComponent(c.name)}`)}
                    className="group inline-flex items-center gap-1 rounded-full border border-slate-100 bg-white px-2 py-0.5 text-[11.5px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="mt-6 flex flex-col gap-2">
            {isMine && report ? (
              <>
                <button
                  onClick={() => router.push(`/analyze/${encodeURIComponent(node.label)}`)}
                  className="brand-grad w-full rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,0.6)] cursor-pointer transition-all hover:shadow-[0_12px_28px_-10px_rgba(99,102,241,0.7)]"
                >
                  打开完整报告 →
                </button>
                <button
                  onClick={() => router.push(`/compare?a=${encodeURIComponent(node.label)}`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ⚖️ 拿这个和其它概念对比
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push(`/analyze/${encodeURIComponent(node.label)}`)}
                className="brand-grad w-full rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,0.6)] cursor-pointer"
              >
                ✦ 深挖「{node.label.slice(0, 10)}{node.label.length > 10 ? "…" : ""}」
              </button>
            )}
          </div>

          {/* 更新于 */}
          {report && (
            <div className="mt-4 text-center text-[11px] text-slate-500">
              报告更新于 {fmtDate(report.updatedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MineBody({ definition, takeaways }: { definition: string; takeaways: string }) {
  if (!definition && !takeaways) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-[12.5px] text-slate-500">
        报告已存档，但内容解析失败。请打开完整报告查看。
      </div>
    );
  }
  return (
    <>
      {definition && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="text-[10.5px] font-bold tracking-wider text-indigo-500 mb-1.5">
            🎯 一句话定义
          </div>
          <p className="font-serif-zh text-[14.5px] leading-relaxed text-slate-800">
            {definition.slice(0, 180)}
            {definition.length > 180 ? "…" : ""}
          </p>
        </div>
      )}
      {takeaways && (
        <div className="mt-3">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 mb-1.5">
            📌 核心重点 · 预览
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-600 line-clamp-4">
            {takeaways}
          </p>
        </div>
      )}
    </>
  );
}

function RelatedBody({ description }: { description: string }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
      <div className="text-[10.5px] font-bold tracking-wider text-amber-600 mb-1.5">
        🌐 来自其它报告的描述
      </div>
      <p className="text-[13px] leading-relaxed text-slate-700">
        {description || "暂无描述，深挖后会自动补全。"}
      </p>
      <p className="mt-2 text-[11.5px] text-slate-500">
        你还没学过这个概念。点下面深挖它会自动连入你的网络。
      </p>
    </div>
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}