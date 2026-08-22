"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

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
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-[22px] font-bold text-slate-900 mb-2">报告生成失败</h2>
        {term && (
          <p className="text-[13px] text-slate-500 mb-2">「{term}」</p>
        )}
        <p className="text-[14px] text-slate-500 mb-6 leading-relaxed">
          {error.message || "AI 服务暂时不可用，请稍后再试。"}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[14px] font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            重试
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-xl border border-[var(--line)] bg-white text-[14px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            回首页
          </button>
        </div>
      </div>
    </div>
  );
}