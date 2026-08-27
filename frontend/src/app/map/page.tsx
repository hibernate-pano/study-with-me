"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import { getAllReports } from "@/lib/storage";
import type { StoredReport } from "@/lib/storage";

/** 🗺 我的知识网络 —— 焦点模式：地图全屏、可缩放可拖拽。 */
export default function MapPage() {
  const router = useRouter();
  const [reports, setReports] = useState<StoredReport[] | null>(null);

  useEffect(() => {
    getAllReports()
      .then((rs) => setReports(rs))
      .catch(() => setReports([]));
  }, []);

  const isEmpty = reports !== null && reports.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回首页"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            首页
          </button>
          <div className="text-[14px] font-bold text-slate-800">🗺 我的知识网络</div>
          <div className="flex-1" />
          <button
            onClick={() => router.push("/review")}
            className="text-[12.5px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            复习 →
          </button>
        </div>
      </header>

      {/* 主体：地图占满剩余高度 */}
      <main className="relative flex-1">
        {reports === null ? (
          <div className="absolute inset-0 grid place-items-center text-slate-400 text-[13px]">
            正在读取本地知识库…
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center max-w-sm">
              <div className="text-[34px]">🗺️</div>
              <div className="mt-3 text-[15px] font-bold text-slate-700">
                地图还是空的
              </div>
              <p className="mx-auto mt-2 max-w-sm text-[13px] text-slate-500 leading-relaxed">
                去深挖几个概念，每个报告里的「🌐 知识网络」会自动连成一张属于你的概念地图。
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-[13.5px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                去学第一个概念 →
              </button>
            </div>
          </div>
        ) : (
          <MapView reports={reports} className="absolute inset-0" />
        )}
      </main>
    </div>
  );
}