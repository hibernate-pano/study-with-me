"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getDueCards, purgeLegacyRepoData } from "@/lib/storage";
import {
  IconCompare,
  IconDig,
  IconExam,
  IconNetwork,
  IconReview,
  IconTrends,
} from "./icons";
import AuthBar from "./AuthBar";

/** 已删功能（repo 学习）残留清理只跑一次的标志（模块级，路由变化不重跑） */
let legacyPurged = false;

/**
 * 全局应用壳（三栏布局骨架）：
 * - lg+：固定左侧栏（品牌 / 分组导航 / 登录与元信息），内容列整体右移；
 * - <lg：侧栏收起，顶部一条可横滚的全局导航，页面自己的 topbar 照旧工作。
 * 导航高亮跟 pathname；「复习」挂到期卡数角标（本地 IndexedDB，进页面 + 聚焦时刷新）。
 */

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  badge?: "due";
  icon: ReactNode;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "学习",
    items: [
      {
        href: "/",
        label: "概念深挖",
        match: (p) => p === "/" || p.startsWith("/analyze"),
        icon: <IconDig />,
      },
      {
        href: "/compare",
        label: "概念对比",
        match: (p) => p.startsWith("/compare"),
        icon: <IconCompare />,
      },
      {
        href: "/exam",
        label: "出题大师",
        match: (p) => p.startsWith("/exam"),
        icon: <IconExam />,
      },
    ],
  },
  {
    title: "知识库",
    items: [
      {
        href: "/map",
        label: "知识网络",
        match: (p) => p.startsWith("/map"),
        icon: <IconNetwork />,
      },
      {
        href: "/review",
        label: "复习",
        match: (p) => p.startsWith("/review"),
        badge: "due",
        icon: <IconReview />,
      },
      {
        href: "/trends",
        label: "学习统计",
        match: (p) => p.startsWith("/trends"),
        icon: <IconTrends />,
      },
    ],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" title="回首页">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-900 text-white">
        <IconDig size={13} />
      </span>
      {!compact && (
        <span className="text-[13.5px] font-bold tracking-[0.02em] text-ink-900">
          概念深挖器
        </span>
      )}
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [dueCount, setDueCount] = useState(0);

  const refreshDue = useCallback(() => {
    getDueCards()
      .then((cards) => setDueCount(cards.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // 首次挂载先清已删功能（repo 学习）的残留数据，再刷角标；模块级标志防路由变化重复跑
    void (legacyPurged
      ? Promise.resolve()
      : purgeLegacyRepoData()
          .then(() => {
            legacyPurged = true;
          })
          .catch(() => {})
    ).finally(refreshDue);
    window.addEventListener("focus", refreshDue);
    // 复习/出题完成后角标要回落：路由变化时顺带刷新
    return () => window.removeEventListener("focus", refreshDue);
  }, [refreshDue, pathname]);

  const badgeOf = (item: NavItem) =>
    item.badge === "due" && dueCount > 0 ? dueCount : null;

  return (
    <div className="min-h-screen">
      {/* 键盘用户第一个 Tab 即可跳过导航直达主内容 */}
      <a href="#main" className="skip-link">
        跳到主内容
      </a>

      {/* ── 桌面侧栏：纯白「机身」面板，与灰画布形成台面/机身对比 ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-[var(--line)] bg-white lg:flex">
        <div className="px-5 pb-5 pt-5">
          <Brand />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto scroll-thin px-3" aria-label="全局导航">
          {NAV.map((group) => (
            <div key={group.title}>
              <div className="label px-2.5 pb-1.5">{group.title}</div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.match(pathname);
                  const badge = badgeOf(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
                          active
                            ? "bg-[var(--brand-soft)] font-semibold text-ink-900"
                            : "text-ink-soft hover:bg-ink-50 hover:text-ink"
                        }`}
                      >
                        <span className={active ? "text-ink-900" : "text-slate-400"}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                        {badge !== null && (
                          <span
                            className={`ml-auto rounded-md px-1.5 py-px mono text-[10.5px] ${
                              // 到期数 = 待办警告（琥珀色洗）；其余计数保持中性灰
                              item.badge === "due"
                                ? "bg-[var(--st-warn-bg)] text-[var(--st-warn)]"
                                : "bg-ink-100 text-ink-600"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--line)] px-4 py-3.5">
          <AuthBar variant="sidebar" />
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-slate-400/90">
            内容由 AI 生成 · 请交叉验证关键信息
          </p>
        </div>
      </aside>

      {/* ── 移动端全局导航条（不吸顶，页面自己的 topbar 负责吸顶） ── */}
      <div className="topbar border-b border-[var(--line)] lg:hidden">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Brand compact />
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto scroll-thin" aria-label="全局导航">
            {NAV.flatMap((g) => g.items).map((item) => {
              const active = item.match(pathname);
              const badge = badgeOf(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] transition-colors ${
                    active
                      ? "bg-ink-800 text-white"
                      : "text-ink-soft hover:bg-ink-100/70"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {badge !== null && (
                    <span
                      className={`rounded-full px-1.5 mono text-[10px] ${
                        active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <AuthBar variant="compact" />
        </div>
      </div>

      {/* 内容列：桌面端给侧栏让位 */}
      <div id="main" className="lg:pl-[228px]">
        {children}
      </div>
    </div>
  );
}
