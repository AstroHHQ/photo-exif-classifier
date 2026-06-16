/**
 * 首页 —— 摄影档案馆。
 *
 * 视觉节奏：
 * - Hero 区域（双栏）：左侧工具入口 + 摄影摘要，右侧 Dashboard 概览
 * - 筛选栏
 * - 照片瀑布流（主视觉焦点）
 *
 * 设计原则：照片 > 洞察 > 数据
 */

import UploadZone from "@/components/UploadZone";
import HeroInsights from "@/components/HeroInsights";
import DashboardOverview from "@/components/DashboardOverview";
import PhotoContainer from "@/components/PhotoContainer";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero 区域：双栏布局 */}
      <div className="flex gap-8 items-start">
        {/* 左侧：工具入口 + 摄影摘要 */}
        <div className="w-[35%] shrink-0 flex flex-col gap-5">
          <UploadZone showTargetSelector />
          <HeroInsights />
        </div>

        {/* 右侧：Dashboard 概览 */}
        <div className="flex-1 min-w-0">
          <DashboardOverview />
        </div>
      </div>

      {/* 筛选栏 + 瀑布流 + 弹窗 */}
      <PhotoContainer />
    </div>
  );
}
