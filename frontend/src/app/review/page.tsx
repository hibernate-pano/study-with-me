"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAllCards,
  getDueCards,
  putCard,
  deleteCard,
  cardReportHref,
} from "@/lib/storage";
import { nextCard, fmtCardInfo, type Card, type Grade } from "@/lib/cards";
import {
  IconArrowRight,
  IconCheck,
  IconExternal,
  IconRefresh,
  IconTrash,
} from "@/components/icons";

/** 复习页：间隔重复复习自测题。本地数据，每天一张张过。
 *  三档自评语义固定：忘了=红 / 模糊=琥珀 / 记住了=绿（与全站状态色同源）。 */
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

  // 键盘快捷键：Space 翻面、1 忘了、2 模糊、3 记住了
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // 只认裸按键：⌘1..9 / Ctrl+1..9 / Alt+1..9 是浏览器切标签页，切走前 keydown
      // 会先派发到本页，误落进 grade 分支会静默抹掉卡的间隔与已学次数。
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        if (current && !showAnswer) {
          e.preventDefault(); // 防止页面滚动
          setShowAnswer(true);
        }
      } else if (e.key === "1") {
        if (current && showAnswer) void grade("again");
      } else if (e.key === "2") {
        if (current && showAnswer) void grade("hard");
      } else if (e.key === "3") {
        if (current && showAnswer) void grade("good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, showAnswer]);

  const grade = async (rating: Grade) => {
    if (!current) return;
    const updated = nextCard(current, rating);
    await putCard(updated).catch(() => {});
    setDone((d) => d + 1);
    const rest = due.slice(1);
    setDue(rest);
    setCurrent(rest[0] ?? null);
    setShowAnswer(false);
  };

  const removeCurrent = async () => {
    if (!current) return;
    if (!window.confirm(`确定删除这张卡？「${current.question.slice(0, 30)}…」删除后不再复习。`))
      return;
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
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-ink-100 lg:hidden"
            title="返回首页"
          >
            <IconExternal size={16} className="rotate-180" />
            首页
          </button>
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-ink-800">
            <IconRefresh size={15} className="text-ink-500" />
            复习
          </div>
          <div className="flex-1" />
          {total !== null && total > 0 && (
            <span className="text-[12px] text-ink-faint">
              本轮 <span className="font-bold nums text-ink-600">{done}</span> ·
              剩 <span className="font-bold nums text-ink-600">{due.length}</span>
              <span className="hidden sm:inline">（共 {total} 张）</span>
            </span>
          )}
        </div>
        {total !== null && total > 0 && (
          <div className="h-0.5 bg-ink-100">
            <div
              className="h-full rounded-full bg-ink-700 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, ratio))}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* 加载中 */}
        {total === null && (
          <div className="card p-8 text-center text-[13px] text-ink-faint">加载中…</div>
        )}

        {/* 空库 */}
        {total === 0 && (
          <EmptyState
            title="还没有复习卡"
            desc="去深挖一个概念，报告里的「深入追问」自测题和一句话定义会自动变成复习卡，在这里隔天复习，把知识焊进脑子里。"
            actionLabel="去学第一个概念"
            onAction={() => router.push("/")}
          />
        )}

        {/* 全部复习完 */}
        {total !== null && total > 0 && !current && (
          <EmptyState
            icon={<IconCheck size={26} className="text-[var(--st-ok)]" />}
            title="今天都复习完了"
            desc="隔天它们会按节奏再回来。去学点新东西，扩充你的知识网络吧。"
            actionLabel="回首页"
            onAction={() => router.push("/")}
          />
        )}

        {/* 答题卡 */}
        {current && (
          <div className="card lift overflow-hidden">
            {/* 卡头 */}
            <div className="flex items-center gap-2.5 px-5 pt-4">
              <button
                onClick={() => router.push(cardReportHref(current))}
                className="state-chip state-info cursor-pointer"
                title="回到这份报告"
              >
                <IconExternal size={11} />
                {current.term}
              </button>
              <span className="text-[11px] text-ink-faint">{fmtCardInfo(current)}</span>
              <div className="flex-1" />
              <button
                onClick={removeCurrent}
                className="btn-quiet p-1 text-[11px] hover:text-[var(--st-err)]"
                title="删除这张卡"
                aria-label="删除这张卡"
              >
                <IconTrash size={13} />
              </button>
            </div>

            {/* 问题（正面） */}
            <div className="px-6 py-8">
              <h2 className="text-[22px] font-bold leading-relaxed text-ink-900">
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
                  <span className="rounded border border-white/30 bg-white/15 px-1.5 py-0.5 mono text-[11px] text-white/90">
                    Space
                  </span>
                </button>
              </div>
            ) : (
              <div className="fade-up space-y-4 px-6 pb-8">
                {current.answer && (
                  <div className="card-sunken px-4 py-3.5 text-[14px] leading-relaxed text-ink-soft whitespace-pre-wrap">
                    {current.answer}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2.5">
                  <GradeButton
                    grade="again"
                    label="忘了"
                    hint="明天再来"
                    keyLabel="1"
                    onClick={() => grade("again")}
                  />
                  <GradeButton
                    grade="hard"
                    label="模糊"
                    hint="温和推进"
                    keyLabel="2"
                    onClick={() => grade("hard")}
                  />
                  <GradeButton
                    grade="good"
                    label="记住了"
                    hint="间隔翻倍"
                    keyLabel="3"
                    onClick={() => grade("good")}
                  />
                </div>
                <p className="text-center text-[11px] text-ink-faint">
                  记住了间隔翻倍（→30 天封顶）· 模糊至少 +1 天 · 忘了明天重来
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const GRADE_STYLE = {
  again: {
    border: "border-[var(--st-err-line)]",
    bg: "bg-[var(--st-err-bg)]",
    text: "text-[var(--st-err)]",
  },
  hard: {
    border: "border-[var(--st-warn-line)]",
    bg: "bg-[var(--st-warn-bg)]",
    text: "text-[var(--st-warn)]",
  },
  good: {
    border: "border-[var(--st-ok-line)]",
    bg: "bg-[var(--st-ok-bg)]",
    text: "text-[var(--st-ok)]",
  },
} as const;

function GradeButton({
  grade,
  label,
  hint,
  keyLabel,
  onClick,
}: {
  grade: keyof typeof GRADE_STYLE;
  label: string;
  hint: string;
  keyLabel: string;
  onClick: () => void;
}) {
  const s = GRADE_STYLE[grade];
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3 transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer ${s.border} ${s.bg} ${s.text}`}
    >
      <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
        {label}
        <span className="flex h-4 min-w-4 items-center justify-center rounded border border-current/30 bg-white/50 px-1 mono text-[10px]">
          {keyLabel}
        </span>
      </span>
      <span className="text-[11px] opacity-70">{hint}</span>
    </button>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="card p-8 text-center">
      {icon && <div className="mb-3 flex justify-center">{icon}</div>}
      <div className="text-[15px] font-bold text-ink-800">{title}</div>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">{desc}</p>
      <button onClick={onAction} className="btn-primary mx-auto mt-5 px-5 py-2.5 text-[13.5px]">
        {actionLabel}
        <IconArrowRight size={14} />
      </button>
    </div>
  );
}
