/**
 * 首页 —— 上传照片入口。
 *
 * 页面结构：
 * - 顶部引导文案 + 上传区
 * - PhotoContainer（统计 / 筛选 / 瀑布流 / 弹窗）
 */

import UploadZone from "@/components/UploadZone";
import PhotoContainer from "@/components/PhotoContainer";

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
      <UploadZone showTargetSelector />

      {/* 照片管理（统计 + 筛选 + 瀑布流 + 详情弹窗） */}
      <PhotoContainer />
    </div>
  );
}
