import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ReviewPage from "./page";
import { newCard, type Card } from "@/lib/cards";

/**
 * 复习页组件行为测试（dom project）：
 * lib/storage 是 IndexedDB 依赖，mock 掉；next/navigation 的 router 同理。
 * 重点验证三档评分按钮把正确的调度结果写回存储。
 */

const putCardMock = vi.fn(async (c: Card) => c);
const deleteCardMock = vi.fn(async (_key: string) => {});
const pushMock = vi.fn();

let dueQueue: Card[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...mod,
    getAllCards: vi.fn(async () => dueQueue),
    getDueCards: vi.fn(async () => dueQueue),
    putCard: (c: Card) => putCardMock(c),
    deleteCard: (key: string) => deleteCardMock(key),
  };
});

const card = newCard(
  "分布式锁",
  { question: "什么是互斥锁？", answer: "同一时刻只允许一个执行流进入临界区" },
  Date.now()
);

async function renderWithDue() {
  dueQueue = [card];
  render(<ReviewPage />);
  await screen.findByText("什么是互斥锁？");
  // 翻面
  fireEvent.click(screen.getByText(/显示答案/));
  await screen.findByText("同一时刻只允许一个执行流进入临界区");
}

describe("复习页三档评分", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染问题、答案与三个评分按钮", async () => {
    await renderWithDue();
    expect(screen.getByRole("button", { name: /忘了/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /模糊/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /记住了/ })).toBeTruthy();
  });

  it("点「记住了」→ 新卡间隔 1 天、reps+1、reviewing", async () => {
    await renderWithDue();
    fireEvent.click(screen.getByRole("button", { name: /记住了/ }));
    await waitFor(() => expect(putCardMock).toHaveBeenCalledTimes(1));
    const saved = putCardMock.mock.calls[0][0];
    expect(saved.intervalDays).toBe(1);
    expect(saved.reps).toBe(1);
    expect(saved.status).toBe("reviewing");
  });

  it("点「忘了」→ 间隔重置 1 天、次数清零", async () => {
    await renderWithDue();
    fireEvent.click(screen.getByRole("button", { name: /忘了/ }));
    await waitFor(() => expect(putCardMock).toHaveBeenCalledTimes(1));
    const saved = putCardMock.mock.calls[0][0];
    expect(saved.intervalDays).toBe(1);
    expect(saved.reps).toBe(0);
    expect(saved.status).toBe("learning");
  });

  it("点「模糊」→ 至少 +1 天的温和推进", async () => {
    dueQueue = [{ ...card, intervalDays: 2, reps: 1 }];
    render(<ReviewPage />);
    await screen.findByText("什么是互斥锁？");
    fireEvent.click(screen.getByText(/显示答案/));
    fireEvent.click(screen.getByRole("button", { name: /模糊/ }));
    await waitFor(() => expect(putCardMock).toHaveBeenCalledTimes(1));
    const saved = putCardMock.mock.calls[0][0];
    expect(saved.intervalDays).toBe(3); // max(2+1, round(2*1.2))
    expect(saved.reps).toBe(2);
  });

  it("卡头回链跳 cardReportHref 计算出的地址", async () => {
    dueQueue = [{ ...card, reportKey: "drill:并发编程::分布式锁" }];
    render(<ReviewPage />);
    await screen.findByText("什么是互斥锁？");
    fireEvent.click(screen.getByTitle("回到这份报告"));
    expect(pushMock).toHaveBeenCalledWith(
      `/analyze/${encodeURIComponent("并发编程")}?drill=${encodeURIComponent("分布式锁")}`
    );
  });
});
