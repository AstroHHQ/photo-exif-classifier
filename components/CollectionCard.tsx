"use client";

/**
 * CollectionCard —— 摄影集卡片。
 *
 * draft 类型：多张照片堆叠效果，像"待整理素材"
 * curated 类型：封面图为主，像摄影书封面
 */

import type { PhotoData } from "./PhotoCard";

interface Props {
  id: number;
  title: string;
  status: "draft" | "curated";
  coverPhotoId: number | null;
  previewPhotos: PhotoData[];
  photoCount: number;
  onClick: () => void;
}

export default function CollectionCard({
  title,
  status,
  coverPhotoId,
  previewPhotos,
  photoCount,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      className="
        break-inside-avoid mb-6 cursor-pointer
        bg-white rounded-xl border border-gray-100
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        overflow-hidden
      "
    >
      {status === "draft" ? (
        /* ---- draft：堆叠照片效果 ---- */
        <div className="relative bg-gray-50 p-4 pb-2">
          {/* 无照片时占位 */}
          {previewPhotos.length === 0 && (
            <div className="aspect-[3/2] bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">暂无照片</span>
            </div>
          )}

          {/* 堆叠效果：最多展示 3 张，叠加偏移 */}
          <div className="relative aspect-[3/2]">
            {previewPhotos.slice(0, 3).map((photo, i) => (
              <img
                key={photo.id}
                src={`/api/photos/${photo.id}/file`}
                alt=""
                className={`
                  absolute inset-0 w-full h-full object-cover rounded-lg
                  border border-white/80 shadow-sm
                `}
                style={{
                  transform: `translate(${i * 6}px, ${i * 6}px)`,
                  zIndex: 3 - i,
                }}
              />
            ))}
            {/* 底部伪元素：暗示更多照片 */}
            {previewPhotos.length > 0 && (
              <div
                className="absolute inset-0 bg-gray-200 rounded-lg"
                style={{
                  transform: `translate(${Math.min(previewPhotos.length, 3) * 6}px, ${Math.min(previewPhotos.length, 3) * 6}px)`,
                  zIndex: 0,
                }}
              />
            )}
          </div>
        </div>
      ) : (
        /* ---- curated：封面图 ---- */
        <div className="relative bg-gray-50">
          {coverPhotoId ? (
            <img
              src={`/api/photos/${coverPhotoId}/file`}
              alt={title}
              className="w-full aspect-[4/3] object-cover"
            />
          ) : previewPhotos.length > 0 ? (
            <img
              src={`/api/photos/${previewPhotos[0].id}/file`}
              alt={title}
              className="w-full aspect-[4/3] object-cover"
            />
          ) : (
            <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
              <span className="text-xs text-gray-400">暂无封面</span>
            </div>
          )}
        </div>
      )}

      {/* 底部信息 */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-800 truncate">
            {title || "未命名摄影集"}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {photoCount} 张照片
          </p>
        </div>
        <span
          className={`
            text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2
            ${status === "draft" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}
          `}
        >
          {status === "draft" ? "待整理" : "已整理"}
        </span>
      </div>
    </div>
  );
}
