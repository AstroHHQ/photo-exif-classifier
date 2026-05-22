/**
 * 首页 —— 上传照片入口。
 *
 * 页面结构：
 * - 顶部一行引导文案
 * - 中间是上传区域（拖拽 + 点击）
 *
 * 后续会在此页面加入照片瀑布流和分类侧边栏。
 */

import UploadZone from "@/components/UploadZone";
import PhotoGrid from "@/components/PhotoGrid";
import StatsPanel from "@/components/StatsPanel";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* 引导文案 */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
          导入照片
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          上传照片，自动读取 EXIF 信息并按镜头、焦距、相机分类
        </p>
      </div>

      {/* 上传区 */}
      <UploadZone />

      {/* EXIF 统计面板 */}
      <StatsPanel />

      {/* 照片瀑布流 */}
      <PhotoGrid />
    </div>
  );
}
