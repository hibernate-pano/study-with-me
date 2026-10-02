"use client";

import { useMemo, useState } from "react";
import {
  examPercent,
  gradeExamAttempt,
  wrongQuestionIds,
  type ExamAttempt,
  type ExamPaper,
  type ExamSet,
  type ShortAnswerGrade,
} from "@/lib/exams";
import { newCard } from "@/lib/cards";
import { getCard, putCard } from "@/lib/storage";

interface Props {
  examSet: ExamSet;
  paper: ExamPaper;
  attempt: ExamAttempt;
  onAttemptChange: (attempt: ExamAttempt) => void;
  onRetry: () => void;
  onBack: () => void;
}

function resultLabel(result: string): string {
  if (result === "correct") return "正确";
  if (result === "partial") return "部分正确";
  if (result === "ungraded") return "待自评";
  return "错误";
}

export default function ExamResults({
  examSet,
  paper,
  attempt,
  onAttemptChange,
  onRetry,
  onBack,
}: Props) {
  const [cardsAdded, setCardsAdded] = useState(false);
  const byId = useMemo(
    () => new Map(examSet.questions.map((q) => [q.id, q])),
    [examSet.questions]
  );
  const questions = paper.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => !!q);
  const percent = examPercent(attempt.score, attempt.maxScore);
  const wrongIds = wrongQuestionIds(attempt);
  // 简答题未自评时状态未知，不能进复习队列：先让用户自评再允许建卡。
  const hasUngraded = Object.values(attempt.results).some(
    (result) => result.result === "ungraded"
  );

  const setSelfGrade = (
    questionId: string,
    grade: Exclude<ShortAnswerGrade, "ungraded">
  ) => {
    const selfGrades = { ...attempt.selfGrades, [questionId]: grade };
    const next = gradeExamAttempt({
      questions: examSet.questions,
      paper,
      answers: attempt.answers,
      selfGrades,
      startedAt: attempt.startedAt,
      now: attempt.submittedAt,
    });
    onAttemptChange(next);
  };

  const addWrongCards = async () => {
    for (const id of wrongIds) {
      const q = byId.get(id);
      if (!q) continue;
      const answer =
        q.type === "single_choice"
          ? `正确答案：${String.fromCharCode(65 + Number(q.answer[0]))}. ${
              q.options[Number(q.answer[0])] ?? ""
            }\n\n${q.explanation}`
          : `${q.answer[0]}\n\n评分点：${q.keyPoints.join("；")}\n\n${q.explanation}`;
      // 与 syncCardsFromReport 同一约定：同 key 的卡已存在就跳过，
      // 否则重考后再答错会把已记住的卡打回新卡、清零复习进度。
      const card = newCard(examSet.title, { question: q.stem, answer });
      const existing = await getCard(card.key);
      if (!existing) await putCard(card);
    }
    setCardsAdded(true);
  };

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="bg-[#1d1d1a] px-6 py-7 text-white">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[12px] font-medium text-white/70">{paper.title}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-disp text-[56px] font-semibold leading-none">
                  {percent}
                </span>
                <span className="pb-1 text-[15px] text-white/75">分</span>
              </div>
              <p className="mt-2 text-[12.5px] text-white/75">
                答对 {attempt.score} / {attempt.maxScore} 项
                {attempt.results && Object.values(attempt.results).some((r) => r.result === "ungraded")
                  ? " · 简答题完成自评后会更新总分"
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="min-h-10 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-semibold hover:bg-white/20"
              >
                再考一次
              </button>
              <button
                type="button"
                onClick={onBack}
                className="min-h-10 rounded-lg bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50"
              >
                返回题库
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4">
          <p className="text-[12.5px] text-slate-500">
            错题 {wrongIds.length} 题。加入复习后，会按现有间隔重复节奏再次出现。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {hasUngraded && (
              <span className="text-[12px] text-amber-700">
                请先完成简答题自评，再加入复习
              </span>
            )}
            <button
              type="button"
              onClick={() => void addWrongCards()}
              disabled={wrongIds.length === 0 || cardsAdded || hasUngraded}
              className="btn-ghost min-h-10 px-4 py-2 text-[12.5px] disabled:opacity-40"
            >
              {cardsAdded ? "已加入复习" : "错题加入复习"}
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {questions.map((q, index) => {
          const result = attempt.results[q.id];
          const answer = attempt.answers[q.id]?.[0] ?? "";
          const correctAnswer =
            q.type === "single_choice"
              ? `${String.fromCharCode(65 + Number(q.answer[0]))}. ${
                  q.options[Number(q.answer[0])] ?? ""
                }`
              : q.answer[0];
          const tone =
            result?.result === "correct"
              ? "border-emerald-200"
              : result?.result === "partial"
              ? "border-amber-200"
              : result?.result === "ungraded"
              ? "border-slate-200"
              : "border-red-200";
          return (
            <article key={q.id} className={`card border ${tone} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-400">第 {index + 1} 题</span>
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    result?.result === "correct"
                      ? "bg-emerald-50 text-emerald-700"
                      : result?.result === "partial"
                      ? "bg-amber-50 text-amber-700"
                      : result?.result === "ungraded"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {resultLabel(result?.result ?? "wrong")}
                </span>
                <span className="text-slate-400">{q.knowledgePoint}</span>
                {q.sourcePage && <span className="text-slate-400"> · 第 {q.sourcePage} 页</span>}
              </div>

              <h2 className="mt-4 text-[16px] font-semibold leading-relaxed text-slate-900">
                {q.stem}
              </h2>

              {q.type === "single_choice" && (
                <div className="mt-4 space-y-2">
                  {q.options.map((option, optionIndex) => {
                    const value = String(optionIndex);
                    const isCorrectOption = q.answer[0] === value;
                    const isUserOption = answer === value;
                    return (
                      <div
                        key={`${q.id}-${optionIndex}`}
                        className={`rounded-lg border px-3 py-2 text-[13.5px] leading-relaxed ${
                          isCorrectOption
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : isUserOption
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-[var(--line)] text-slate-600"
                        }`}
                      >
                        <strong className="mr-2">{String.fromCharCode(65 + optionIndex)}.</strong>
                        {option}
                        {isCorrectOption && <span className="ml-2 text-[11px]">正确答案</span>}
                        {isUserOption && !isCorrectOption && (
                          <span className="ml-2 text-[11px]">你的选择</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "short_answer" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--line)] bg-slate-50/70 p-4">
                    <p className="text-[11.5px] font-bold text-slate-500">你的回答</p>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">
                      {answer || "（未作答）"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-[11.5px] font-bold text-emerald-700">参考答案</p>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-emerald-900">
                      {correctAnswer}
                    </p>
                    {q.keyPoints.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-4 text-[12.5px] text-emerald-800">
                        {q.keyPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {q.explanation && (
                <div className="mt-4 rounded-xl bg-[var(--bg-soft)] px-4 py-3 text-[13px] leading-relaxed text-slate-600">
                  <strong className="text-slate-700">解析：</strong>
                  {q.explanation}
                </div>
              )}

              {q.type === "short_answer" && (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold text-slate-600">
                    对照评分点自评
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["correct", "完全答对"],
                      ["partial", "部分答对"],
                      ["wrong", "答错了"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setSelfGrade(
                            q.id,
                            value as Exclude<ShortAnswerGrade, "ungraded">
                          )
                        }
                        className={`min-h-10 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium ${
                          attempt.selfGrades[q.id] === value
                            ? "border-ink-300 bg-ink-50 text-ink-700"
                            : "border-[var(--line)] bg-white text-slate-600 hover:border-ink-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
