"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import { getAllReports, getDueCards } from "@/lib/storage";

/**
 * 全局命令面板（⌘K / Ctrl+K）
 * - 打开：任一页面按 ⌘K / Ctrl+K，或顶栏"搜索"按钮
 * - 行为：模糊匹配本地存档（概念名/描述）+ 内置动作（去复习 / 去地图 / 换个新概念）
 * - 选中即跳转；空查询时直接当搜索框提交一个新概念
 */

type Item =
  | { kind: "report"; term: string; updatedAt: number }
  | { kind: "action"; id: string; title: string; subtitle: string; icon: string };

const ACTIONS: Item[] = [
  { kind: "action", id: "review", title: "去复习", subtitle: "间隔重复自测题", icon: "🗂" },
  { kind: "action", id: "map", title: "我的知识网络", subtitle: "全屏焦点地图", icon: "🗺" },
  { kind: "action", id: "new", title: "深挖一个新概念", subtitle: "输入并直接开始生成", icon: "✦" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<{ term: string; updatedAt: number }[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // ⌘K / Ctrl+K 触发
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 打开时：加载本地存档 + 自动聚焦 + 重置 query
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    Promise.all([getAllReports(), getDueCards()])
      .then(([rs, cards]) => {
        const mains = rs
          .filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:"))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((r) => ({ term: r.term, updatedAt: r.updatedAt }));
        setReports(mains);
        setDueCount(cards.length);
      })
      .catch(() => {});
    // 给浏览器一帧让 panel 渲染，再聚焦
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // 过滤结果
  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matched: Item[] = q
      ? reports
          .filter((r) => r.term.toLowerCase().includes(q))
          .slice(0, 8)
          .map((r) => ({ kind: "report", term: r.term, updatedAt: r.updatedAt }))
      : reports.slice(0, 5).map((r) => ({ kind: "report", term: r.term, updatedAt: r.updatedAt }));
    const acts: Item[] = ACTIONS.filter((a): a is Extract<Item, { kind: "action" }> => {
      if (a.kind !== "action") return false;
      if (a.id === "review" && dueCount === 0) return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...matched, ...acts];
  }, [query, reports, dueCount]);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.kind === "report") {
        router.push(`/analyze/${encodeURIComponent(item.term)}`);
      } else {
        if (item.id === "review") router.push("/review");
        else if (item.id === "map") router.push("/map");
        else if (item.id === "new") router.push(`/analyze/${encodeURIComponent(query.trim())}`);
      }
    },
    [router, query]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-start pt-[14vh] kbar-backdrop fade-up"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal
    >
      <div
        className="kbar-panel mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 输入区 */}
        <div className="border-b border-slate-100 px-5 py-4">
          <SearchBox
            initial={query}
            autoFocus
            size="md"
            onChange={(v) => {
              setQuery(v);
              setActive(0);
            }}
            onEnter={() => {
              if (items[active]) go(items[active]);
              else if (query.trim()) {
                setOpen(false);
                router.push(`/analyze/${encodeURIComponent(query.trim())}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(items.length - 1, i + 1));
                return true;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
                return true;
              }
              return false;
            }}
          />
          <p className="mt-2 text-[11.5px] text-slate-400">
            ↑↓ 选择 · Enter 跳转 · ⌘K 关闭 · 留空直接当搜索框
          </p>
        </div>

        {/* 结果列表 */}
        <div className="max-h-[44vh] overflow-y-auto scroll-thin py-1">
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">
              {query.trim() ? `没有匹配「${query.trim()}」的报告，按 Enter 深挖新概念` : "还没有存档，去首页挖一个概念？"}
            </div>
          ) : (
            items.map((it, i) => {
              const isActive = i === active;
              const subtitle =
                it.kind === "report"
                  ? `已学过的概念 · ${fmtRel(it.updatedAt)}`
                  : it.subtitle;
              return (
                <button
                  key={it.kind + (it.kind === "report" ? it.term : it.id)}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-[13px]">
                    {it.kind === "report" ? it.term.slice(0, 1) : it.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-[14px] ${isActive ? "text-indigo-700 font-semibold" : "text-slate-800"}`}>
                      {it.kind === "report" ? it.term : it.title}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-400">{subtitle}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-300">
                    {it.kind === "report" ? "↵" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* 底栏：快捷提示 */}
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-[11px] text-slate-500">
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">↑↓</kbd> 移动</span>
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">↵</kbd> 选择</span>
          <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono">esc</kbd> 关闭</span>
          <div className="flex-1" />
          {dueCount > 0 && (
            <span className="text-amber-600">🗂 {dueCount} 张复习卡到期</span>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtRel(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return m < 1 ? "刚刚" : `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return `${Math.floor(day / 30)} 个月前`;
}