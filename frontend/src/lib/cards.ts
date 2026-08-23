/** 复习卡片：把报告「🔍 深入追问」模块的自测题变成间隔重复复习卡片。
 * 纯函数部分（解析 + 调度）与存储解耦，便于测试。
 */

export interface QuizItem {
  question: string;
  answer: string;
}

export type CardStatus = "new" | "learning" | "reviewing";

export interface Card {
  key: string;
  term: string; // 所属概念
  question: string;
  answer: string;
  dueAt: number; // 下次复习时间（毫秒时间戳）
  intervalDays: number; // 当前间隔（天），新卡为 0
  reps: number; // 已成功复习次数
  status: CardStatus;
  createdAt: number;
  updatedAt: number;
}

/** 简单稳定 hash（djb2），用于生成卡片 key，避免存长字符串 */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 从「深入追问」区块的 markdown 里解析出自测题列表。
 * LLM 输出格式不固定（编号列表 / 加粗 Q / 无序列表 / 纯段落），按特征行容错切分。
 * - 一个条目开始：- * • 列表、数字列表、**加粗**、以？结尾
 * - 条目首行（去装饰）为问题，其余行为提示/答案
 * - 若整块都没有条目特征，整块兜底为一张卡
 */
export function parseQuizSection(md: string): QuizItem[] {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^#+\s/.test(l)); // 防御：过滤误入的标题行
  const items: QuizItem[] = [];
  let cur: { q: string[]; a: string[] } | null = null;

  const isStarter = (line: string): boolean =>
    /^[-*•]\s+/.test(line) || /^\d+[.)、]\s*/.test(line) || line.startsWith("**");

  const pushItem = () => {
    if (!cur) return;
    const q = cleanQuestion(cur.q.join(" "));
    const a = cur.a.join("\n").trim();
    if (q) items.push({ question: q, answer: a });
    cur = null;
  };

  for (const line of lines) {
    if (isStarter(line)) {
      pushItem();
      cur = { q: [line], a: [] };
    } else if (cur) {
      // 多行问题：答案区还空着且该行以问号结尾 → 并入问题；否则算答案
      if (cur.a.length === 0 && /[?？]\s*$/.test(line)) {
        cur.q.push(line);
      } else {
        cur.a.push(line);
      }
    } else {
      // 没有特征行的散落正文：当它是一条独立问题（兜底）
      cur = { q: [line], a: [] };
    }
  }
  pushItem();

  if (items.length === 0 && md.trim()) {
    // 完全无法切分：整块一张卡
    const first = lines[0] ?? "";
    const rest = lines.slice(1).join("\n").trim();
    items.push({
      question: cleanQuestion(first),
      answer: rest,
    });
  }

  // 过滤空问题
  return items.filter((i) => i.question.length > 0);
}

function cleanQuestion(s: string): string {
  return s
    .replace(/^\s*[-*•]\s+/, "") // 列表前缀（- / * / •）
    .replace(/^\s*\d+[.)、]\s*/, "") // 数字前缀
    .replace(/^\*{1,2}\s*(.+?)\s*\*{1,2}\s*[:：]?\s*/, "$1") // **标题** 成对剥除（含可选冒号）
    .replace(/^\*{1,2}/, "") // 残留开头星号
    .replace(/\*{1,2}\s*$/, "") // 残留末尾星号
    .replace(/^(问题|题目|提问)\s*\d*[:：]?\s*/, "") // 问题 3： / 问题：
    .replace(/^Q\d*\s*[:：]?\s*/i, "") // Q1： / Q：
    .trim();
}

/**
 * 简化 SM-2 调度：
 * - 忘了 → 明天再来（间隔重置 1 天）
 * - 记住了 → 间隔翻倍，1→2→4→…→30 天封顶
 */
export function nextCard(card: Card, remember: boolean): Card {
  const now = Date.now();
  if (!remember) {
    return {
      ...card,
      intervalDays: 1,
      reps: 0,
      status: "learning",
      dueAt: now + DAY_MS,
      updatedAt: now,
    };
  }
  const next = Math.min(card.intervalDays <= 0 ? 1 : card.intervalDays * 2, 30);
  return {
    ...card,
    intervalDays: next,
    reps: card.reps + 1,
    status: "reviewing",
    dueAt: now + next * DAY_MS,
    updatedAt: now,
  };
}

/** 新卡：立即可复习。 */
export function newCard(term: string, q: QuizItem, now = Date.now()): Card {
  return {
    key: `${term}::${hashString(q.question)}`,
    term,
    question: q.question,
    answer: q.answer,
    dueAt: now,
    intervalDays: 0,
    reps: 0,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
}

/** 卡片文案：比如 "2天后" / "已学 3 次" */
export function fmtCardInfo(card: Card): string {
  if (card.reps === 0) return "新卡";
  return `已学 ${card.reps} 次 · 间隔 ${card.intervalDays} 天`;
}