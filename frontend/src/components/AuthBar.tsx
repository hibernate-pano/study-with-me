"use client";

import { useEffect, useRef, useState } from "react";
import { initCloudSync, logoutUser, onAuthChange, onSyncStateChange, type SyncStatus } from "@/lib/sync";
import { githubAuthUrl } from "@/lib/cloud";

/**
 * 右上角登录栏：全局可见。
 * - 未登录：GitHub 登录按钮（整页跳 OAuth）；
 * - 已登录：GitHub 用户名 + 同步状态，点击展开登出；
 * - 探测中：不渲染（避免闪动）。
 */
export default function AuthBar() {
  const [user, setUser] = useState<{ login: string; avatar_url: string | null } | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ status: "ok", lastAt: null });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const off = onAuthChange(setUser);

    // 回调失败提示（/api/auth/callback 失败时以 ?auth=xxx 跳回首页）
    const url = new URL(window.location.href);
    const authParam = url.searchParams.get("auth");
    if (authParam) {
      const map: Record<string, string> = {
        denied: "已取消 GitHub 授权",
        state: "安全校验失败，请重试",
        error: "登录失败，请重试",
        failed: "登录失败，请重试",
      };
      setNotice(map[authParam] ?? "登录失败，请重试");
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.toString());
    }

    initCloudSync().then((r) => {
      setUser(r.user);
      setReady(true);
    });
    const offSync = onSyncStateChange(setSync);
    return () => {
      off();
      offSync();
    };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!ready) return null;

  return (
    <div className="fixed right-4 top-4 z-50">
      {notice && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-700">
          {notice}
        </div>
      )}

      {user ? (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/90 px-3.5 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            title={user.login}
          >
            <span className="max-w-[100px] truncate text-[12.5px] font-medium text-slate-700">
              {user.login}
            </span>
          </button>

          {open && (
            <div className="absolute right-0 mt-1.5 w-48 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-lg">
              <div className="border-b border-[var(--line)] px-3.5 py-2.5 text-[11.5px] text-slate-500">
                已登录 · 知识库自动同步
                <div className={`mt-1 flex items-center gap-1 text-[11px] ${sync.status === "error" ? "text-red-500" : "text-emerald-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sync.status === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
                  {sync.status === "error"
                    ? sync.message ?? "同步失败（数据已暂存，将自动重试）"
                    : sync.lastAt
                    ? `已同步 ${new Date(sync.lastAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                    : "同步中…"}
                </div>
              </div>
              <button
                onClick={() =>
                  logoutUser().then(() => {
                    setOpen(false);
                    location.reload();
                  })
                }
                className="w-full px-3.5 py-2 text-left text-[12.5px] text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                登出
              </button>
            </div>
          )}
        </div>
      ) : (
        <a
          href={githubAuthUrl()}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          登录 GitHub
        </a>
      )}
    </div>
  );
}