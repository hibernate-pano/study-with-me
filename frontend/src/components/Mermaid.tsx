"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 客户端 mermaid 渲染器：懒加载 mermaid（不拖累首屏），把架构模块里的
 * ```mermaid 代码块画成图。渲染失败时回退为原样代码块，保证内容不丢。
 */
export default function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 每轮 code 变化都从「无错」重试：流式生成时前半截代码（""/"g"/"graph T"…）必然解析失败，
    // 若沿用上一次的 error，error 分支会把带 ref 的容器整个卸载，后续 effect 全部提前 return，
    // 图就永久停在原始代码块上（刷新走非流式路径才看得到图）。
    setError(null);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        if (cancelled || !ref.current) return;
        const id = `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        // 容器改为常驻，失败时它可能还留着上一次成功渲染的 SVG，先清空，
        // 免得从错误态恢复的那一帧短暂露出与当前代码不符的过期图。
        ref.current.innerHTML = "";
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "渲染失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="my-3">
      {/* 画图容器常驻（ref 元素不能被卸载，否则重试时 ref.current 为空直接 return）；
          失败时只切可见内容：隐藏空容器 + 原样代码兜底，内容不丢 */}
      <div ref={ref} className={error ? "hidden" : "overflow-x-auto"} />
      {error && (
        <pre className="rounded-md bg-slate-50 border border-slate-200 p-3 text-[12.5px] leading-relaxed overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
