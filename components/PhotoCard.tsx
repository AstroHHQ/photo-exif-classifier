"use client";

/**
 * PhotoCard —— 单张照片卡片。
 *
 * 展示缩略图和底部简要 EXIF：
 * - 左侧：相机型号
 * - 右侧：焦距 · 光圈
 * - 悬停时阴影加深
 *
 * 通过 getPhotoUrl() 统一获取照片 URL（兼容 copied / referenced 模式）。
 */

import { useState } from "react";
import { getPhotoUrl } from "@/lib/file";

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
  storage_mode: "copied" | "referenced";
  collection_id?: number | null;
  sort_order: number | null;
  date_taken: string | null;
  file_size: number;
}

interface Props {
  photo: PhotoData;
  /** 点击整张卡片时回调 */
  onPhotoClick?: () => void;
  /** 显示排序按钮（仅在摄影集详情页使用） */
  showSortControls?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** 显示"设为封面"按钮（仅在摄影集详情页使用） */
  showCoverButton?: boolean;
  onSetCover?: () => void;
  isCover?: boolean;
  /** 删除照片回调 */
  onDelete?: () => void;
  /** 可选摄影集列表（用于导入选择，仅未归档照片显示） */
  collections?: { id: number; title: string }[];
  /** 导入到摄影集回调 */
  onImportToCollection?: (photoId: number, collectionId: number) => void;
}

export default function PhotoCard({
  photo,
  onPhotoClick,
  showSortControls,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  showCoverButton,
  onSetCover,
  isCover,
  onDelete,
  collections,
  onImportToCollection,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const imageUrl = getPhotoUrl(photo);

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

      {/* 排序按钮（仅摄影集内显示） */}
      {showSortControls && (
        <div className="flex items-center gap-1 px-3 pb-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={isFirst}
            className="text-[10px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            title="上移"
          >
            ↑ 上移
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={isLast}
            className="text-[10px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            title="下移"
          >
            ↓ 下移
          </button>
          {showCoverButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetCover?.();
              }}
              disabled={isCover}
              className="text-[10px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors ml-auto"
              title="设为封面"
            >
              {isCover ? "✓ 封面" : "设为封面"}
            </button>
          )}
        </div>
      )}

      {/* 导入摄影集（仅未归档照片 + 首页使用场景时显示） */}
      {collections !== undefined && photo.collection_id == null && (
        <div className="px-3 pb-2.5">
          {collections.length === 0 ? (
            <span className="text-[10px] text-gray-300">暂无可编辑摄影集</span>
          ) : !showImport ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowImport(true);
              }}
              className="text-[10px] px-2 py-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              导入摄影集
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedCollectionId ?? ""}
                onChange={(e) => setSelectedCollectionId(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 flex-1 min-w-0"
              >
                <option value="" disabled>选择摄影集</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title || "未命名摄影集"}</option>
                ))}
              </select>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedCollectionId != null) {
                    onImportToCollection?.(photo.id, selectedCollectionId);
                    setShowImport(false);
                    setSelectedCollectionId(null);
                  }
                }}
                disabled={selectedCollectionId == null}
                className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-default transition-colors shrink-0"
              >
                确认
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImport(false);
                  setSelectedCollectionId(null);
                }}
                className="text-[10px] px-2 py-1 rounded text-gray-400 hover:text-gray-500 transition-colors shrink-0"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}

      {/* 删除按钮 */}
      {onDelete && (
        <div className="px-3 pb-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-[10px] px-2 py-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="删除照片"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}
