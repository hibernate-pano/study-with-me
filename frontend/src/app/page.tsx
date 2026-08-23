"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import { getRecent, type StoredReport } from "@/lib/storage";
import { extractSectionText } from "@/lib/stream";

const EXAMPLES = [
  "分布式锁",
  "十五规划",
  "Kafka",
  "费曼学习法",
  "Raft 共识算法",
  "什么是CPI",
];

const MODULES = [
  { icon: "🎯", title: "一句话定义", desc: "1-2 句话秒懂概念", color: "#6366f1" },
  { icon: "📌", title: "核心重点", desc: "最重要的事、先抓什么", color: "#f59e0b" },
  { icon: "⚠️", title: "常见误区", desc: "易错点、错误认知→正确理解", color: "#ef4444" },
  { icon: "🧩", title: "拆解分析", desc: "拆成部分，讲清关联", color: "#8b5cf6" },
  { icon: "🧭", title: "进阶路径", desc: "从零到精通的阶段路线", color: "#10b981" },
  { icon: "🌐", title: "知识网络 ⭐", desc: "相关/相似/相反/跨领域，构建你的知识网", color: "#06b6d4" },
  { icon: "🔍", title: "深入追问", desc: "自测题检验真懂假懂", color: "#ec4899" },
  { icon: "📚", title: "推荐资料", desc: "书/文章/课程 + 联网检索", color: "#0ea5e9" },
];

const fmtArchiveTime = (ts: number): string => {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

export default function HomePage() {
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  const [library, setLibrary] = useState<StoredReport[]>([]);

  const refreshLibrary = useCallback(() => {
    getRecent(30)
      .then((rs) => {
        // 只把主报告（非深挖）当作「学过的东西」展示
        const mains = rs.filter((r) => !r.key.startsWith("drill:")).slice(0, 3);
        setLibrary(mains);
      })
      .catch(() => setLibrary([]));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cd-recent");
      if (raw) setRecent(JSON.parse(raw).slice(0, 8));
    } catch {
      /* ignore */
    }
    refreshLibrary();
  }, [refreshLibrary]);

  const go = (term: string) => router.push(`/analyze/${encodeURIComponent(term)}`);

  return (
    <div className="min-h-screen hero-bg">
      <main className="mx-auto max-w-3xl px-5 pt-16 pb-24">
        {/* 品牌 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-2xl">⛏️</span>
          <span className="text-[15px] font-bold tracking-wide text-slate-700">
            概念深挖器
          </span>
        </div>

        {/* 标题 */}
        <h1 className="text-center text-[34px] md:text-[42px] font-extrabold leading-tight tracking-tight text-slate-900">
          输入一个词，
          <br className="md:hidden" />
          快速<span className="text-indigo-600">抓住重点</span>、搞懂概念
        </h1>
        <p className="mt-4 text-center text-[15px] text-slate-500 leading-relaxed">
          从「分布式锁」到「十五规划」——AI 帮你厘清概念、拆解分析、找出重点与误区，
          <br className="hidden md:block" />
          并帮你把它挂到一张知识网络上：相关、相似、相反、跨领域类比，一网打尽。
        </p>

        {/* 搜索框 */}
        <div className="mt-9">
          <SearchBox autoFocus />
        </div>

        {/* 示例 */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => go(e)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--line)] bg-white text-[13px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>

        {/* 场景示例：完整段落输入 */}
        <div className="mt-5 max-w-2xl mx-auto">
          <button
            onClick={() => go("我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？")}
            className="w-full text-left rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-3 transition-colors cursor-pointer"
          >
            <div className="text-[11.5px] font-bold tracking-wider text-indigo-500 mb-1">
              ✨ 也支持完整段落
            </div>
            <div className="text-[13.5px] text-slate-600 leading-relaxed">
              &ldquo;我在学分布式系统设计，其中一个词叫分布式锁，该怎么理解？&rdquo;
              <span className="ml-1 text-slate-400">→ 点这里试一下</span>
            </div>
          </button>
        </div>

        {/* 最近搜索 */}
        {recent.length > 0 && (
          <div className="mt-5 text-center">
            <span className="text-[12px] text-slate-400 mr-2">最近：</span>
            {recent.map((t) => (
              <button
                key={t}
                onClick={() => go(t)}
                title={t}
                className="mr-2 text-[13px] text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer truncate inline-block max-w-[160px] align-bottom"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* 我的知识库：最近学过的概念（真实数据来自本地 IndexedDB） */}
        {library.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h2 className="text-[19px] font-bold text-slate-800">
                最近学过的概念
              </h2>
              <span className="text-[11.5px] text-slate-400">你的报告会自动保存在本地</span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {library.map((r) => (
                <button
                  key={r.key}
                  onClick={() => go(r.term)}
                  className="group text-left rounded-2xl border border-[var(--line)] bg-white/80 hover:border-indigo-200 hover:shadow-sm px-4 py-3.5 transition-all cursor-pointer"
                  title={`打开「${r.term}」`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[14px] font-bold text-indigo-600">
                      {r.term.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-slate-800 truncate">
                        {r.term}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {fmtArchiveTime(r.updatedAt)}更新
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 text-[12.5px] text-slate-500 leading-relaxed line-clamp-2">
                    {extractSectionText(r.fullText, "定义") || "点击查看完整报告"}
                  </div>
                  {r.related.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {r.related.slice(0, 3).map((c) => (
                        <span
                          key={c.name}
                          className="px-2 py-0.5 rounded-full text-[10.5px] text-slate-500 bg-slate-50 border border-[var(--line)]"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 模块说明 */}
        <div className="mt-16">
          <h2 className="text-center text-[19px] font-bold text-slate-800">
            一份报告，<span className="text-indigo-600">8</span> 个模块
          </h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="flex items-start gap-3.5 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3.5"
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
                  style={{ background: m.color + "1a" }}
                >
                  {m.icon}
                </span>
                <div>
                  <div className="text-[14px] font-bold text-slate-800">
                    {m.title}
                  </div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">
                    {m.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-14 text-center text-[12px] text-slate-400">
          支持技术术语、政策名词、学科概念、人物事件等任意词 · 内容由 AI 生成，请交叉验证关键信息
        </p>
      </main>
    </div>
  );
}
