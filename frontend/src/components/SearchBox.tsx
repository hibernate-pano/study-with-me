"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Props {
  initial?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
  /** 受控模式：值变化时回调（命令面板需要） */
  onChange?: (v: string) => void;
  /** 回车时回调（命令面板里用它跳转到选中的项） */
  onEnter?: () => void;
  /** 自定义键盘回调：返回 true 表示已处理，SearchBox 不再响应默认行为 */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean | void;
}

const MAX_LEN = 300;

/**
 * 多行输入框：
 * - 单行/短文本 → 正常 textarea，单行显示；
 * - 长文本 / 粘贴 / 按回车 → 自动撑高；
 * - 回车提交，Shift+Enter 换行（textarea 常规约定）。
 */
export default function SearchBox({
  initial = "",
  size = "lg",
  autoFocus,
  onChange,
  onEnter,
  onKeyDown,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = () => {
    const term = value.trim();
    if (!term) return;
    router.push(`/analyze/${encodeURIComponent(term)}`);
  };

  const isLarge = size === "lg";
  const padding = isLarge ? "p-4 pl-7" : "p-1.5 pl-4";
  const iconSize = isLarge ? 30 : 18;

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`group flex items-start gap-2 rounded-2xl border border-[var(--line)] bg-white shadow-[0_10px_30px_-12px_rgba(30,40,90,0.18)] transition-all focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.15)] ${padding}`}
      >
        <svg
          className="shrink-0 text-slate-400 mt-2"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            const v = e.target.value.slice(0, MAX_LEN);
            setValue(v);
            onChange?.(v);
            // 自动撑高
            const el = taRef.current;
            if (el) {
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 200) + "px";
            }
          }}
          onKeyDown={(e) => {
            // 委托给外部（命令面板用）
            if (onKeyDown && onKeyDown(e)) return;
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (onEnter) onEnter();
              else submit();
            }
          }}
          placeholder={
            isLarge
              ? "输入一个概念、一段话或一个完整的学习问题…例如：分布式锁、十五规划、什么是Kafka、我在学分布式系统设计，遇到 RCU 这个词，能讲讲吗？"
              : "换个输入…"
          }
          autoFocus={autoFocus}
          rows={1}
          maxLength={MAX_LEN}
          className={`flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed scroll-thin ${
            isLarge
              ? "text-[21px] py-3.5 min-h-[72px]"
              : "text-[15px] py-1.5 min-h-[36px]"
          }`}
        />

        <div className="flex flex-col items-end gap-1.5 mt-1">
          <button
            type="submit"
            disabled={!value.trim()}
            className={`shrink-0 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isLarge ? "px-9 py-4 text-[17px]" : "px-4 py-2 text-sm"
            }`}
          >
            深挖
          </button>
          {isLarge && (
            <span className="text-[10.5px] text-slate-400 mr-1 select-none">
              {value.length}/{MAX_LEN}
            </span>
          )}
        </div>
      </form>

      {isLarge && (
        <p className="mt-2.5 text-center text-[11.5px] text-slate-400">
          Enter 提交 · Shift+Enter 换行 · 支持完整段落或问题
        </p>
      )}
    </div>
  );
}