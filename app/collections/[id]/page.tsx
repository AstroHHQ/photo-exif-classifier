"use client";

/**
 * 摄影集详情页 —— /collections/[id]
 *
 * 展示摄影集标题、状态、照片数量，以及照片瀑布流。
 * 点击照片打开 PhotoModal（复用现有弹窗 + 备注功能）。
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoModal from "@/components/PhotoModal";
import BookViewer from "@/components/BookViewer";
import type { PhotoData } from "@/components/PhotoCard";

type CollectionStatus = "draft" | "ready" | "published";

interface ChapterData {
  id: number;
  collection_id: number;
  title: string;
  sort_order: number;
}

interface CollectionDetail {
  id: number;
  title: string;
  description: string;
  status: CollectionStatus;
  cover_photo_id: number | null;
  version: number;
  book_ratio: string;
  photos: PhotoData[];
  chapters?: ChapterData[];
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [focusChapterId, setFocusChapterId] = useState<number | null>(null);
  const [highlightChapterId, setHighlightChapterId] = useState<number | null>(null);
  const chapterClickTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const router = useRouter();

  // 获取摄影集详情（含照片列表）
  const fetchCollection = useCallback(() => {
    setLoading(true);
    fetch(`/api/collections/${id}`)
      .then((res) => res.json())
      .then((data: CollectionDetail) => {
        setCollection(data);
        setPhotos(data.photos || []);
        setChapters(data.chapters || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // 保存标题
  const handleSaveTitle = useCallback(async () => {
    const newTitle = titleDraft.trim();
    if (!newTitle) {
      setEditingTitle(false);
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      setCollection((prev) => (prev ? { ...prev, title: data.title } : prev));
    } catch (err) {
      console.error("标题保存失败:", err);
    } finally {
      setUpdating(false);
      setEditingTitle(false);
    }
  }, [id, titleDraft]);

  // 删除摄影集
  const handleDeleteCollection = useCallback(async () => {
    if (!window.confirm(
      "删除此摄影集？\n\n摄影集内照片不会被删除。\n所有照片将返回首页瀑布流。\n已导出的 PDF / Markdown 文件不会受到影响。\n\n此操作不可撤销。"
    )) return;
    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      router.push("/collections");
    } catch (err) {
      console.error("删除摄影集失败:", err);
    }
  }, [id, router]);

  // 新增章节
  const handleAddChapter = useCallback(async () => {
    const title = chapterTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`/api/collections/${id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const chapter: ChapterData = await res.json();
      setChapters((prev) => [...prev, chapter]);
      setChapterTitle("");
      setShowAddChapter(false);
    } catch (err) {
      console.error("新增章节失败:", err);
    }
  }, [id, chapterTitle]);

  // 删除章节
  const handleDeleteChapter = useCallback(async (chapterId: number) => {
    try {
      await fetch(`/api/collections/${id}/chapters?id=${chapterId}`, { method: "DELETE" });
      setChapters((prev) => prev.filter((c) => c.id !== chapterId));
    } catch (err) {
      console.error("删除章节失败:", err);
    }
  }, [id]);

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

  // 章节照片计数（sort_order 区间统计）
  const chapterPhotoCounts = useMemo(() => {
    const sorted = [...chapters].sort((a, b) => a.sort_order - b.sort_order);
    const counts = new Map<number, number>();
    for (let i = 0; i < sorted.length; i++) {
      const ch = sorted[i];
      const nextSort = i + 1 < sorted.length ? sorted[i + 1].sort_order : Infinity;
      const count = photos.filter(
        (p) => p.sort_order != null && p.sort_order >= ch.sort_order && p.sort_order < nextSort
      ).length;
      counts.set(ch.id, count);
    }
    return counts;
  }, [chapters, photos]);

  // Focus Mode：过滤照片
  const displayedPhotos = useMemo(() => {
    if (focusChapterId == null) return photos;
    const sorted = [...chapters].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === focusChapterId);
    if (idx === -1) return photos;
    const ch = sorted[idx];
    const nextSort = idx + 1 < sorted.length ? sorted[idx + 1].sort_order : Infinity;
    return photos.filter(
      (p) => p.sort_order != null && p.sort_order >= ch.sort_order && p.sort_order < nextSort
    );
  }, [photos, chapters, focusChapterId]);

  // 章节导航点击
  const handleChapterNavClick = useCallback((chapterId: number | null) => {
    // "全部" → 退出 focus
    if (chapterId === null) {
      setFocusChapterId(null);
      setHighlightChapterId(null);
      chapterClickTimers.current.forEach((t) => clearTimeout(t));
      chapterClickTimers.current.clear();
      return;
    }

    // 已在 focus 某章节 → 切换到新章节
    if (focusChapterId != null) {
      setFocusChapterId(chapterId);
      return;
    }

    // 非 focus 模式：双击检测
    const existingTimer = chapterClickTimers.current.get(chapterId);
    if (existingTimer) {
      // 第二次点击 → 进入 focus mode
      clearTimeout(existingTimer);
      chapterClickTimers.current.delete(chapterId);
      setFocusChapterId(chapterId);
      setHighlightChapterId(null);
    } else {
      // 第一次点击 → 高亮 2 秒
      setHighlightChapterId(chapterId);
      const timer = setTimeout(() => {
        setHighlightChapterId(null);
        chapterClickTimers.current.delete(chapterId);
      }, 2000);
      chapterClickTimers.current.set(chapterId, timer);
    }
  }, [focusChapterId]);

  // 当前选中的照片
  const selectedPhoto = useMemo(
    () => photos.find((p) => p.id === selectedPhotoId) || null,
    [photos, selectedPhotoId]
  );

  const currentIndex = selectedPhotoId
    ? displayedPhotos.findIndex((p) => p.id === selectedPhotoId)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedPhotoId(displayedPhotos[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < displayedPhotos.length - 1) {
      setSelectedPhotoId(displayedPhotos[currentIndex + 1].id);
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

  // 移出摄影集（仅移除 collection_id，照片回到首页瀑布流）
  const handleRemoveFromCollection = useCallback(
    async (photoId: number) => {
      if (!window.confirm("将此照片移出摄影集？照片会重新出现在首页瀑布流中。")) return;
      try {
        await fetch(`/api/photos/${photoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection_id: null }),
        });
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setCollection((prev) =>
          prev && prev.cover_photo_id === photoId
            ? { ...prev, cover_photo_id: null }
            : prev
        );
      } catch (err) {
        console.error("移出失败:", err);
      }
    },
    [id]
  );

  // 批量移出摄影集
  const handleBatchRemove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`将选中的 ${selectedIds.size} 张照片移出摄影集？照片会重新出现在首页瀑布流中。`)) return;
    try {
      const res = await fetch("/api/photos/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: Array.from(selectedIds), context: "collection" }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setSelectionMode(false);
      }
    } catch (err) {
      console.error("批量移出失败:", err);
    }
  }, [selectedIds, id]);

  // 批量移动到章节
  const handleBatchMoveToChapter = useCallback(
    async (chapterId: number) => {
      try {
        const res = await fetch("/api/photos/batch", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_ids: Array.from(selectedIds),
            collection_id: parseInt(id),
            move_to_chapter_id: chapterId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          // 刷新照片列表以获取新的 sort_order
          fetchCollection();
          setSelectedIds(new Set());
          setSelectionMode(false);
        }
      } catch (err) {
        console.error("移动到章节失败:", err);
      }
    },
    [selectedIds, id, fetchCollection]
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
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              onBlur={() => setEditingTitle(false)}
              className="text-xl font-semibold text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-gray-600 outline-none px-0 py-0 min-w-0 w-48"
            />
          ) : (
            <h2 className="text-xl font-semibold text-gray-800">
              {collection.title || "未命名摄影集"}
            </h2>
          )}
          {collection.status !== "published" && !editingTitle && (
            <button
              onClick={() => {
                setTitleDraft(collection.title || "");
                setEditingTitle(true);
              }}
              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              title="编辑名称"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLASS[collection.status]}`}
          >
            {STATUS_LABEL[collection.status]}
          </span>
          {/* 删除摄影集（非 published 状态 / published 状态均可删除） */}
          <button
            onClick={handleDeleteCollection}
            className="text-[10px] px-2 py-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto"
            title="删除摄影集"
          >
            删除摄影集
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {photos.length} 张照片
        </p>

        {/* 章节导航 */}
        {chapters.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <button
              onClick={() => handleChapterNavClick(null)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                focusChapterId == null
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              全部（{photos.length}）
            </button>
            {[...chapters]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((ch) => {
                const count = chapterPhotoCounts.get(ch.id) ?? 0;
                const isFocused = focusChapterId === ch.id;
                const isHighlighted = highlightChapterId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleChapterNavClick(ch.id)}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition-all ${
                      isFocused
                        ? "bg-gray-800 text-white"
                        : isHighlighted
                        ? "ring-2 ring-gray-300 bg-gray-100 text-gray-700"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {ch.title}（{count}）
                  </button>
                );
              })}
          </div>
        )}

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
              <a
                href={`/api/collections/${id}/export/md`}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                导出 Markdown
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
            <>
              {/* Focus Mode 横幅 */}
              {focusChapterId != null && (
                <div className="mb-4 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-2">
                  <button
                    onClick={() => handleChapterNavClick(null)}
                    className="text-[10px] text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    ← 返回全部
                  </button>
                  <span className="text-[10px] text-gray-400">
                    {chapters.find((c) => c.id === focusChapterId)?.title || ""}
                    （{displayedPhotos.length} 张）
                  </span>
                </div>
              )}

              {/* 章节 + 选择模式按钮 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* 章节列表 */}
                {chapters.map((ch) => (
                  <span
                    key={ch.id}
                    className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500"
                  >
                    {ch.title}
                    <button
                      onClick={() => handleDeleteChapter(ch.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="删除章节"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* 新增章节 */}
                {showAddChapter ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      autoFocus
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddChapter();
                        if (e.key === "Escape") {
                          setShowAddChapter(false);
                          setChapterTitle("");
                        }
                      }}
                      placeholder="章节名称"
                      className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 w-24 outline-none focus:border-gray-400"
                    />
                    <button
                      onClick={handleAddChapter}
                      disabled={!chapterTitle.trim()}
                      className="text-[10px] px-1.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 transition-colors"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => {
                        setShowAddChapter(false);
                        setChapterTitle("");
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-500"
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setShowAddChapter(true)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    + 新增章节
                  </button>
                )}

                {/* 选择模式 */}
                <button
                  onClick={() => {
                    setSelectionMode((prev) => !prev);
                    setSelectedIds(new Set());
                  }}
                  className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                    selectionMode
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {selectionMode ? "完成" : "选择照片"}
                </button>
              </div>

              <PhotoGrid
                photos={displayedPhotos}
                onPhotoClick={(photoId) => {
                  if (selectionMode) return;
                  setSelectedPhotoId(photoId);
                }}
                showSortControls
                onMoveUp={(photoId) => handleMove(photoId, "up")}
                onMoveDown={(photoId) => handleMove(photoId, "down")}
                showCoverButton
                coverPhotoId={focusChapterId != null ? null : collection.cover_photo_id}
                onSetCover={focusChapterId != null ? undefined : handleSetCover}
                onDelete={handleRemoveFromCollection}
                selectable={selectionMode}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onBatchDelete={handleBatchRemove}
                batchActionLabel="移出摄影集"
                chapters={chapters}
                onBatchMoveToChapter={handleBatchMoveToChapter}
              />
            </>
          )}

          {/* 照片详情弹窗 */}
          {selectedPhotoId && selectedPhoto && (
            <PhotoModal
              photo={selectedPhoto}
              photos={displayedPhotos}
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
