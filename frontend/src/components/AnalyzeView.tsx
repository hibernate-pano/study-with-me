"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import SectionCard from "@/components/SectionCard";
import DrillDownDrawer from "@/components/DrillDownDrawer";
import { sectionMeta } from "@/components/sectionMeta";
import {
  IconArrowRight,
  IconArrowUp,
  IconCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconFolderOpen,
  IconMic,
  IconPause,
  IconRefresh,
  IconReview,
  IconScale,
  IconWarn,
  IconWidth,
  IconWidthWide,
} from "@/components/icons";
import { talkshowChallengeUrl } from "@/lib/talkshow";
import {
  parseSections,
  extractSectionRaw,
  hasStreamError,
  stripStreamMarkers,
  STREAM_DONE_MARKER,
  STREAM_TRUNCATED_MARKER,
  type Section,
} from "@/lib/stream";
import { parseNetworkMarkdown, flattenGroups, type FlatConcept } from "@/lib/network";
import {
  saveReport,
  getReport,
  getAllReports,
  getDueCards,
  mainKey,
  drillKey,
  syncCardsFromReport,
  deleteReport,
  deleteTermCards,
  markTalkshowDone,
  isTalkshowDone,
  type StoredReport,
} from "@/lib/storage";
import { readShareHash } from "@/lib/share";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function recordRecent(term: string) {
  try {
    const raw = localStorage.getItem("cd-recent");
    const list = raw ? JSON.parse(raw) : [];
    const next = [term, ...list.filter((t: string) => t !== term)].slice(0, 8);
    localStorage.setItem("cd-recent", JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export default function AnalyzeView() {
  const params = useParams<{ term?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const term = params.term ? decodeURIComponent(params.term) : "";
  // ?drill=子概念 → 直达深挖报告（复习卡回链入口）；此时展示概念为子概念，
  // storageKey 用 drill key。知识网络/对比等操作围绕当前展示概念进行。
  const drill = searchParams.get("drill") ?? "";
  const concept = drill || term;
  const storageKey = drill ? drillKey(term, concept) : mainKey(term);

  // 全文（markdown）与解析后的区块
  const [fullText, setFullText] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState("");
  // 停止态：用户主动中断生成（区别于真错误的红色失败卡片）
  const [stopped, setStopped] = useState(false);
  // 已开讲挑战（费曼输出环回写标记）
  const [talkshowDone, setTalkshowDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [drillConcept, setDrillConcept] = useState<FlatConcept | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [wide, setWide] = useState(false); // 宽屏模式（隐藏侧栏、主列加宽）

  // 数据来源提示：本地存档 | 全新生成
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // 侧栏「我的存档」
  const [archive, setArchive] = useState<StoredReport[]>([]);
  // 待复习卡数（header 入口徽标）
  const [dueCount, setDueCount] = useState(0);

  const bufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genIdRef = useRef(0);
  // 挂载 effect 闭包外的「当前 term」：异步回调回来时用它判断自己是否已过期
  const termRef = useRef(term);
  termRef.current = term;

  /** 把当前缓冲渲染到页面（限频调用） */
  const flush = useCallback(() => {
    const text = bufferRef.current;
    if (text === fullTextRef.current) return;
    fullTextRef.current = text;
    setFullText(text);
    setSections(parseSections(text));
  }, []);
  const fullTextRef = useRef("");

  /** 更新 header 的待复习数徽标 */
  const refreshDueCount = useCallback(() => {
    getDueCards()
      .then((cs) => setDueCount(cs.length))
      .catch(() => setDueCount(0));
  }, []);

  /** 生成完成后写入 IndexedDB（成为个人知识库的一页） */
  const persist = useCallback(
    (text: string) => {
      if (!text) return;
      // 入库前剥掉流式协议标记（<!-- DONE --> 等），否则会随全文进 IndexedDB / 云端
      const clean = stripStreamMarkers(text);
      if (!clean) return;
      const groups = parseNetworkMarkdown(extractSectionRaw(clean, "知识网络"));
      saveReport({
        key: storageKey,
        term: concept,
        fullText: clean,
        related: flattenGroups(groups),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
        .then(() => setCachedAt(Date.now()))
        .catch((err: unknown) => {
          // 隐私模式 / IndexedDB 挂起等场景：静默失败会让用户刚生成的报告凭空消失且零报错
          console.error("[analyze] saveReport failed:", err);
        });
      // 自测题 → 复习卡（幂等：只新增从未见过的题）
      syncCardsFromReport(concept, clean)
        .then(() => refreshDueCount())
        .catch(() => {});
    },
    [concept, storageKey, refreshDueCount]
  );

  // 进入页面先取一次待复习数
  useEffect(() => {
    refreshDueCount();
  }, [refreshDueCount]);

  /** 发起流式请求 */
  const start = useCallback(
    async () => {
      const myGen = ++genIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      bufferRef.current = "";
      fullTextRef.current = "";

      setFullText("");
      setSections([]);
      setStreaming(true);
      setError("");
      setStopped(false);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `请求失败（${res.status}）`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) msg = data.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("空响应");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        timerRef.current = setInterval(flush, 120);

        while (true) {
          const { done, value } = await reader.read();
          // 每轮自检：被新请求取代后立刻退出，别再往共享 bufferRef 里写（A 的收尾也不会清掉 B 的定时器）
          if (myGen !== genIdRef.current) return;
          if (done) break;
          bufferRef.current += decoder.decode(value, { stream: true });
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (myGen !== genIdRef.current) return; // 已被新请求取代
        if (hasStreamError(bufferRef.current)) {
          throw new Error("生成过程中连接中断，残缺内容未存入知识库");
        }
        // 先判后剥：只有服务端明确收尾（DONE）才允许入库，
        // 截断/中断的残缺报告会静默污染缓存，用户下次打开直接命中半截内容
        if (!bufferRef.current.includes(STREAM_DONE_MARKER)) {
          throw new Error(
            bufferRef.current.includes(STREAM_TRUNCATED_MARKER)
              ? "输出被上游截断，报告不完整，请重新生成"
              : "连接提前结束，残缺内容未入库"
          );
        }
        setStreaming(false);
        flush(); // 最终刷新

        // 只有完成（非停止、非报错）的文本才入库
        persist(bufferRef.current);
      } catch (err: unknown) {
        // 守卫放在最前：已被新请求取代时连定时器都不许碰（否则会清掉新请求的 flush 定时器）
        if (myGen !== genIdRef.current) return;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const aborted =
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError";
        if (aborted) {
          // 用户主动停止：渲染已生成的部分，落入 amber 中性卡片（不进红色失败态）
          flush();
          setStopped(true);
        } else {
          setError(
            err instanceof Error ? err.message : "生成失败，请重试"
          );
        }
        setStreaming(false);
      }
    },
    [term, flush, persist]
  );

  // 首次进入：分享链接 > 本地存档 > 发起生成
  useEffect(() => {
    // 存活守卫：effect 重跑（换 term）或组件卸载后，异步回调一律不得再 setState / 发起生成
    let alive = true;
    const myTerm = term;

    setStopped(false);
    setTalkshowDone(isTalkshowDone(concept));
    recordRecent(concept);

    // 1) 旧分享链接（#report=）兼容：正常展示报告，不再提示"只读"
    const shared = readShareHash();
    if (shared) {
      // 分享 hash 里同样可能夹带 <!-- DONE --> 等流式标记：展示与惰性入库前都要剥掉，
      // 否则会在报告末尾露出一行 <!-- DONE -->。
      const clean = stripStreamMarkers(shared);
      fullTextRef.current = clean;
      setFullText(clean);
      setSections(parseSections(clean));
      setStreaming(false);
      refreshArchive(term);
      return () => {
        alive = false;
      };
    }

    // 2) 本地存档优先（wiki 化：打开即读，不重复烧 token）
    getReport(storageKey)
      .then((r) => {
        if (!alive) return;
        if (r && r.fullText) {
          setCachedAt(r.updatedAt);
          fullTextRef.current = r.fullText;
          setFullText(r.fullText);
          setSections(parseSections(r.fullText));
          setStreaming(false);
          // 缓存报告也同步一次复习卡（幂等）
          syncCardsFromReport(concept, r.fullText, storageKey)
            .then(() => refreshDueCount())
            .catch(() => {});
        } else if (drill) {
          // 深挖回链但本机无此报告（云同步时序差 / 已删档）：
          // 退回展示主报告而不是发起生成——/api/analyze 不带 parentTerm 会生成主概念报告，
          // 存成 mainKey 会跟当前 drill 标题错位。
          getReport(mainKey(term))
            .then((main) => {
              if (!alive) return;
              if (main && main.fullText) {
                fullTextRef.current = main.fullText;
                setFullText(main.fullText);
                setSections(parseSections(main.fullText));
              }
              setStreaming(false);
            })
            .catch(() => {
              if (alive) setStreaming(false);
            });
        } else {
          if (myTerm !== termRef.current) return; // 期间已切到别的词，别给旧词烧 token
          start();
        }
      })
      .catch(() => {
        if (!alive) return;
        if (myTerm !== termRef.current) return;
        start();
      });

    refreshArchive(term);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, storageKey]);

  // 卸载 / 切换 term 时终止在途请求
  useEffect(() => {
    return () => {
      // cleanup 时递增 genIdRef，让在途请求的回调自检过期。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      genIdRef.current++;
      abortRef.current?.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [term]);

  /** 刷新侧栏「我的存档」（最近更新的主报告） */
  const refreshArchive = useCallback((current: string) => {
    getAllReports()
      .then((rs) => {
        // 只展示主报告（非深挖、非对比），按更新时间倒序，最多 8 条
        const mains = rs
          .filter((r) => !r.key.startsWith("drill:") && !r.key.startsWith("compare:"))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 8);
        setArchive(
          mains.filter((r) => r.term !== current)
        );
      })
      .catch(() => setArchive([]));
  }, []);

  // term 变化时重置滚动跟随状态：开新报告默认跟随到最新
  useEffect(() => {
    setStickToBottom(true);
  }, [term]);

  /** 新区块出现时，若用户还在底部则自动滚动跟随 */
  useEffect(() => {
    if (sections.length === 0) return;
    const last = sections[sections.length - 1];
    const el = document.getElementById(last.id);
    if (el && streaming && stickToBottom) {
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      if (top > vh * 0.85) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [sections, streaming, stickToBottom]);

  /** 跟踪用户是否在底部（用来决定是否跟随滚动） */
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distanceToBottom =
          document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
        setStickToBottom(distanceToBottom < 120);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const regenerate = () => {
    abortRef.current?.abort();
    start();
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(
        `# ${concept}\n\n${fullTextRef.current || fullText}`
      );
      setCopied(true);
      // 「已复制全文」可见 1.6s 后再收起菜单（立即关闭会让反馈永远看不见）
      setTimeout(() => {
        setCopied(false);
        setMoreOpen(false);
      }, 1600);
    } catch {
      /* ignore */
    }
  };

  /** 丢弃停止时已生成的部分内容 */
  const discardStopped = () => {
    bufferRef.current = "";
    fullTextRef.current = "";
    setFullText("");
    setSections([]);
    setStopped(false);
  };

  /** 去 Topic Talkshow 开讲：跳转时本地标记该概念已开讲 */
  const startTalkshow = () => {
    markTalkshowDone(concept);
    setTalkshowDone(true);
  };

  const exportMd = () => {
    const text = fullTextRef.current || fullText;
    if (!text) return;
    const md = `# ${concept}\n\n${text}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${concept.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const headings = sections.filter((s) => s.id !== "sec-intro");

  return (
    <div className="min-h-screen">
      {/* 顶部操作栏 */}
      <header className="topbar relative">
        <div className={`mx-auto flex flex-wrap items-center gap-2 px-5 py-2.5 ${wide ? "max-w-[88rem]" : "max-w-7xl"}`}>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-[var(--bg-soft)] cursor-pointer lg:hidden"
            title="返回首页"
          >
            <IconArrowRight size={14} className="rotate-180" />
            首页
          </button>

          <div className="flex-1 max-w-md ml-1">
            <SearchBox initial={concept} size="md" />
          </div>

          <div className="h-5 w-px bg-[var(--line)] mx-1" />

          {/* 主要动作（生成类）—— 窄屏也保留 */}
          {streaming ? (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--st-warn-line)] bg-[var(--st-warn-bg)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--st-warn)] transition-colors hover:brightness-[0.97] cursor-pointer"
              title="停止生成"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-warn)] animate-pulse" />
              生成中 · 点此停止
            </button>
          ) : (
            <button
              onClick={regenerate}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-ink-50 cursor-pointer"
              title="重新生成"
            >
              <IconRefresh size={13} />
              重新生成
            </button>
          )}

          <div className="hidden h-5 w-px bg-[var(--line)] mx-1 md:block" />

          {/* 次要动作（图标-only + 文字）—— ≤md 收进 ⋯ 菜单 */}
          <button
            onClick={() => router.push(`/compare?a=${encodeURIComponent(concept)}`)}
            disabled={streaming}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-[var(--bg-soft)] disabled:opacity-40 cursor-pointer md:flex"
            title="和另一个概念做对比"
          >
            <IconScale size={13} />
            对比
          </button>

          <a
            href={talkshowChallengeUrl(term)}
            target="_blank"
            rel="noopener"
            onClick={startTalkshow}
            aria-disabled={streaming}
            className={`hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
              streaming
                ? "pointer-events-none opacity-40 text-ink-faint"
                : "text-ink-soft hover:bg-[var(--bg-soft)]"
            }`}
            title="去 Topic Talkshow 用这个词开一场限时讲解（新标签）"
          >
            <IconMic size={13} />
            开讲挑战
          </a>

          <button
            onClick={() => router.push("/review")}
            className="relative hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-[var(--bg-soft)] cursor-pointer md:flex"
            title="间隔重复复习"
          >
            <IconReview size={13} />
            复习
            {dueCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--st-warn)] px-1 mono text-[9.5px] font-bold text-white ring-2 ring-[var(--bg)]">
                {dueCount > 9 ? "9+" : dueCount}
              </span>
            )}
          </button>

          {/* 宽屏切换 */}
          <button
            onClick={() => setWide((v) => !v)}
            className={`hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
              wide
                ? "bg-ink-50 text-ink-700"
                : "text-ink-soft hover:bg-[var(--bg-soft)]"
            }`}
            title={wide ? "切回标准宽度（显示侧栏）" : "切到宽屏（隐藏侧栏，列加宽）"}
          >
            {wide ? <IconWidthWide size={13} /> : <IconWidth size={13} />}
            {wide ? "宽屏" : "标准"}
          </button>

          {/* 文件操作（图标菜单） */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="btn-icon"
              title="更多操作"
              aria-label="更多操作"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-lg fade-in">
                  {/* 次要动作（≤md 时顶栏放不下，收在这里；宽屏在顶栏直接可见） */}
                  <button
                    onClick={() => { setMoreOpen(false); router.push(`/compare?a=${encodeURIComponent(concept)}`); }}
                    disabled={streaming}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-[var(--bg-soft)] disabled:opacity-40 cursor-pointer md:hidden"
                  >
                    <IconScale size={14} />
                    对比
                  </button>
                  <a
                    href={talkshowChallengeUrl(term)}
                    target="_blank"
                    rel="noopener"
                    onClick={() => { startTalkshow(); setMoreOpen(false); }}
                    aria-disabled={streaming}
                    className={`md:hidden flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-soft)] cursor-pointer ${
                      streaming ? "pointer-events-none opacity-40 text-ink-faint" : "text-ink-700"
                    }`}
                  >
                    <IconMic size={14} />
                    开讲挑战
                  </a>
                  <button
                    onClick={() => { setMoreOpen(false); router.push("/review"); }}
                    className="relative flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-[var(--bg-soft)] cursor-pointer md:hidden"
                  >
                    <IconReview size={14} />
                    复习
                    {dueCount > 0 && (
                      <span className="ml-auto rounded-full bg-[var(--st-warn)] px-1.5 mono text-[10px] font-bold text-white">
                        {dueCount > 9 ? "9+" : dueCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setWide((v) => !v)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-[var(--bg-soft)] cursor-pointer md:hidden"
                  >
                    <IconWidth size={14} />
                    {wide ? "标准宽度" : "宽屏模式"}
                  </button>
                  <div className="my-1 h-px bg-[var(--line-soft)] md:hidden" />
                  <button
                    onClick={() => { exportMd(); setMoreOpen(false); }}
                    disabled={streaming || !fullText}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-[var(--bg-soft)] disabled:opacity-40 cursor-pointer"
                  >
                    <IconDownload size={14} />
                    导出 Markdown
                  </button>
                  <button
                    onClick={() => { void copyAll(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-[var(--bg-soft)] cursor-pointer"
                  >
                    <IconCopy size={14} />
                    {copied ? "已复制全文" : "复制全文"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* 生成中：贴底边扫光的进度线 */}
        {streaming && <div aria-hidden className="stream-line absolute inset-x-0 -bottom-px" />}
      </header>

      <main className={`mx-auto flex gap-7 px-5 py-8 ${wide ? "max-w-[88rem]" : "max-w-7xl"}`}>
        {/* 正文列 */}
        <div className="min-w-0 flex-1">
          {/* 词条标题：serif 大引语 */}
          <div className="mb-5">
            <h1 className="break-words font-disp text-[32px] font-bold leading-[1.1] tracking-[-0.025em] text-ink-950 md:text-[42px]">
              {concept}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {streaming ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-[12px] font-medium text-ink-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-pulse" />
                  AI 正在深挖…
                </span>
              ) : error ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-[12px] font-medium text-red-500">
                  生成失败
                </span>
              ) : stopped ? (
                <span className="state-chip state-warn">
                  <IconPause size={11} />
                  已停止
                </span>
              ) : (
                <span className="state-chip state-ok">
                  <IconCheck size={11} />
                  深挖完成
                </span>
              )}
              {talkshowDone && !streaming && (
                <span className="state-chip state-info" title="已在 Topic Talkshow 完成这个词的限时讲解">
                  <IconMic size={11} />
                  已开讲挑战
                </span>
              )}
              {cachedAt && !streaming && (
                <span className="text-[11.5px] text-slate-500">
                  本地存档 · {fmtTime(cachedAt)} 更新
                </span>
              )}
            </div>
          </div>

          {/* 数据来源提示 */}
          {!streaming && !error && fullText && cachedAt && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--st-info-line)] bg-[var(--st-info-bg)]/70 px-4 py-2.5 text-[13px] text-[var(--st-info)]">
              <IconFolderOpen size={14} />
              <span>
                已加载本地存档（更新于 {fmtTime(cachedAt)}）。「重新生成」可覆盖更新。
              </span>
            </div>
          )}

          {/* 停止态卡片（amber 中性；红色失败态只留给真错误） */}
          {stopped && !streaming && !error && (
            <div className="mb-5 rounded-2xl border border-[var(--st-warn-line)] bg-[var(--st-warn-bg)] px-5 py-4">
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--st-warn)]">
                <IconPause size={14} />
                已停止生成
              </div>
              <div className="mt-1 text-[13px] text-[var(--st-warn)]/90">
                已生成 {sections.length} 个模块 · 继续可补全报告，丢弃则不存档。
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={regenerate}
                  className="rounded-lg border border-[var(--st-warn-line)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--st-warn)] transition-colors hover:brightness-[0.97] cursor-pointer"
                >
                  继续生成
                </button>
                <button
                  onClick={discardStopped}
                  className="btn-ghost px-3.5 py-1.5 text-[13px]"
                >
                  丢弃
                </button>
              </div>
            </div>
          )}

          {/* 错误提示卡片 */}
          {error && !streaming && (
            <div className="mb-5 rounded-2xl border border-[var(--st-err-line)] bg-[var(--st-err-bg)] px-5 py-4" role="alert">
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--st-err)]">
                <IconWarn size={15} />
                报告生成失败
              </div>
              <div className="mt-1 text-[13px] text-[var(--st-err)]/90">{error}</div>
              <button
                onClick={regenerate}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--st-err-line)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--st-err)] transition-colors hover:brightness-[0.97] cursor-pointer"
              >
                <IconRefresh size={13} />
                重试
              </button>
            </div>
          )}

          {/* 等待首个字符时的骨架 */}
          {sections.length === 0 && streaming && !error && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 space-y-3">
              <div className="shimmer h-5 w-1/3" />
              <div className="shimmer h-4 w-full" />
              <div className="shimmer h-4 w-11/12" />
              <div className="shimmer h-4 w-3/4" />
              <div className="shimmer h-4 w-2/3" />
            </div>
          )}

          {/* 区块列表 */}
          <div className={`space-y-4 ${wide ? "max-w-[68rem]" : ""}`}>
            {sections.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                streaming={streaming}
                active={i === sections.length - 1}
                collapsed={!!collapsed[s.id]}
                onToggle={() => toggle(s.id)}
                onConceptDrillDown={setDrillConcept}
              />
            ))}
          </div>

          {/* 完成后追加操作 */}
          {!streaming && !error && fullText && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="btn-ghost px-5 py-2.5 text-[13.5px]"
              >
                <IconArrowUp size={14} />
                回到顶部
              </button>
              <button
                onClick={regenerate}
                className="btn-primary px-5 py-2.5 text-[13.5px]"
              >
                <IconRefresh size={14} />
                同词重新生成
              </button>
              <button
                onClick={() => router.push("/")}
                className="btn-ghost px-5 py-2.5 text-[13.5px]"
              >
                换个词
              </button>
            </div>
          )}
        </div>

        {/* 侧栏 */}
        <aside className={`${wide ? "hidden" : "hidden lg:block"} w-56 shrink-0`}>
          {/* 我的存档 */}
          {archive.length > 0 && (
            <div className="card mb-4 p-4">
              <div className="label mb-3">我的存档</div>
              <nav className="space-y-1">
                {archive.map((r) => (
                  <div
                    key={r.key}
                    className="group flex items-center rounded-lg hover:bg-ink-50"
                  >
                    <button
                      onClick={() => router.push(`/analyze/${encodeURIComponent(r.term)}`)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors group-hover:text-ink-900 cursor-pointer"
                      title={r.term}
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink-50 text-[10.5px] font-semibold text-ink-500">
                        {r.term.slice(0, 1)}
                      </span>
                      <span className="truncate">{r.term}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`删除「${r.term}」及其复习卡？（本地 + 云端同步删除）`)) return;
                        void deleteReport(r.key);
                        void deleteTermCards(r.term);
                        refreshArchive(term);
                      }}
                      className="mr-1 shrink-0 rounded-md p-1 text-ink-300 opacity-0 transition-opacity hover:text-[var(--st-err)] group-hover:opacity-100 cursor-pointer"
                      title="删除此概念"
                      aria-label="删除此概念"
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* 报告目录 */}
          {headings.length > 1 && (
            <div className="card p-4">
              <div className="label mb-3">报告目录</div>
              <nav className="space-y-1">
                {headings.map((s) => {
                  const active = streaming && s === sections[sections.length - 1];
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-ink-50 text-ink-600 font-medium"
                          : "text-ink-soft hover:bg-ink-50 hover:text-ink-800"
                      }`}
                    >
                      <span className="shrink-0 text-ink-400">
                        {sectionMeta(s.title, 13).icon}
                      </span>
                      <span className="truncate">{sectionMeta(s.title, 13).label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>
      </main>

      {/* 深挖抽屉 */}
      <DrillDownDrawer
        concept={drillConcept}
        parentTerm={concept}
        onClose={() => {
          setDrillConcept(null);
          refreshArchive(term);
        }}
        onCardsSynced={refreshDueCount}
      />
    </div>
  );
}
