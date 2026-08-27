"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import { getAllReports, getDueCards } from "@/lib/storage";

/**
 * 全局命令面板（⌘K / Ctrl+K）
 * - 全站可用；layout 里挂载一次
 * - 三类结果分组：📂 你的报告 / ⚡ 内置动作 / 🆕 深挖新概念
 * - 键盘：↑↓ 选中、Enter 跳转、Esc 关闭、⌘K 切换
 */

type ActionItem = { kind: "action"; id: string; title: string; subtitle: string; icon: string };
type ReportItem = { kind: "report"; term: string; updatedAt: number };
type NewItem = { kind: "new" };
type Item = ReportItem | ActionItem | NewItem;

const ACTIONS: ActionItem[] = [
  { kind: "action", id: "review", title: "去复习", subtitle: "间隔重复自测题", icon: "🗂" },
  { kind: "action", id: "map", title: "我的知识网络（焦点）", subtitle: "全屏沉浸式地图", icon: "🗺" },
  { kind: "action", id: "compare", title: "概念对比", subtitle: "把两个概念放一起辨析", icon: "⚖️" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<{ term: string; updatedAt: number }[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [active, setActive] = useState(0);

  // ⌘K / Ctrl+K 触发 + 自定义事件（让任意按钮能打开）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cd:open-palette", onCustom as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cd:open-palette", onCustom as EventListener);
    };
  }, [open]);

  // 打开时：加载本地存档 + 重置状态
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
  }, [open]);

  // 过滤并分组
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedReports: ReportItem[] = (q
      ? reports.filter((r) => r.term.toLowerCase().includes(q)).slice(0, 8)
      : reports.slice(0, 6)
    ).map((r) => ({ kind: "report" as const, term: r.term, updatedAt: r.updatedAt }));
    const acts: ActionItem[] = ACTIONS.filter((a): a is ActionItem => {
      if (a.id === "review" && dueCount === 0) return false;
      if (a.kind !== "action") return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const newItem: NewItem[] = q.trim() ? [{ kind: "new" }] : [];
    return { matchedReports, acts, newItem };
  }, [query, reports, dueCount]);

  const flat: Item[] = useMemo(
    () => [...grouped.matchedReports, ...grouped.acts, ...grouped.newItem],
    [grouped]
  );

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.kind === "report") {
        router.push(`/analyze/${encodeURIComponent(item.term)}`);
        return;
      }
      if (item.kind === "new") {
        router.push(`/analyze/${encodeURIComponent(query.trim())}`);
        return;
      }
      if (item.id === "review") router.push("/review");
      else if (item.id === "map") router.push("/map");
      else if (item.id === "compare") {
        // 用最近的两个概念做对比；不够则去 /compare 自填
        if (reports.length >= 2) {
          router.push(
            `/compare?a=${encodeURIComponent(reports[1].term)}&b=${encodeURIComponent(reports[0].term)}`
          );
        } else {
          router.push("/compare");
        }
      }
    },
    [router, query, reports]
  );

  // 全局键盘（处理打开时的上下）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat.length]);

  if (!open) return null;

  // 找到每个分组在 flat 中的边界（用于渲染 section header）
  let cursor = 0;
  const sections = [
    {
      title: "📂 你的报告",
      hint: "按更新时间倒序",
      count: grouped.matchedReports.length,
      render: () => {
        const start = cursor;
        cursor += grouped.matchedReports.length;
        return { start, length: grouped.matchedReports.length };
      },
    },
    {
      title: "⚡ 内置动作",
      hint: "跳转页面或开始操作",
      count: grouped.acts.length,
      render: () => {
        const start = cursor;
        cursor += grouped.acts.length;
        return { start, length: grouped.acts.length };
      },
    },
    {
      title: "🆕 深挖新概念",
      hint: "按 Enter 直接开始",
      count: grouped.newItem.length,
      render: () => {
        const start = cursor;
        cursor += grouped.newItem.length;
        return { start, length: grouped.newItem.length };
      },
    },
  ].filter((s) => s.count > 0);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-start pt-[12vh] kbar-backdrop fade-up"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal
    >
      <div
        className="kbar-panel mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 输入区 */}
        <div className="border-b border-slate-100 px-5 py-4">
          <SearchBox
            initial=""
            autoFocus
            size="md"
            onChange={(v) => {
              setQuery(v);
              setActive(0);
            }}
            onEnter={() => {
              if (flat[active]) go(flat[active]);
              else if (query.trim()) {
                setOpen(false);
                router.push(`/analyze/${encodeURIComponent(query.trim())}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                // 已在外层监听，避免重复处理
                e.preventDefault();
                return true;
              }
              return false;
            }}
          />
          <p className="mt-2 text-[11.5px] text-slate-400">
            ↑↓ 选择 · Enter 跳转 · Esc 关闭
          </p>
        </div>

        {/* 结果列表（分组） */}
        <div className="max-h-[48vh] overflow-y-auto scroll-thin py-1">
          {flat.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-slate-400">
              {query.trim() ? `没有匹配「${query.trim()}」，按 Enter 深挖新概念` : "还没有存档，去首页挖一个概念？"}
            </div>
          ) : (
            sections.map((sec) => {
              const { start, length } = sec.render();
              return (
                <div key={sec.title} className="py-1.5">
                  <div className="flex items-baseline gap-2 px-5 pt-1 pb-1.5">
                    <span className="text-[10.5px] font-bold tracking-wider text-slate-400">
                      {sec.title.toUpperCase().replace(/^[^\s]+\s/, "")}
                    </span>
                    <span className="text-[10.5px] text-slate-300">{sec.hint}</span>
                  </div>
                  {Array.from({ length }).map((_, i) => {
                    const idx = start + i;
                    const it = flat[idx];
                    const isActive = idx === active;
                    return (
                      <button
                        key={renderKey(it, idx)}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(it)}
                        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <IconBox item={it} active={isActive} />
                        <span className="flex-1 min-w-0">
                          <span className={`block truncate text-[14px] ${isActive ? "text-indigo-700 font-semibold" : "text-slate-800"}`}>
                            {renderTitle(it, query)}
                          </span>
                          <span className="block truncate text-[11.5px] text-slate-400">
                            {renderSubtitle(it)}
                          </span>
                        </span>
                        {isActive && (
                          <span className="shrink-0 text-[11px] text-indigo-400 font-mono">↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 底栏：快捷提示 + 复习提醒 */}
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

function renderKey(it: Item, idx: number): string {
  if (it.kind === "report") return `r:${it.term}`;
  if (it.kind === "action") return `a:${it.id}`;
  return `n:${idx}`;
}

function renderTitle(it: Item, q: string): string {
  if (it.kind === "report") return it.term;
  if (it.kind === "action") return it.title;
  return `深挖「${q.trim()}」`;
}

function renderSubtitle(it: Item): string {
  if (it.kind === "report") return `学过的概念 · ${fmtRel(it.updatedAt)}`;
  if (it.kind === "action") return it.subtitle;
  return "按 Enter 直接开始生成";
}

function IconBox({ item, active }: { item: Item; active: boolean }) {
  let content = "";
  if (item.kind === "report") content = item.term.slice(0, 1);
  else if (item.kind === "action") content = item.icon;
  else content = "✦";

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[13px] transition-colors ${
        active
          ? "border-indigo-200 bg-white text-indigo-600"
          : "border-slate-100 bg-white text-slate-500"
      }`}
    >
      {content}
    </span>
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