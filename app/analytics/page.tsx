/**
 * 统计分析页 —— /analytics
 *
 * 完整的摄影档案 Dashboard。
 * 包含：Activity、Camera Usage、Lens Usage、
 * Language Distribution、Language Evolution、Photography Insights。
 *
 * 首页只保留精简概览，详细统计全部在此页面。
 */

import StatsPanel from "@/components/StatsPanel";
import PhotographyInsights from "@/components/PhotographyInsights";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* 页面标题 */}
      <div>
        <a
          href="/"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← 返回首页
        </a>
        <h2 className="text-xl font-semibold text-gray-800 mt-2">统计分析</h2>
        <p className="text-xs text-gray-400 mt-1">
          全库摄影档案 · 数据来源：所有照片（含摄影集）
        </p>
      </div>

      {/* 完整统计面板 */}
      <StatsPanel />

      {/* 摄影习惯分析 */}
      <PhotographyInsights />
    </div>
  );
}
