"use client";

import { useId, useMemo, useState } from "react";
import { buildPageRangeText, extractPdfPages, normalizePageRange, type ParsedPdf } from "@/lib/pdf";
import type { ExamDifficulty, ExamPaper, ExamSet } from "@/lib/exams";

export interface ExamDraft {
  title: string;
  sourceName: string;
  sourceText: string;
  focus: string;
  questionCountPerPaper: number;
  paperCount: number;
  difficulty: ExamDifficulty;
}

interface Props {
  sets: ExamSet[];
  generating: boolean;
  error: string;
  onGenerate: (draft: ExamDraft) => void;
  onOpenPaper: (set: ExamSet, paper: ExamPaper) => void;
  onDeleteSet: (id: string) => void;
}

function fmtUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExamSetup({
  sets,
  generating,
  error,
  onGenerate,
  onOpenPaper,
  onDeleteSet,
}: Props) {
  const fileId = useId();
  const titleId = useId();
  const focusId = useId();
  const textId = useId();
  const startId = useId();
  const endId = useId();
  const countId = useId();
  const paperCountId = useId();
  const difficultyId = useId();

  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pdf, setPdf] = useState<ParsedPdf | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(30);
  const [questionsPerPaper, setQuestionsPerPaper] = useState(8);
  const [paperCount, setPaperCount] = useState(2);
  const [difficulty, setDifficulty] = useState<ExamDifficulty>(2);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [fileError, setFileError] = useState("");

  const pageRange = pdf
    ? normalizePageRange(startPage, endPage, pdf.pageCount)
    : null;
  const effectiveSource = useMemo(() => {
    if (!pdf) return pastedText.trim();
    return buildPageRangeText(pdf.pages, startPage, endPage);
  }, [pdf, pastedText, startPage, endPage]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    setParsing(true);
    setParseProgress("正在读取 PDF…");
    try {
      const parsed = await extractPdfPages(file, (current, total) => {
        setParseProgress(`正在提取第 ${current} / ${total} 页…`);
      });
      setPdf(parsed);
      setStartPage(1);
      setEndPage(Math.min(30, parsed.pageCount));
      if (!title.trim()) setTitle(parsed.fileName.replace(/\.pdf$/i, ""));
      setParseProgress(
        parsed.emptyPages.length > 0
          ? `已解析 ${parsed.pageCount} 页，其中 ${parsed.emptyPages.length} 页没有文字`
          : `已解析 ${parsed.pageCount} 页`
      );
    } catch (err) {
      setPdf(null);
      setFileError(err instanceof Error ? err.message : "PDF 解析失败");
      setParseProgress("");
    } finally {
      setParsing(false);
    }
  };

  const sourceLength = effectiveSource.length;
  // 与 buildExamPrompt 的 clampPrompt(sourceText, 60_000) 对齐，否则 6~8 万字会被静默截断。
  const sourceReady = sourceLength >= 100 && sourceLength <= 60_000;
  const totalQuestions = questionsPerPaper * paperCount;
  const canGenerate =
    !!title.trim() &&
    sourceReady &&
    totalQuestions <= 30 &&
    !generating &&
    !parsing;

  const submit = () => {
    if (!canGenerate) return;
    onGenerate({
      title: title.trim(),
      sourceName: pdf?.fileName || "手动输入的学习资料",
      sourceText: effectiveSource,
      focus: focus.trim(),
      questionCountPerPaper: questionsPerPaper,
      paperCount,
      difficulty,
    });
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif-zh text-[24px] font-semibold text-[var(--ink-deep)]">
              新建试卷
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
              文件只在当前浏览器解析。选择页段后，只把对应文字发送给 AI 命题。
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11.5px] font-medium text-indigo-700">
            本地原文 · 云端题库暂不启用
          </span>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div>
              <label
                htmlFor={fileId}
                className="mb-1.5 block text-[13px] font-semibold text-slate-700"
              >
                ① 上传 PDF 课本
              </label>
              <label
                htmlFor={fileId}
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-5 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="text-[14px] font-semibold text-indigo-700">
                  {pdf ? pdf.fileName : "选择可复制文字的 PDF"}
                </span>
                <span className="mt-1 text-[11.5px] text-slate-500">
                  {pdf
                    ? `${pdf.pageCount} 页 · ${pdf.emptyPages.length} 页未提取到文字`
                    : "上限 50MB；扫描版 PDF 暂不支持 OCR"}
                </span>
              </label>
              <input
                id={fileId}
                type="file"
                accept=".pdf,application/pdf"
                className="visually-hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
                disabled={parsing || generating}
              />
              {(parsing || parseProgress) && (
                <p className="mt-2 text-[11.5px] text-slate-500" aria-live="polite">
                  {parseProgress}
                </p>
              )}
              {fileError && (
                <p className="mt-2 text-[12px] text-red-600" role="alert">
                  {fileError}
                </p>
              )}
            </div>

            {pdf ? (
              <fieldset>
                <legend className="mb-2 text-[13px] font-semibold text-slate-700">
                  ② 选择出题页段
                </legend>
                <div className="flex items-center gap-2">
                  <label htmlFor={startId} className="text-[12px] text-slate-500">
                    从第
                  </label>
                  <input
                    id={startId}
                    type="number"
                    min={1}
                    max={pdf.pageCount}
                    value={startPage}
                    onChange={(e) => setStartPage(Number(e.target.value))}
                    className="h-11 w-20 rounded-lg border border-[var(--line)] bg-white px-3 text-[15px] tabular-nums"
                  />
                  <span className="text-[12px] text-slate-500">页到第</span>
                  <input
                    id={endId}
                    type="number"
                    min={1}
                    max={pdf.pageCount}
                    value={endPage}
                    onChange={(e) => setEndPage(Number(e.target.value))}
                    className="h-11 w-20 rounded-lg border border-[var(--line)] bg-white px-3 text-[15px] tabular-nums"
                  />
                  <span className="text-[12px] text-slate-500">
                    页（共 {pdf.pageCount} 页）
                  </span>
                </div>
                {pageRange && (
                  <p className="mt-2 text-[11.5px] text-slate-500">
                    本次会使用第 {pageRange.start} 至 {pageRange.end} 页，共{" "}
                    {pageRange.end - pageRange.start + 1} 页
                  </p>
                )}
              </fieldset>
            ) : (
              <div>
                <label
                  htmlFor={textId}
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                >
                  ② 或直接粘贴知识点 / 课程大纲
                </label>
                <textarea
                  id={textId}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={7}
                  placeholder="例如：进程与线程的定义、区别、调度方式、上下文切换成本……"
                  className="w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-[16px] leading-relaxed text-slate-700 sm:text-[13.5px]"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor={titleId}
                className="mb-1.5 block text-[13px] font-semibold text-slate-700"
              >
                考试名称
              </label>
              <input
                id={titleId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="例如：操作系统期中复习"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-[16px] text-slate-700 sm:text-[13.5px]"
              />
            </div>

            <div>
              <label
                htmlFor={focusId}
                className="mb-1.5 block text-[13px] font-semibold text-slate-700"
              >
                命题重点（可选）
              </label>
              <input
                id={focusId}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={200}
                placeholder="例如：重点考进程调度和死锁，少考历史发展"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-[16px] text-slate-700 sm:text-[13.5px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={countId}
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                >
                  每套题量
                </label>
                <select
                  id={countId}
                  value={questionsPerPaper}
                  onChange={(e) => setQuestionsPerPaper(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[16px] text-slate-700 sm:text-[13.5px]"
                >
                  {[5, 8, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} 题
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={paperCountId}
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                >
                  试卷套数
                </label>
                <select
                  id={paperCountId}
                  value={paperCount}
                  onChange={(e) => setPaperCount(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[16px] text-slate-700 sm:text-[13.5px]"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} 套
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor={difficultyId}
                className="mb-1.5 block text-[13px] font-semibold text-slate-700"
              >
                难度
              </label>
              <select
                id={difficultyId}
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value) as ExamDifficulty)}
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[16px] text-slate-700 sm:text-[13.5px]"
              >
                <option value={1}>基础 · 概念识别</option>
                <option value={2}>标准 · 理解辨析</option>
                <option value={3}>挑战 · 综合迁移</option>
              </select>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[12px] leading-relaxed text-slate-500">
              预计请求 <strong className="text-slate-700">{totalQuestions}</strong> 道题，组装为{" "}
              <strong className="text-slate-700">{paperCount}</strong> 套试卷。每套最多 15 题且总题量不超过 30；
              模型返回的题量不足时会提示你调整，不会给出缺题的卷子。
            </div>

            <p className={`text-[11.5px] ${sourceReady ? "text-slate-400" : "text-amber-700"}`}>
              当前资料 {sourceLength} 字
              {sourceLength < 100 ? "，至少需要 100 字" : ""}
              {sourceLength > 60_000 ? "，超过上限，请缩小页码范围或粘贴内容" : ""}
            </p>

            <button
              type="button"
              onClick={submit}
              disabled={!canGenerate}
              className="btn-primary min-h-12 w-full px-5 py-3 text-[14px]"
            >
              {generating ? "正在分析资料并命题…" : "生成题库与多套试卷"}
            </button>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>

      {sets.length > 0 && (
        <section className="card p-5 sm:p-7">
          <h2 className="font-serif-zh text-[20px] font-semibold text-[var(--ink-deep)]">
            本机题库
          </h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            默认只保存在当前浏览器。清空浏览器数据会同时删除原文、题库和成绩。
          </p>
          <div className="mt-5 space-y-3">
            {sets.map((set) => (
              <article
                key={set.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14.5px] font-bold text-slate-800">
                      {set.title}
                    </h3>
                    <p className="mt-1 text-[11.5px] text-slate-500">
                      {set.questions.length} 题 · {set.papers.length} 套卷 ·{" "}
                      {set.attempts.length} 次作答 · {fmtUpdatedAt(set.updatedAt)} 更新
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`删除「${set.title}」及其全部作答记录？`)) {
                        onDeleteSet(set.id);
                      }
                    }}
                    className="rounded-lg px-2 py-1 text-[11.5px] text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {set.papers.map((paper) => {
                    const attempts = set.attempts.filter((a) => a.paperId === paper.id);
                    return (
                      <button
                        key={paper.id}
                        type="button"
                        onClick={() => onOpenPaper(set, paper)}
                        className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-left text-[12.5px] text-indigo-700 hover:border-indigo-300"
                      >
                        <span className="font-semibold">{paper.title.split("·").at(-1)?.trim()}</span>
                        <span className="ml-2 text-[11px] text-slate-400">
                          {paper.questionIds.length} 题
                          {attempts.length > 0
                            ? ` · 已完成 ${attempts.length} 次`
                            : " · 未作答"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
