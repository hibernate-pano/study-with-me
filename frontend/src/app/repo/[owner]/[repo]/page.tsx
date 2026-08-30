"use client";

import { useParams } from "next/navigation";
import RepoView from "@/components/RepoView";

/**
 * repo 学习模式入口：/repo/[owner]/[repo]。
 * 独立的解析管线（/api/repo → 项目地图 JSON）与独立的展示形态（RepoView 探索器），
 * 与概念深挖（/analyze）互不复用。
 */
export default function RepoPage() {
  const params = useParams<{ owner: string; repo: string }>();
  return <RepoView owner={decodeURIComponent(params.owner)} repo={decodeURIComponent(params.repo)} />;
}
