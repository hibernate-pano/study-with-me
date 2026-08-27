"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAllCards,
  getDueCards,
  putCard,
  deleteCard,
} from "@/lib/storage";
import { nextCard, fmtCardInfo, type Card } from "@/lib/cards";

/** 复习页：间隔重复复习「深入追问」自测题。本地数据，每天一张张过。 */
export default function ReviewPage() {
  const router = useRouter();
  const [due, setDue] = useState<Card[]>([]);
  const [total, setTotal] = useState<number | null>(null); // null = 加载中
  const [current, setCurrent] = useState<Card | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    (async () => {
      const all = await getAllCards().catch(() => []);
      const dueCards = await getDueCards().catch(() => []);
      setTotal(all.length);
      setDue(dueCards);
      setCurrent(dueCards[0] ?? null);
    })();
  }, []);

  const grade = async (remember: boolean) => {
    if (!current) return;
    const updated = nextCard(current, remember);
    await putCard(updated).catch(() => {});
    setDone((d) => d + 1);
    const rest = due.slice(1);
    setDue(rest);
    setCurrent(rest[0] ?? null);
    setShowAnswer(false);
  };

  const removeCurrent = async () => {
    if (!current) return;
    await deleteCard(current.key).catch(() => {});
    setTotal((t) => (t === null ? t : Math.max(0, t - 1)));
    const rest = due.slice(1);
    setDue(rest);
    setCurrent(rest[0] ?? null);
    setShowAnswer(false);
  };

  const ratio =
    total === null || total === 0
      ? 0
      : Math.round((done / (due.length + done)) * 100);

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回首页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">🗂 复习</div>
          <div className="flex-1" />
          {total !== null && total > 0 && (
            <span className="text-[12px] text-slate-400">
              本轮已复习 <span className="font-bold text-slate-600">{done}</span> ·
              剩 <span className="font-bold text-slate-600">{due.length}</span> 张
              （共 {total} 张）
            </span>
          )}
        </div>
        {total !== null && total > 0 && (
          <div className="h-0.5 bg-slate-100">
            <div
              className="brand-grad h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, ratio))}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* 加载中 */}
        {total === null && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center text-[13px] text-slate-400">
            加载中…
          </div>
        )}

        {/* 空库 */}
        {total === 0 && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center">
            <div className="text-[15px] font-bold text-slate-700">
              还没有复习卡
            </div>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-slate-500 leading-relaxed">
              去深挖一个概念，报告里的「🔍 深入追问」自测题会
              <span className="font-medium text-slate-600">自动变成复习卡</span>，
              在这里隔天复习，把知识焊进脑子里。
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-[13.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              去学第一个概念 →
            </button>
          </div>
        )}

        {/* 全部复习完 */}
        {total !== null && total > 0 && !current && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center">
            <div className="text-[30px]">🎉</div>
            <div className="mt-2 text-[15px] font-bold text-slate-700">
              今天都复习完了
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              隔天它们会按节奏再回来。去学点新东西，扩充你的知识网络吧。
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-[13.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              回首页 →
            </button>
          </div>
        )}

        {/* 答题卡 */}
        {current && (
          <div className="card lift overflow-hidden">
            {/* 卡头 */}
            <div className="flex items-center gap-2.5 px-5 pt-4">
              <button
                onClick={() => router.push(`/analyze/${encodeURIComponent(current.term)}`)}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                title="回到这个概念的报告"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                {current.term}
              </button>
              <span className="text-[11px] text-slate-400">{fmtCardInfo(current)}</span>
              <div className="flex-1" />
              <button
                onClick={removeCurrent}
                className="text-[11px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="删除这张卡"
              >
                删除
              </button>
            </div>

            {/* 问题（正面） */}
            <div className="px-6 py-8">
              <h2 className="text-[22px] font-bold leading-relaxed text-slate-900">
                {current.question}
              </h2>
            </div>

            {/* 翻面 */}
            {!showAnswer ? (
              <div className="px-6 pb-8">
                <button
                  onClick={() => setShowAnswer(true)}
                  className="btn-primary w-full px-5 py-3 text-[14px]"
                >
                  显示答案 / 自评
                </button>
              </div>
            ) : (
              <div className="fade-up px-6 pb-8 space-y-4">
                {current.answer && (
                  <div className="rounded-xl border border-[var(--line)] bg-slate-50/70 px-4 py-3.5 text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {current.answer}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => grade(false)}
                    className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-[14px] font-bold text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 active:scale-[0.98] cursor-pointer"
                  >
                    忘了 · 明天再来
                  </button>
                  <button
                    onClick={() => grade(true)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-[14px] font-bold text-emerald-600 transition-all hover:-translate-y-0.5 hover:bg-emerald-100 active:scale-[0.98] cursor-pointer"
                  >
                    记住了 · 间隔翻倍
                  </button>
                </div>
                <p className="text-center text-[11px] text-slate-400">
                  记住后间隔 1 → 2 → 4 → … → 30 天；忘了则明天再来一次
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}