"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExamSetup, { type ExamDraft } from "@/components/ExamSetup";
import ExamRunner from "@/components/ExamRunner";
import ExamResults from "@/components/ExamResults";
import {
  assembleExamPapers,
  gradeExamAttempt,
  type ExamAttempt,
  type ExamPaper,
  type ExamSet,
  type QuestionBank,
} from "@/lib/exams";
import {
  deleteExamSet,
  getAllExamSets,
  saveExamSet,
} from "@/lib/storage";

interface ActiveExam {
  examSet: ExamSet;
  paper: ExamPaper;
  attempt?: ExamAttempt;
}

function makeId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export default function ExamPage() {
  const router = useRouter();
  const [sets, setSets] = useState<ExamSet[]>([]);
  const [active, setActive] = useState<ActiveExam | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAllExamSets().then(setSets).catch(() => setSets([]));
  }, []);

  const generate = async (draft: ExamDraft) => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          sourceText: draft.sourceText,
          focus: draft.focus,
          questionCount: draft.questionCountPerPaper * draft.paperCount,
          difficulty: draft.difficulty,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        bank?: QuestionBank;
        error?: string;
      };
      if (!res.ok || !data.bank) {
        throw new Error(data.error || `生成失败（${res.status}）`);
      }

      const now = Date.now();
      // 题量不足就报错并把真实题量告诉用户，由用户决定调题量/套数或扩大资料，
      // 而不是静默交付每套缺题的卷子。
      const needed = draft.questionCountPerPaper * draft.paperCount;
      const available = data.bank.questions.length;
      if (available < needed) {
        throw new Error(
          `模型只生成了 ${available} 道可用题，不够组装 ${draft.paperCount} 套 × 每套 ${draft.questionCountPerPaper} 题（需要 ${needed} 道）。请减少套数或每套题量，或扩大资料范围后重试。`
        );
      }

      const papers = assembleExamPapers(data.bank, {
        countPerPaper: draft.questionCountPerPaper,
        paperCount: draft.paperCount,
        seed: now,
      });

      const examSet: ExamSet = {
        id: makeId("exam"),
        title: data.bank.title || draft.title,
        sourceName: draft.sourceName,
        focus: draft.focus,
        sourceText: draft.sourceText,
        difficulty: draft.difficulty,
        questions: data.bank.questions,
        papers,
        attempts: [],
        createdAt: now,
        updatedAt: now,
      };
      await saveExamSet(examSet);
      setSets((prev) => [examSet, ...prev]);
      setActive({ examSet, paper: papers[0] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const persistExamSet = async (next: ExamSet) => {
    setActive((current) => (current ? { ...current, examSet: next } : current));
    setSets((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    await saveExamSet(next);
  };

  const submitAttempt = async (
    answers: Record<string, string[]>,
    startedAt: number
  ) => {
    if (!active) return;
    const attempt = gradeExamAttempt({
      questions: active.examSet.questions,
      paper: active.paper,
      answers,
      startedAt,
    });
    const next: ExamSet = {
      ...active.examSet,
      attempts: [...active.examSet.attempts, attempt],
      updatedAt: Date.now(),
    };
    setActive({ ...active, examSet: next, attempt });
    await persistExamSet(next);
  };

  const updateAttempt = async (attempt: ExamAttempt) => {
    if (!active) return;
    const next: ExamSet = {
      ...active.examSet,
      attempts: active.examSet.attempts.map((item) =>
        item.id === attempt.id ? attempt : item
      ),
      updatedAt: Date.now(),
    };
    setActive({ ...active, examSet: next, attempt });
    await persistExamSet(next);
  };

  const openPaper = (examSet: ExamSet, paper: ExamPaper) => {
    setError("");
    setActive({ examSet, paper });
  };

  const removeSet = async (id: string) => {
    await deleteExamSet(id);
    setSets((prev) => prev.filter((item) => item.id !== id));
    if (active?.examSet.id === id) setActive(null);
  };

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
              className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">出题大师</div>
          <div className="flex-1" />
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:inline">
            浏览器本地存储
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:py-9 fade-up">
        {!active && (
          <div className="mb-7">
            <p className="text-[11px] font-bold tracking-[0.16em] text-ink-500">
              EXAM MASTER
            </p>
            <h1 className="mt-2 font-disp text-[34px] font-semibold leading-tight text-[var(--ink-deep)] sm:text-[42px]">
              把学过的东西，
              <br className="sm:hidden" />
              变成一场真正会做的考试。
            </h1>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              从 PDF 课本、课程大纲或知识点出发，先建立结构化题库，再随机组装多套试卷
              （题量充足时各套之间不重题）。作答后自动判客观题、自评简答题，错题直接进入复习。
            </p>
          </div>
        )}

        {active ? (
          active.attempt ? (
            <ExamResults
              examSet={active.examSet}
              paper={active.paper}
              attempt={active.attempt}
              onAttemptChange={(attempt) => void updateAttempt(attempt)}
              onRetry={() =>
                setActive((current) => (current ? { ...current, attempt: undefined } : current))
              }
              onBack={() => setActive(null)}
            />
          ) : (
            <ExamRunner
              examSet={active.examSet}
              paper={active.paper}
              onBack={() => setActive(null)}
              onSubmit={(answers, startedAt) => void submitAttempt(answers, startedAt)}
            />
          )
        ) : (
          <ExamSetup
            sets={sets}
            generating={generating}
            error={error}
            onGenerate={(draft) => void generate(draft)}
            onOpenPaper={openPaper}
            onDeleteSet={(id) => void removeSet(id)}
          />
        )}
      </main>
    </div>
  );
}
