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
import BookViewer from "@/components/BookViewer";
import type { PhotoData } from "@/components/PhotoCard";

type CollectionStatus = "draft" | "ready" | "published";

interface CollectionDetail {
  id: number;
  title: string;
  description: string;
  status: CollectionStatus;
  cover_photo_id: number | null;
  version: number;
  book_ratio: string;
  photos: PhotoData[];
}

/** 摄影书比例预设 */
const RATIO_OPTIONS = [
  { value: "4:5", label: "4:5 竖版" },
  { value: "1:1", label: "1:1 方形" },
  { value: "3:2", label: "3:2 横版" },
  { value: "2:3", label: "2:3 长竖版" },
] as const;

/** 状态标签映射 */
const STATUS_LABEL: Record<CollectionStatus, string> = {
  draft: "待整理",
  ready: "可发布",
  published: "已发布",
};

const STATUS_CLASS: Record<CollectionStatus, string> = {
  draft: "bg-amber-50 text-amber-600",
  ready: "bg-blue-50 text-blue-600",
  published: "bg-green-50 text-green-600",
};

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  // 获取摄影集详情（含照片列表）
  const fetchCollection = useCallback(() => {
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

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // 切换状态
  const handleChangeStatus = async (newStatus: CollectionStatus) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      setCollection((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err) {
      console.error("状态切换失败:", err);
    } finally {
      setUpdating(false);
    }
  };

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

  // 切换摄影书比例
  const handleChangeRatio = async (bookRatio: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_ratio: bookRatio }),
      });
      const data = await res.json();
      setCollection((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err) {
      console.error("比例切换失败:", err);
    } finally {
      setUpdating(false);
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

  // 设置封面
  const handleSetCover = useCallback(
    async (photoId: number) => {
      setCollection((prev) =>
        prev ? { ...prev, cover_photo_id: photoId } : prev
      );
      try {
        await fetch(`/api/collections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cover_photo_id: photoId }),
        });
      } catch (err) {
        console.error("封面设置失败:", err);
      }
    },
    [id]
  );

  // 删除照片
  const handleDelete = useCallback(
    async (photoId: number) => {
      if (!window.confirm("确认删除这张照片？")) return;
      try {
        await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setCollection((prev) =>
          prev && prev.cover_photo_id === photoId
            ? { ...prev, cover_photo_id: null }
            : prev
        );
      } catch (err) {
        console.error("删除失败:", err);
      }
    },
    [id]
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
            className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLASS[collection.status]}`}
          >
            {STATUS_LABEL[collection.status]}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {photos.length} 张照片
        </p>

        {/* 摄影书比例选择（ready 状态可设置） */}
        {collection.status === "ready" && (
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[10px] text-gray-400 shrink-0">比例</span>
            {RATIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleChangeRatio(opt.value)}
                disabled={updating}
                className={`text-[10px] px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                  collection.book_ratio === opt.value
                    ? "bg-gray-800 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* 状态切换按钮 */}
        <div className="flex items-center gap-2 mt-3">
          {collection.status === "draft" && (
            <button
              onClick={() => handleChangeStatus("ready")}
              disabled={updating}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              标记为已整理完成
            </button>
          )}
          {collection.status === "ready" && (
            <>
              <button
                onClick={() => handleChangeStatus("published")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                发布
              </button>
              <button
                onClick={() => handleChangeStatus("draft")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                退回整理
              </button>
            </>
          )}
          {collection.status === "published" && (
            <>
              <button
                onClick={() => handleChangeStatus("ready")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                重新编辑
              </button>
              <button
                onClick={() => handleChangeStatus("draft")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                取消发布
              </button>
            </>
          )}
        </div>
      </div>

      {/* published 下无照片时 */}
      {collection.status === "published" && photos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm text-gray-400">摄影集中暂无照片</p>
        </div>
      )}

      {/* published：阅读模式（全屏：工具栏 + BookViewer） */}
      {collection.status === "published" && photos.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          {/* 工具栏 */}
          <div className="flex items-center px-6 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <a
                href="/collections"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                ← 返回摄影集列表
              </a>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 shrink-0">
                已发布
              </span>
              <span className="text-[10px] text-gray-400 shrink-0">v{collection.version}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <a
                href={`/api/collections/${id}/export`}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                导出 PDF
              </a>
              <button
                onClick={() => handleChangeStatus("ready")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                重新编辑
              </button>
              <button
                onClick={() => handleChangeStatus("draft")}
                disabled={updating}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                取消发布
              </button>
            </div>
          </div>
          {/* 阅读器 */}
          <div className="flex-1 min-h-0">
            <BookViewer
              photos={photos}
              title={collection.title}
              version={collection.version}
              bookRatio={collection.book_ratio}
            />
          </div>
        </div>
      )}

      {/* draft / ready：完整编辑视图 */}
      {collection.status !== "published" && (
        <>
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
              showCoverButton
              coverPhotoId={collection.cover_photo_id}
              onSetCover={handleSetCover}
              onDelete={handleDelete}
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
        </>
      )}
    </div>
  );
}
