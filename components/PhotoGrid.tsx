"use client";

/**
 * PhotoGrid —— 照片瀑布流。
 *
 * CSS columns 布局。支持多选模式和批量操作（删除 + 加入摄影集）。
 */

import { useEffect, useState, useCallback } from "react";
import PhotoCard, { type PhotoData } from "./PhotoCard";

interface Props {
  photos?: PhotoData[];
  onPhotoClick?: (id: number) => void;
  showSortControls?: boolean;
  onMoveUp?: (photoId: number) => void;
  onMoveDown?: (photoId: number) => void;
  showCoverButton?: boolean;
  coverPhotoId?: number | null;
  onSetCover?: (photoId: number) => void;
  onDelete?: (photoId: number) => void;
  collections?: { id: number; title: string }[];
  onImportToCollection?: (photoId: number, collectionId: number) => void;
  /** 多选模式 */
  selectable?: boolean;
  /** 选中状态（受控） */
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  /** 批量删除回调 */
  onBatchDelete?: () => void;
  /** 批量操作标签（如"移出摄影集"） */
  batchActionLabel?: string;
  /** 批量加入摄影集 */
  onBatchAddToCollection?: (collectionId: number) => void;
  /** 可选摄影集列表（仅 draft / ready） */
  batchAddCollections?: { id: number; title: string }[];
}

export default function PhotoGrid({
  photos: externalPhotos, onPhotoClick,
  showSortControls, onMoveUp, onMoveDown,
  showCoverButton, coverPhotoId, onSetCover,
  onDelete, collections, onImportToCollection,
  selectable, selectedIds, onSelectionChange,
  onBatchDelete, batchActionLabel,
  onBatchAddToCollection, batchAddCollections,
}: Props) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(!externalPhotos);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchCollectionId, setBatchCollectionId] = useState<number | null>(null);

  useEffect(() => {
    if (externalPhotos) {
      setPhotos(externalPhotos);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data: PhotoData[]) => setPhotos(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [externalPhotos]);

  const toggleSelect = useCallback((id: number) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const selectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set(photos.map((p) => p.id)));
  };

  const deselectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">暂无照片，上传第一张吧</p>
      </div>
    );
  }

  const selectedCount = selectedIds?.size ?? 0;
  const allSelected = selectedCount === photos.length && photos.length > 0;

  return (
    <div>
      {/* 批量操作工具栏 */}
      {selectable && selectedCount > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-600">
              已选择 <span className="font-medium text-gray-800">{selectedCount}</span> 张
            </span>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {allSelected ? "取消全选" : "全选"}
            </button>

            {/* 批量加入摄影集 */}
            {onBatchAddToCollection && batchAddCollections && batchAddCollections.length > 0 && (
              showBatchImport ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={batchCollectionId ?? ""}
                    onChange={(e) => setBatchCollectionId(Number(e.target.value))}
                    className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600"
                  >
                    <option value="" disabled>选择摄影集</option>
                    {batchAddCollections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || "未命名摄影集"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (batchCollectionId != null) {
                        onBatchAddToCollection(batchCollectionId);
                        setShowBatchImport(false);
                        setBatchCollectionId(null);
                      }
                    }}
                    disabled={batchCollectionId == null}
                    className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => {
                      setShowBatchImport(false);
                      setBatchCollectionId(null);
                    }}
                    className="text-[10px] px-2 py-1 rounded text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBatchImport(true)}
                  className="text-[10px] px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  加入摄影集
                </button>
              )
            )}

            {onBatchDelete && (
              <button
                onClick={onBatchDelete}
                className="text-[10px] px-2.5 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {batchActionLabel || "删除选中照片"}
              </button>
            )}
            <button
              onClick={deselectAll}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors ml-auto"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 瀑布流 */}
      <div className="w-full max-w-7xl mx-auto columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onPhotoClick={() => onPhotoClick?.(photo.id)}
            showSortControls={showSortControls}
            isFirst={showSortControls && photos.indexOf(photo) === 0}
            isLast={showSortControls && photos.indexOf(photo) === photos.length - 1}
            onMoveUp={() => onMoveUp?.(photo.id)}
            onMoveDown={() => onMoveDown?.(photo.id)}
            showCoverButton={showCoverButton}
            onSetCover={() => onSetCover?.(photo.id)}
            isCover={coverPhotoId != null && coverPhotoId === photo.id}
            onDelete={onDelete ? () => onDelete(photo.id) : undefined}
            collections={collections}
            onImportToCollection={onImportToCollection}
            selectable={selectable}
            selected={selectedIds?.has(photo.id)}
            onToggleSelect={() => toggleSelect(photo.id)}
          />
        ))}
      </div>
    </div>
  );
}
