"use client";

/**
 * PhotoCard —— 单张照片卡片。
 *
 * 照片优先：默认只展示照片本身（rounded-none，相纸感）。
 * hover 时底部浮现 metadata overlay + 右上角浮现操作图标。
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
  focal_length_35mm: number | null;
  iso: number | null;
  aperture: string | null;
  shutter_speed: string | null;
  note: string;
  storage_mode: "copied" | "referenced";
  collection_id?: number | null;
  sort_order: number | null;
  date_taken: string | null;
  created_at: string;
  file_size: number;
}

interface Props {
  photo: PhotoData;
  onPhotoClick?: () => void;
  showSortControls?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  showCoverButton?: boolean;
  onSetCover?: () => void;
  isCover?: boolean;
  onDelete?: () => void;
  collections?: { id: number; title: string }[];
  onImportToCollection?: (photoId: number, collectionId: number) => void;
  /** 多选模式 */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const imageUrl = getPhotoUrl(photo);

  const metaLine = [
    photo.camera_model || "未知相机",
    photo.focal_length,
    photo.aperture,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasHoverActions =
    (collections !== undefined && photo.collection_id == null) ||
    onDelete;

  return (
    <div
      onClick={onPhotoClick}
      className={`
        break-inside-avoid mb-8 group
        bg-white rounded-xl border border-gray-100
        shadow-sm hover:shadow-lg
        transition-all duration-200
        hover:-translate-y-0.5
        ${onPhotoClick ? "cursor-pointer" : ""}
      `}
    >
      {/* 照片区 */}
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
          className={`w-full block rounded-none transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* 多选 checkbox（左上角，始终可见） */}
        {selectable && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onToggleSelect}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected
                  ? "bg-gray-800 border-gray-800 text-white"
                  : "bg-white/70 border-gray-300 hover:border-gray-400"
              }`}
            >
              {selected && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* hover：底部 metadata overlay */}
        <div
          className="
            absolute inset-x-0 bottom-0
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            bg-gradient-to-t from-black/60 via-black/20 to-transparent
            pt-10 pb-3 px-3 pointer-events-none
          "
        >
          <span className="text-[11px] text-white/90 truncate block">
            {metaLine}
          </span>
          {photo.note && (
            <p className="text-[10px] text-white/70 truncate mt-0.5">
              {photo.note}
            </p>
          )}
        </div>

        {/* hover：右上角操作图标 */}
        {hasHoverActions && (
          <div
            className="
              absolute top-2 right-2 flex items-center gap-1.5
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
            "
          >
            {collections !== undefined &&
              photo.collection_id == null && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImport(true);
                  }}
                  className="w-6 h-6 rounded-full bg-black/40 text-white text-xs flex items-center justify-center hover:bg-black/60 transition-colors"
                  title="导入摄影集"
                >
                  +
                </button>
              )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                title="删除照片"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 导入摄影集展开（独立于 hover，始终可见状态） */}
      {collections !== undefined &&
        photo.collection_id == null &&
        showImport && (
          <div className="px-3 py-2.5 border-t border-gray-50">
            {collections.length === 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">暂无摄影集</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const res = await fetch("/api/collections", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: "未命名摄影集" }),
                      });
                      if (res.ok) {
                        const col = await res.json();
                        onImportToCollection?.(photo.id, col.id);
                        setShowImport(false);
                      }
                    } catch {
                      // silently fail
                    }
                  }}
                  className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors shrink-0"
                >
                  创建摄影集
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImport(false);
                  }}
                  className="text-[10px] px-2 py-1 rounded text-gray-400 hover:text-gray-500 transition-colors shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedCollectionId ?? ""}
                  onChange={(e) =>
                    setSelectedCollectionId(Number(e.target.value))
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 flex-1 min-w-0"
                >
                  <option value="" disabled>
                    选择摄影集
                  </option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || "未命名摄影集"}
                    </option>
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

      {/* 排序按钮（仅摄影集编辑模式，始终可见） */}
      {showSortControls && (
        <div className="flex items-center gap-1 px-3 py-2.5 border-t border-gray-50">
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
    </div>
  );
}
