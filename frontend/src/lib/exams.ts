/** 出题大师领域模型：题库解析、多套卷组装、答题与判分。
 * 纯逻辑与 UI、IndexedDB、模型调用解耦，保证生成结果可校验、评分可回归测试。
 */

import { hashString } from "./cards";

export type ExamQuestionType = "single_choice" | "short_answer";
export type ExamDifficulty = 1 | 2 | 3;
export type ShortAnswerGrade = "correct" | "partial" | "wrong" | "ungraded";

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  stem: string;
  options: string[];
  answer: string[];
  keyPoints: string[];
  explanation: string;
  knowledgePoint: string;
  difficulty: ExamDifficulty;
  sourcePage?: number;
}

export interface QuestionBank {
  title: string;
  knowledgePoints: string[];
  questions: ExamQuestion[];
}

export interface ExamPaper {
  id: string;
  title: string;
  questionIds: string[];
  durationMinutes: number;
  createdAt: number;
}

export interface ExamResult {
  correct: boolean;
  result: "correct" | "partial" | "wrong" | "ungraded";
  earned: number;
}

export interface ExamAttempt {
  id: string;
  paperId: string;
  answers: Record<string, string[]>;
  selfGrades: Record<string, Exclude<ShortAnswerGrade, "ungraded">>;
  startedAt: number;
  submittedAt: number;
  score: number;
  maxScore: number;
  results: Record<string, ExamResult>;
}

export interface ExamSet {
  id: string;
  title: string;
  sourceName: string;
  focus: string;
  sourceText: string;
  difficulty: ExamDifficulty;
  questions: ExamQuestion[];
  papers: ExamPaper[];
  attempts: ExamAttempt[];
  createdAt: number;
  updatedAt: number;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : null;
}

function normalizeAnswerIndex(value: unknown, optionCount: number): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value < optionCount ? value : null;
  }
  const text = asString(value).toUpperCase();
  if (!text) return null;
  if (/^[A-Z]$/.test(text)) {
    const index = text.charCodeAt(0) - 65;
    return index >= 0 && index < optionCount ? index : null;
  }
  const numeric = Number(text);
  return Number.isInteger(numeric) && numeric >= 0 && numeric < optionCount
    ? numeric
    : null;
}

function normalizeQuestion(raw: unknown, index: number): ExamQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const typeText = asString(q.type).toLowerCase();
  const type: ExamQuestionType =
    typeText === "single" || typeText === "choice" || typeText === "single_choice"
      ? "single_choice"
      : "short_answer";
  const stem = asString(q.stem) || asString(q.question);
  if (!stem) return null;

  const options = asStringArray(q.options, 6);
  const answerIndex =
    type === "single_choice"
      ? normalizeAnswerIndex(q.answerIndex ?? q.correctAnswer ?? q.answer, options.length)
      : null;
  const shortAnswer = type === "short_answer" ? asString(q.answer) : "";
  if (type === "single_choice" && (options.length < 2 || answerIndex == null)) return null;
  if (type === "short_answer" && !shortAnswer) return null;

  const difficultyNumber = Number(q.difficulty);
  const difficulty: ExamDifficulty =
    difficultyNumber === 1 || difficultyNumber === 2 || difficultyNumber === 3
      ? difficultyNumber
      : 2;
  const sourcePageNumber = Number(q.sourcePage ?? q.page);
  const sourcePage =
    Number.isInteger(sourcePageNumber) && sourcePageNumber > 0
      ? sourcePageNumber
      : undefined;

  return {
    id: `q-${index + 1}-${hashString(stem).slice(0, 6)}`,
    type,
    stem,
    options,
    answer: type === "single_choice" ? [String(answerIndex)] : [shortAnswer],
    keyPoints: asStringArray(q.keyPoints ?? q.rubric),
    explanation: asString(q.explanation),
    knowledgePoint: asString(q.knowledgePoint) || "未标注知识点",
    difficulty,
    sourcePage,
  };
}

