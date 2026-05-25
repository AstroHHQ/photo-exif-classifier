/**
 * 首页 —— 摄影工作台。
 *
 * 视觉节奏：
 * - 第一层：上传工具栏（左）+ 摄影档案统计（右）
 * - 第二层：筛选栏
 * - 第三层：照片瀑布流（主视觉焦点）
 */

import UploadZone from "@/components/UploadZone";
import StatsPanel from "@/components/StatsPanel";
import PhotoContainer from "@/components/PhotoContainer";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      {/* 第一层：上传工具栏 + 摄影档案统计 */}
      <div className="flex gap-8 items-start">
        <div className="w-64 shrink-0">
          <UploadZone showTargetSelector />
        </div>
        <div className="flex-1 min-w-0">
          <StatsPanel />
        </div>
      </div>

      {/* 第二层：筛选栏 + 第三层：瀑布流 + 弹窗 */}
      <PhotoContainer />
    </div>
  );
}
