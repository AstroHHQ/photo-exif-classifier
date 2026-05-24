"use client";

/**
 * PhotoGrid —— 照片瀑布流。
 *
 * 用 CSS columns 实现瀑布流布局，无需额外 JS 计算。
 * 断点：移动端 1 列 → sm 2 列 → lg 3 列 → xl 4 列。
 */

import { useEffect, useState } from "react";
import PhotoCard, { type PhotoData } from "./PhotoCard";

interface Props {
  /** 外部传入的照片列表（用于筛选场景），不传则自动从 API 获取 */
  photos?: PhotoData[];
  /** 点击照片回调 */
  onPhotoClick?: (id: number) => void;
  /** 排序控制（仅摄影集详情页使用） */
  showSortControls?: boolean;
  onMoveUp?: (photoId: number) => void;
  onMoveDown?: (photoId: number) => void;
  /** 封面设置（仅摄影集详情页使用） */
  showCoverButton?: boolean;
  coverPhotoId?: number | null;
  onSetCover?: (photoId: number) => void;
  /** 删除照片回调 */
  onDelete?: (photoId: number) => void;
  /** 可选摄影集列表（用于导入选择） */
  collections?: { id: number; title: string }[];
  /** 导入到摄影集回调 */
  onImportToCollection?: (photoId: number, collectionId: number) => void;
}

export default function PhotoGrid({ photos: externalPhotos, onPhotoClick, showSortControls, onMoveUp, onMoveDown, showCoverButton, coverPhotoId, onSetCover, onDelete, collections, onImportToCollection }: Props) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(!externalPhotos);

  useEffect(() => {
    // 如果外部传了照片，直接使用
    if (externalPhotos) {
      setPhotos(externalPhotos);
      setLoading(false);
      return;
    }
    // 否则从 API 获取
    setLoading(true);
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data: PhotoData[]) => setPhotos(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [externalPhotos]);

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
        />
      ))}
    </div>
  );
}