export function parseQuestionBank(raw: string): QuestionBank {
  const json = extractJsonObject(raw);
  if (!json) throw new Error("模型没有返回可解析的 JSON 题库");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("模型返回的 JSON 格式不正确");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("题库结构不正确");
  const obj = parsed as Record<string, unknown>;
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];
  const questions = rawQuestions
    .map((q, i) => normalizeQuestion(q, i))
    .filter((q): q is ExamQuestion => !!q);
  if (questions.length === 0) throw new Error("模型没有可用题目");

  return {
    title: asString(obj.title) || "未命名题库",
    knowledgePoints: asStringArray(obj.knowledgePoints, 30),
    questions,
  };
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function assembleExamPapers(
  bank: QuestionBank,
  opts: { countPerPaper: number; paperCount: number; seed: number }
): ExamPaper[] {
  const countPerPaper = Math.max(1, Math.min(30, Math.floor(opts.countPerPaper)));
  const paperCount = Math.max(1, Math.min(6, Math.floor(opts.paperCount)));
  const seed = Math.floor(opts.seed) || Date.now();
  const createdAt = Date.now();

  // 整个题库只洗一次：各套卷切互不重叠的窗口。
  // 若在循环里各洗一次牌，切出的窗口彼此无关，卷间会大量重题。
  const shuffled = shuffleWithSeed(bank.questions, seed);
  const needsUniqueLayout = bank.questions.length >= countPerPaper * paperCount;

  return Array.from({ length: paperCount }, (_, paperIndex) => {
    const start = needsUniqueLayout ? paperIndex * countPerPaper : 0;
    const selected = [...shuffled.slice(start, start + countPerPaper)];
    if (selected.length < countPerPaper) {
      selected.push(
        ...shuffled
          .filter((q) => !selected.some((picked) => picked.id === q.id))
          .slice(0, countPerPaper - selected.length)
      );
    }
    return {
      id: `paper-${seed.toString(36)}-${paperIndex + 1}`,
      title: `${bank.title} · 试卷 ${String.fromCharCode(65 + paperIndex)}`,
      questionIds: selected.map((q) => q.id),
      durationMinutes: Math.max(10, selected.length * 2),
      createdAt,
    };
  });
}

function scoreShortAnswer(
  grade: Exclude<ShortAnswerGrade, "ungraded"> | undefined
): { result: ShortAnswerGrade; earned: number } {
  if (grade === "correct") return { result: "correct", earned: 1 };
  if (grade === "partial") return { result: "partial", earned: 0.5 };
  if (grade === "wrong") return { result: "wrong", earned: 0 };
  return { result: "ungraded", earned: 0 };
}

export function gradeExamAttempt(opts: {
  questions: ExamQuestion[];
  paper: ExamPaper;
  answers: Record<string, string[]>;
  selfGrades?: Record<string, Exclude<ShortAnswerGrade, "ungraded">>;
  startedAt: number;
  now?: number;
}): ExamAttempt {
  const now = opts.now ?? Date.now();
  const byId = new Map(opts.questions.map((q) => [q.id, q]));
  const results: Record<string, ExamResult> = {};
  let score = 0;
  let maxScore = 0;

  for (const id of opts.paper.questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    maxScore += 1;
    if (q.type === "short_answer") {
      const scored = scoreShortAnswer(opts.selfGrades?.[id]);
      score += scored.earned;
      results[id] = {
        correct: scored.result === "correct",
        result: scored.result,
        earned: scored.earned,
      };
      continue;
    }
    const expected = q.answer.join(",");
    const actual = (opts.answers[id] ?? []).join(",");
    const correct = expected === actual;
    if (correct) score += 1;
    results[id] = { correct, result: correct ? "correct" : "wrong", earned: correct ? 1 : 0 };
  }

  return {
    id: `attempt-${now.toString(36)}`,
    paperId: opts.paper.id,
    answers: opts.answers,
    selfGrades: opts.selfGrades ?? {},
    startedAt: opts.startedAt,
    submittedAt: now,
    score,
    maxScore,
    results,
  };
}

export function examPercent(score: number, maxScore: number): number {
  return maxScore <= 0 ? 0 : Math.round((score / maxScore) * 100);
}

export function wrongQuestionIds(attempt: ExamAttempt): string[] {
  // 只收「已确认答错」：ungraded 表示还没自评，状态未知，不能当错题。
  return Object.entries(attempt.results)
    .filter(([, result]) => result.result === "wrong" || result.result === "partial")
    .map(([id]) => id);
}
