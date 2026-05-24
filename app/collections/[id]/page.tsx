"use client";

/**
 * 摄影集详情页 —— /collections/[id]
 *
 * 展示摄影集标题、状态、照片数量，以及照片瀑布流。
 * 点击照片打开 PhotoModal（复用现有弹窗 + 备注功能）。
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoModal from "@/components/PhotoModal";
import type { PhotoData } from "@/components/PhotoCard";

interface CollectionDetail {
  id: number;
  title: string;
  description: string;
  status: "draft" | "curated";
  cover_photo_id: number | null;
  photos: PhotoData[];
}

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);

  // 获取摄影集详情（含照片列表）
  useEffect(() => {
    setLoading(true);
    fetch(`/api/collections/${id}`)
      .then((res) => res.json())
      .then((data: CollectionDetail) => {
        setCollection(data);
        setPhotos(data.photos || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // 当前选中的照片
  const selectedPhoto = useMemo(
    () => photos.find((p) => p.id === selectedPhotoId) || null,
    [photos, selectedPhotoId]
  );

  const currentIndex = selectedPhotoId
    ? photos.findIndex((p) => p.id === selectedPhotoId)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedPhotoId(photos[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setSelectedPhotoId(photos[currentIndex + 1].id);
    }
  };

  // 移动照片排序
  const handleMove = useCallback(
    async (photoId: number, direction: "up" | "down") => {
      try {
        const res = await fetch(`/api/photos/${photoId}/move`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectionId: parseInt(id),
            direction,
          }),
        });
        const data = await res.json();
        if (data.photos) setPhotos(data.photos);
      } catch (err) {
        console.error("排序失败:", err);
      }
    },
    [id]
  );

  // 更新备注（乐观更新 + PATCH API）
  const handleNoteChange = useCallback(
    async (photoId: number, note: string) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, note } : p))
      );
      try {
        await fetch(`/api/photos/${photoId}/note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
      } catch (err) {
        console.error("备注保存失败:", err);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">摄影集不存在</p>
      </div>
    );
  }

  return (
    <div>
      {/* 摄影集信息 */}
      <div className="mb-6">
        <a
          href="/collections"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← 返回摄影集列表
        </a>
        <div className="flex items-center gap-3 mt-2">
          <h2 className="text-xl font-semibold text-gray-800">
            {collection.title || "未命名摄影集"}
          </h2>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              collection.status === "draft"
                ? "bg-amber-50 text-amber-600"
                : "bg-green-50 text-green-600"
            }`}
          >
            {collection.status === "draft" ? "待整理" : "已整理"}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {photos.length} 张照片
        </p>
      </div>

      {/* 照片瀑布流 */}
      {photos.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-gray-400">摄影集中暂无照片</p>
          <p className="text-xs text-gray-300 mt-1">
            在首页上传时选择此摄影集即可添加照片
          </p>
        </div>
      ) : (
        <PhotoGrid
          photos={photos}
          onPhotoClick={(photoId) => setSelectedPhotoId(photoId)}
          showSortControls
          onMoveUp={(photoId) => handleMove(photoId, "up")}
          onMoveDown={(photoId) => handleMove(photoId, "down")}
        />
      )}

      {/* 照片详情弹窗 */}
      {selectedPhotoId && selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          photos={photos}
          onClose={() => setSelectedPhotoId(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          onNoteChange={handleNoteChange}
        />
      )}
    </div>
  );
}
