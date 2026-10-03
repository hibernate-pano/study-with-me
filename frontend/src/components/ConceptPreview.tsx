"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { extractSectionText } from "@/lib/stream";
import type { MapNode } from "@/lib/map";
import type { StoredReport } from "@/lib/storage";
import {
  IconArrowRight,
  IconClose,
  IconGlobe,
  IconScale,
  IconSpark,
  IconTarget,
} from "./icons";

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
    // 这里刻意不声明 aria-modal：这是一块无遮罩的侧边预览，背后的地图始终可见可点
    // （点别的节点会直接换预览内容）。声明 aria-modal 等于告诉读屏「背景是惰性的」，
    // 而它并不惰性——要么对 AT 谎报，要么就把背景 inert 掉、顺带废掉地图的交互。
    // 非模态 dialog 是合法的 ARIA 组合，只是要补上可访问名。
    <div
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[380px] pointer-events-none fade-up"
      role="dialog"
      aria-label={`概念预览：${node.label}`}
    >
      <div className="h-full pointer-events-auto surface border-l border-white/40 rounded-none sm:rounded-l-2xl overflow-y-auto scroll-thin">
        <div className="px-6 py-5">
          {/* 关闭按钮 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold ${
                  isMine
                    ? "bg-ink-800 text-white"
                    : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                {node.label.slice(0, 1)}
              </span>
              <span
                className={`text-[10.5px] font-bold tracking-wider uppercase ${
                  isMine ? "text-ink-600" : "text-slate-500"
                }`}
              >
                {isMine ? "我学过的" : "相关概念"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="btn-icon !h-8 !w-8"
              title="关闭（Esc）"
              aria-label="关闭预览"
            >
              <IconClose size={15} />
            </button>
          </div>

          {/* 标题 */}
          <h2 className="mt-3 text-[22px] font-extrabold leading-tight text-ink-900">
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
                  className="block h-full bg-ink-500 rounded-full"
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
                    className="group inline-flex items-center gap-1 rounded-full border border-slate-100 bg-white px-2 py-0.5 text-[11.5px] text-slate-600 hover:border-ink-300 hover:text-ink-600 cursor-pointer"
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
                  className="btn-primary w-full px-4 py-2.5 text-[13.5px]"
                >
                  打开完整报告
                  <IconArrowRight size={14} />
                </button>
                <button
                  onClick={() => router.push(`/compare?a=${encodeURIComponent(node.label)}`)}
                  className="btn-ghost w-full px-4 py-2.5 text-[13px]"
                >
                  <IconScale size={14} />
                  拿这个和其它概念对比
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push(`/analyze/${encodeURIComponent(node.label)}`)}
                className="btn-primary w-full px-4 py-2.5 text-[13.5px]"
              >
                <IconSpark size={14} />
                深挖「{node.label.slice(0, 10)}{node.label.length > 10 ? "…" : ""}」
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
      <div className="rounded-xl border border-dashed border-[var(--line)] bg-ink-50/60 p-4 text-[12.5px] text-ink-soft">
        报告已存档，但内容解析失败。请打开完整报告查看。
      </div>
    );
  }
  return (
    <>
      {definition && (
        <div className="rounded-xl border border-[var(--line-soft)] bg-ink-50/60 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 label !text-ink-500">
            <IconTarget size={12} />
            一句话定义
          </div>
          <p className="font-disp text-[14.5px] leading-relaxed text-ink-800">
            {definition.slice(0, 180)}
            {definition.length > 180 ? "…" : ""}
          </p>
        </div>
      )}
      {takeaways && (
        <div className="mt-3">
          <div className="mb-1.5 label !text-ink-faint">
            核心重点 · 预览
          </div>
          <p className="line-clamp-4 text-[12.5px] leading-relaxed text-ink-soft">
            {takeaways}
          </p>
        </div>
      )}
    </>
  );
}

function RelatedBody({ description }: { description: string }) {
  return (
    <div className="rounded-xl border border-[var(--st-info-line)] bg-[var(--st-info-bg)]/50 p-4">
      <div className="mb-1.5 flex items-center gap-1.5 label !text-[var(--st-info)]">
        <IconGlobe size={12} />
        来自其它报告的描述
      </div>
      <p className="text-[13px] leading-relaxed text-ink-700">
        {description || "暂无描述，深挖后会自动补全。"}
      </p>
      <p className="mt-2 text-[11.5px] text-ink-faint">
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
