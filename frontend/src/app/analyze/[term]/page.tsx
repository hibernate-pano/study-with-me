import { Suspense } from "react";
import AnalyzeView from "@/components/AnalyzeView";

/** 概念深挖页面：路由 /analyze/[term] → 共享分析视图（学习引擎概念源）。
 * Suspense 包裹：AnalyzeView 读 ?drill= 查询参数（useSearchParams）需要 CSR 边界。 */
export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeView />
    </Suspense>
  );
}