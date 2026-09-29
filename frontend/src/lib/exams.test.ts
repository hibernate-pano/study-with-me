import { describe, expect, it } from "vitest";
import {
  assembleExamPapers,
  gradeExamAttempt,
  parseQuestionBank,
  wrongQuestionIds,
  type ExamQuestion,
} from "./exams";

const validBankJson = `\`\`\`json
{
  "title": "分布式系统期末题库",
  "knowledgePoints": ["一致性", "共识算法"],
  "questions": [
    {
      "type": "single_choice",
      "stem": "Raft 中哪种机制用于选举领导者？",
      "options": ["随机超时", "两阶段提交", "布隆过滤器", "LRU"],
      "answerIndex": 0,
      "explanation": "Raft 使用随机化选举超时降低选票分裂概率。",
      "knowledgePoint": "共识算法",
      "difficulty": 1,
      "sourcePage": 12
    },
    {
      "type": "short_answer",
      "stem": "简述 CAP 定理的核心取舍。",
      "answer": "网络分区发生时，一致性和可用性不能同时完全保证。",
      "keyPoints": ["网络分区", "一致性", "可用性"],
      "explanation": "CAP 的取舍只在分区发生时有实际意义。",
      "knowledgePoint": "一致性",
      "difficulty": 2,
      "sourcePage": 18
    }
  ]
}
\`\`\``;

describe("parseQuestionBank", () => {
  it("解析代码围栏中的结构化题库", () => {
    const bank = parseQuestionBank(validBankJson);
    expect(bank.title).toBe("分布式系统期末题库");
    expect(bank.knowledgePoints).toEqual(["一致性", "共识算法"]);
    expect(bank.questions).toHaveLength(2);
    expect(bank.questions[0]).toMatchObject({
      type: "single_choice",
      answer: ["0"],
      sourcePage: 12,
    });
    expect(bank.questions[1]).toMatchObject({
      type: "short_answer",
      keyPoints: ["网络分区", "一致性", "可用性"],
    });
  });

  it("跳过没有有效答案的题目", () => {
    const raw = JSON.stringify({
      title: "坏题库",
      knowledgePoints: [],
      questions: [
        { type: "single_choice", stem: "没有正确答案", options: ["A", "B"] },
        {
          type: "short_answer",
          stem: "有效题",
          answer: "参考答案",
        },
      ],
    });
    const bank = parseQuestionBank(raw);
    expect(bank.questions).toHaveLength(1);
    expect(bank.questions[0].stem).toBe("有效题");
  });

  it("题库没有任何有效题目时抛错", () => {
    expect(() =>
      parseQuestionBank(JSON.stringify({ title: "空", questions: [] }))
    ).toThrow("没有可用题目");
  });
});

describe("assembleExamPapers", () => {
  const questions: ExamQuestion[] = Array.from({ length: 8 }, (_, i) => ({
    id: `q${i}`,
    type: "single_choice",
    stem: `题目 ${i}`,
    options: ["A", "B"],
    answer: ["0"],
    keyPoints: [],
    explanation: "解析",
    knowledgePoint: `知识点${i % 2}`,
    difficulty: 1,
  }));

  it("题量充足时，每套卷的题目互不重复", () => {
    const papers = assembleExamPapers(
      { title: "测试题库", knowledgePoints: ["A", "B"], questions },
      { countPerPaper: 3, paperCount: 2, seed: 42 }
    );
    expect(papers).toHaveLength(2);
    const a = new Set(papers[0].questionIds);
    const b = new Set(papers[1].questionIds);
    expect(a.size).toBe(3);
    expect(b.size).toBe(3);
    expect([...a].some((id) => b.has(id))).toBe(false);
  });

  it("同一个 seed 生成稳定顺序", () => {
    const first = assembleExamPapers(
      { title: "测试题库", knowledgePoints: [], questions },
      { countPerPaper: 4, paperCount: 2, seed: 7 }
    );
    const second = assembleExamPapers(
      { title: "测试题库", knowledgePoints: [], questions },
      { countPerPaper: 4, paperCount: 2, seed: 7 }
    );
    expect(first).toEqual(second);
  });

  it("任意 seed 下多套卷都不重题（回归：曾经每套各洗一次牌）", () => {
    const bank = { title: "测试题库", knowledgePoints: [], questions };
    for (let seed = 1; seed <= 300; seed++) {
      const papers = assembleExamPapers(bank, {
        countPerPaper: 3,
        paperCount: 2,
        seed,
      });
      const seen = new Set<string>();
      for (const paper of papers) {
        expect(paper.questionIds).toHaveLength(3);
        for (const id of paper.questionIds) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    }
  });
});

describe("gradeExamAttempt", () => {
  const questions: ExamQuestion[] = [
    {
      id: "q1",
      type: "single_choice",
      stem: "选择题",
      options: ["A", "B", "C"],
      answer: ["1"],
      keyPoints: [],
      explanation: "",
      knowledgePoint: "K1",
      difficulty: 1,
    },
    {
      id: "q2",
      type: "short_answer",
      stem: "简答题",
      options: [],
      answer: ["参考答案"],
      keyPoints: ["要点一", "要点二"],
      explanation: "",
      knowledgePoint: "K2",
      difficulty: 2,
    },
  ];
  const paper = {
    id: "p1",
    title: "试卷 A",
    questionIds: ["q1", "q2"],
    durationMinutes: 20,
    createdAt: 0,
  };

  it("客观题自动判分，简答题按自评计入总成绩", () => {
    const attempt = gradeExamAttempt({
      questions,
      paper,
      answers: { q1: ["1"], q2: ["网络分区时只能二选一"] },
      selfGrades: { q2: "partial" },
      startedAt: 100,
      now: 200,
    });
    expect(attempt.score).toBe(1.5);
    expect(attempt.maxScore).toBe(2);
    expect(attempt.results.q1.correct).toBe(true);
    expect(attempt.results.q2.result).toBe("partial");
  });

  it("简答题未自评时不计分", () => {
    const attempt = gradeExamAttempt({
      questions,
      paper,
      answers: { q1: ["0"], q2: ["回答"] },
      startedAt: 100,
      now: 200,
    });
    expect(attempt.score).toBe(0);
    expect(attempt.results.q2.result).toBe("ungraded");
  });
});

describe("wrongQuestionIds", () => {
  const attempt = {
    id: "a1",
    paperId: "p1",
    answers: {},
    selfGrades: {},
    startedAt: 0,
    submittedAt: 0,
    score: 0,
    maxScore: 3,
    results: {
      q1: { correct: false, result: "wrong" as const, earned: 0 },
      q2: { correct: false, result: "partial" as const, earned: 0.5 },
      q3: { correct: false, result: "ungraded" as const, earned: 0 },
      q4: { correct: true, result: "correct" as const, earned: 1 },
    },
  };

  it("只收已确认答错的题，未自评（状态未知）不算错题", () => {
    expect(wrongQuestionIds(attempt)).toEqual(["q1", "q2"]);
  });
});
