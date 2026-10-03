"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExamPaper, ExamSet } from "@/lib/exams";
import { IconArrowRight, IconClock } from "@/components/icons";

interface Props {
  examSet: ExamSet;
  paper: ExamPaper;
  onBack: () => void;
  onSubmit: (answers: Record<string, string[]>, startedAt: number) => void;
}

function fmtElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ExamRunner({ examSet, paper, onBack, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [now, setNow] = useState(Date.now());
  const [startedAt] = useState(Date.now());
  const byId = useMemo(
    () => new Map(examSet.questions.map((q) => [q.id, q])),
    [examSet.questions]
  );
  const questions = useMemo(
    () =>
      paper.questionIds
        .map((id) => byId.get(id))
        .filter((q): q is NonNullable<typeof q> => !!q),
    [byId, paper.questionIds]
  );
  const answered = questions.filter((q) => (answers[q.id] ?? []).some((v) => v.trim())).length;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = () => {
    const missing = questions.length - answered;
    if (missing > 0 && !window.confirm(`还有 ${missing} 题未作答，确定提交吗？`)) return;
    onSubmit(answers, startedAt);
  };

  return (
    <div className="space-y-5">
      <section className="card sticky top-2 z-20 flex flex-wrap items-center gap-3 p-4 sm:top-3">
        <button type="button" onClick={onBack} className="btn-ghost min-h-10 px-3 py-2 text-[12.5px]">
          <IconArrowRight size={14} className="rotate-180" />
          题库
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold text-ink-800">{paper.title}</h1>
          <p className="mt-0.5 nums text-[11.5px] text-ink-faint">
            已答 {answered} / {questions.length} · 建议 {paper.durationMinutes} 分钟
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 mono text-[13px] font-semibold text-ink-700"
          aria-label={`已用时 ${Math.floor((now - startedAt) / 1000)} 秒`}
        >
          <IconClock size={13} className="text-ink-400" />
          {fmtElapsed(Math.floor((now - startedAt) / 1000))}
        </span>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        {questions.map((q, index) => (
          <fieldset key={q.id} className="card p-5 sm:p-6">
            <legend className="sr-only">
              第 {index + 1} 题
            </legend>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-ink-50 px-2.5 py-1 font-semibold text-ink-700">
                第 {index + 1} 题
              </span>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-soft">
                {q.type === "single_choice" ? "单选题" : "简答题"}
              </span>
              <span className="text-ink-faint">{q.knowledgePoint}</span>
              {q.sourcePage && <span className="text-ink-faint"> · 教材第 {q.sourcePage} 页</span>}
            </div>

            <p className="mt-4 text-[16px] font-semibold leading-relaxed text-ink-900">
              {q.stem}
            </p>

            {q.type === "single_choice" ? (
              <div className="mt-4 space-y-2">
                {q.options.map((option, optionIndex) => {
                  const value = String(optionIndex);
                  const checked = answers[q.id]?.[0] === value;
                  return (
                    <label
                      key={`${q.id}-${optionIndex}`}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-[14px] leading-relaxed transition-colors ${
                        checked
                          ? "border-ink-300 bg-ink-50 text-ink-900"
                          : "border-[var(--line)] bg-white text-ink-700 hover:border-ink-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={value}
                        checked={checked}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: [value] }))
                        }
                        className="mt-1 h-4 w-4 accent-ink-600"
                      />
                      <span className="font-semibold text-ink-400">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={answers[q.id]?.[0] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: [e.target.value] }))
                }
                rows={4}
                placeholder="先凭记忆作答，提交后再对照评分点…"
                className="mt-4 w-full resize-y rounded-xl border border-[var(--line-strong)] bg-white px-3.5 py-3 text-[16px] leading-relaxed text-ink-700 sm:text-[14px]"
              />
            )}
          </fieldset>
        ))}

        <div className="flex flex-wrap justify-end gap-3 pb-8">
          <button type="button" onClick={onBack} className="btn-ghost min-h-11 px-5 py-2.5 text-[13px]">
            暂时退出
          </button>
          <button type="submit" className="btn-primary min-h-11 px-6 py-2.5 text-[13px]">
            提交并判分
          </button>
        </div>
      </form>
    </div>
  );
}
