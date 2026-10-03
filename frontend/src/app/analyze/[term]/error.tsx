"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconArrowRight, IconRefresh, IconWarn } from "@/components/icons";

/**
 * 报告页专属 Error Boundary。
 * 拦截 LLM 报告生成、Markdown 渲染等环节的崩溃，
 * 让用户拿到一个干净的"生成失败"界面 + 重试，而不是白屏。
 */
export default function AnalyzeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ term: string }>();
  const term = params?.term ? decodeURIComponent(params.term) : "";

  useEffect(() => {
    console.error("[analyze/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5" role="alert">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--st-err-bg)] text-[var(--st-err)]">
            <IconWarn size={24} />
          </span>
        </div>
        <h2 className="mb-2 text-[22px] font-bold text-ink-900">报告生成失败</h2>
        {term && (
          <p className="mb-2 text-[13px] text-ink-faint">「{term}」</p>
        )}
        <p className="mb-6 text-[14px] leading-relaxed text-ink-soft">
          {error.message || "AI 服务暂时不可用，请稍后再试。"}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="btn-primary px-5 py-2.5 text-[14px]"
          >
            <IconRefresh size={15} />
            重试
          </button>
          <button
            onClick={() => router.push("/")}
            className="btn-ghost px-5 py-2.5 text-[14px]"
          >
            <IconArrowRight size={15} className="rotate-180" />
            回首页
          </button>
        </div>
      </div>
    </div>
  );
}
