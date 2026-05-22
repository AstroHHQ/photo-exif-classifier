"use client";

/**
 * PhotoGrid —— 照片瀑布流。
 *
 * 用 CSS columns 实现瀑布流布局，无需额外 JS 计算。
 * 断点：移动端 1 列 → sm 2 列 → lg 3 列 → xl 4 列。
 */

import { useEffect, useState } from "react";
import PhotoCard, { type PhotoData } from "./PhotoCard";

export default function PhotoGrid() {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data: PhotoData[]) => setPhotos(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 加载中
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  // 空状态
  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">暂无照片，上传第一张吧</p>
      </div>
    );
  }

  // 瀑布流 — CSS columns 实现
  // columns-1 sm:columns-2 lg:columns-3 xl:columns-4
  return (
    <div className="w-full max-w-7xl mx-auto columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
