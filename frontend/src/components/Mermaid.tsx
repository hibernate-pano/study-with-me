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
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        if (cancelled || !ref.current) return;
        const id = `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
      {error ? (
        <pre className="rounded-md bg-slate-50 border border-slate-200 p-3 text-[12.5px] leading-relaxed overflow-x-auto">
          <code>{code}</code>
        </pre>
      ) : (
        <div ref={ref} className="overflow-x-auto" />
      )}
    </div>
  );
}
