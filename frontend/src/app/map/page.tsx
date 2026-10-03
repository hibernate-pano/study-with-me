"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import { getAllReports } from "@/lib/storage";
import type { StoredReport } from "@/lib/storage";
import { IconArrowRight, IconNetwork } from "@/components/icons";

/** 我的知识网络 —— 焦点模式：地图全屏、可缩放可拖拽。 */
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
    <div className="flex min-h-screen flex-col">
      <header className="topbar">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-ink-100 lg:hidden"
            title="返回首页"
          >
            <IconArrowRight size={16} className="rotate-180" />
            首页
          </button>
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-ink-800">
            <IconNetwork size={15} className="text-ink-500" />
            我的知识网络
          </div>
          <div className="flex-1" />
          <button
            onClick={() => router.push("/review")}
            className="flex items-center gap-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink-800 cursor-pointer"
          >
            复习
            <IconArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* 主体：地图占满剩余高度 */}
      <main className="relative flex-1">
        {reports === null ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-ink-faint">
            正在读取本地知识库…
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="card lift max-w-sm p-10 text-center">
              <div className="mb-3 flex justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
                  <IconNetwork size={22} />
                </span>
              </div>
              <div className="text-[15px] font-bold text-ink-800">地图还是空的</div>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                去深挖几个概念，每个报告里的「知识网络」会自动连成一张属于你的概念地图。
              </p>
              <button
                onClick={() => router.push("/")}
                className="btn-primary mx-auto mt-6 px-5 py-2.5 text-[13.5px]"
              >
                去学第一个概念
                <IconArrowRight size={14} />
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
