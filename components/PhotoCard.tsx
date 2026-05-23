"use client";

/**
 * PhotoCard —— 单张照片卡片。
 *
 * 展示缩略图和底部简要 EXIF：
 * - 左侧：相机型号
 * - 右侧：焦距 · 光圈
 * - 悬停时阴影加深
 *
 * 通过 /api/photos/[id]/file 加载照片文件。
 */

import { useState } from "react";

/** 照片数据类型（来自 API） */
export interface PhotoData {
  id: number;
  filename: string;
  original_name: string;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  iso: number | null;
  aperture: string | null;
  shutter_speed: string | null;
  note: string;
  date_taken: string | null;
  file_size: number;
}

interface Props {
  photo: PhotoData;
  /** 点击整张卡片时回调 */
  onPhotoClick?: () => void;
}

export default function PhotoCard({ photo, onPhotoClick }: Props) {
  const [loaded, setLoaded] = useState(false);
  const imageUrl = `/api/photos/${photo.id}/file`;

  return (
    <div
      onClick={onPhotoClick}
      className={`
        break-inside-avoid mb-6
        bg-white rounded-xl border border-gray-100
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        overflow-hidden
        ${onPhotoClick ? "cursor-pointer" : ""}
      `}
    >
      {/* 缩略图区 */}
      <div className="relative bg-gray-50">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={imageUrl}
          alt={photo.original_name}
          onLoad={() => setLoaded(true)}
          className={`w-full block transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* 底部 EXIF 信息 */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-gray-600 truncate max-w-[60%]">
          {photo.camera_model || "未知相机"}
        </span>
        <span className="text-xs text-gray-400 shrink-0">
          {[photo.focal_length, photo.aperture].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>

      {/* 备注预览 */}
      {photo.note && (
        <p className="text-[10px] text-gray-500 truncate px-3 pb-2 leading-tight">
          {photo.note}
        </p>
      )}
    </div>
  );
}
