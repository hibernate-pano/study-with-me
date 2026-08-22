"use client";

import { useEffect } from "react";

/**
 * 全局 Error Boundary。
 * 任何路由的渲染错误都会到这里，显示统一的友好兜底页。
 * （Next.js 15 App Router 约定：`app/error.tsx` 接住路由段及子段的错误，
 * 不会替换根 layout。）
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-[22px] font-bold text-slate-900 mb-2">页面出错了</h2>
        <p className="text-[14px] text-slate-500 mb-6 leading-relaxed">
          {error.message || "出了点意料之外的问题，请稍后再试。"}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[14px] font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          重试
        </button>
      </div>
    </div>
  );
}