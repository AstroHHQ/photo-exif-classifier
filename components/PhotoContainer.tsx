"use client";

/**
 * PhotoContainer —— 照片管理容器。
 *
 * 职责：
 * - 获取未归档照片（支持排序）
 * - 管理筛选状态（相机 / 镜头 / 时间 / 焦段 / 备注 / 搜索）
 * - 客户端筛选（所有过滤在前端完成）
 * - 管理弹窗状态（选中照片 + 前后切换）
 * - 备注更新（调用 PATCH API 并同步本地状态）
 *
 * 筛选不调用额外 API —— 已获取的照片在内存中过滤。
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import FilterBar from "./FilterBar";
import PhotoGrid from "./PhotoGrid";
import PhotoModal from "./PhotoModal";
import type { PhotoData } from "./PhotoCard";
import type { Filters } from "@/lib/stats";
import type { TimeFilter, SortOrder, NoteFilter } from "./FilterBar";
import {
  computeEquivalentFocalLength,
  classifyFocalRange,
  FOCAL_RANGES,
} from "@/lib/focalRanges";

/* ---- 工具函数 ---- */

/** 解析日期字符串为 Date 对象 */
function parseDate(raw: string): Date | null {
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** 根据 TimeFilter 判断照片是否在时间范围内 */
function matchesTimeFilter(
  photo: PhotoData,
  time: TimeFilter
): boolean {
  if (time.preset === "all") return true;

  const rawDate = photo.date_taken || photo.created_at;
  if (!rawDate) return false;
  const d = parseDate(rawDate);
  if (!d) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (time.preset) {
    case "today":
      return d >= todayStart;
    case "week": {
      const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }
    case "month": {
      const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      return d >= monthAgo;
    }
    case "quarter": {
      const quarterAgo = new Date(todayStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      return d >= quarterAgo;
    }
    case "year":
      return d.getFullYear() === now.getFullYear();
    case "year-select":
      return time.year !== null && d.getFullYear() === time.year;
    case "custom": {
      if (time.from) {
        const fromDate = new Date(time.from);
        if (d < fromDate) return false;
      }
      if (time.to) {
        const toDate = new Date(time.to + "T23:59:59");
        if (d > toDate) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/* ---- 组件 ---- */

export default function PhotoContainer() {
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);
  const [collections, setCollections] = useState<{ id: number; title: string }[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_desc");
  const [filters, setFilters] = useState<Filters>({
    camera: null,
    lens: null,
    aperture: null,
    iso: null,
  });
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({
    preset: "all",
    year: null,
    from: null,
    to: null,
  });
  const [noteStatus, setNoteStatus] = useState<NoteFilter>("all");
  const [focalRange, setFocalRange] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 获取未归档照片（排序变化时重新获取）
  useEffect(() => {
    fetch(`/api/photos?unarchived=1&sort=${sortOrder}`)
      .then((res) => res.json())
      .then((data: PhotoData[]) => setAllPhotos(data))
      .catch(console.error);
  }, [sortOrder]);

  // 获取可编辑摄影集列表
  useEffect(() => {
    fetch("/api/collections?editable=1")
      .then((res) => res.json())
      .then((data: { id: number; title: string }[]) => setCollections(data))
      .catch(console.error);
  }, []);

  // 筛选选项
  const filterOptions = useMemo(() => {
    const pick = (fn: (p: PhotoData) => string | null): string[] => {
      const set = new Set<string>();
      for (const p of allPhotos) {
        const val = fn(p);
        if (val != null && val !== "") set.add(val);
      }
      return Array.from(set).sort();
    };
    return {
      cameras: pick((p) => p.camera_model),
      lenses: pick((p) => p.lens_model),
    };
  }, [allPhotos]);

  // 筛选后的照片
  const filteredPhotos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allPhotos.filter((p) => {
      // 相机筛选
      if (filters.camera && p.camera_model !== filters.camera) return false;
      // 镜头筛选
      if (filters.lens && p.lens_model !== filters.lens) return false;
      // 时间筛选
      if (!matchesTimeFilter(p, timeFilter)) return false;
      // 焦段筛选
      if (focalRange) {
        const eq = computeEquivalentFocalLength(
          p.focal_length_35mm ?? null,
          p.camera_model,
          p.focal_length
        );
        if (eq === null) return false;
        if (classifyFocalRange(eq) !== focalRange) return false;
      }
      // 备注筛选
      if (noteStatus === "has" && !p.note) return false;
      if (noteStatus === "none" && p.note) return false;
      // 关键词搜索
      if (query) {
        const name = (p.original_name || "").toLowerCase();
        const note = (p.note || "").toLowerCase();
        if (!name.includes(query) && !note.includes(query)) return false;
      }
      return true;
    });
  }, [allPhotos, filters, timeFilter, focalRange, noteStatus, searchQuery]);

  // 当前选中的照片
  const selectedPhoto = useMemo(
    () => allPhotos.find((p) => p.id === selectedPhotoId) || null,
    [allPhotos, selectedPhotoId]
  );

  const currentIndex = selectedPhotoId
    ? filteredPhotos.findIndex((p) => p.id === selectedPhotoId)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedPhotoId(filteredPhotos[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredPhotos.length - 1) {
      setSelectedPhotoId(filteredPhotos[currentIndex + 1].id);
    }
  };

  // 更新备注
  const handleNoteChange = useCallback(
    async (photoId: number, note: string) => {
      setAllPhotos((prev) =>
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

  // 删除照片
  const handleDelete = useCallback(async (photoId: number) => {
    const photo = allPhotos.find((p) => p.id === photoId);
    const isReferenced = photo?.storage_mode === "referenced";
    const msg = isReferenced
      ? "移除此照片记录？（引用模式，原始文件不受影响）"
      : "确认删除这张照片？（复制模式，文件将被永久删除）";
    if (!window.confirm(msg)) return;
    try {
      await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
      setAllPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error("删除失败:", err);
    }
  }, [allPhotos]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const referencedCount = Array.from(selectedIds).filter((id) => {
      const p = allPhotos.find((x) => x.id === id);
      return p?.storage_mode === "referenced";
    }).length;
    const copiedCount = selectedIds.size - referencedCount;

    let msg = `确认删除选中的 ${selectedIds.size} 张照片？`;
    if (referencedCount > 0 && copiedCount > 0) {
      msg += `\n\n${referencedCount} 张引用模式（仅删除记录）\n${copiedCount} 张复制模式（删除文件 + 记录）`;
    } else if (referencedCount > 0) {
      msg += "\n\n引用模式：仅删除数据库记录，原始文件不受影响。";
    } else {
      msg += "\n\n复制模式：文件将被永久删除。";
    }

    if (!window.confirm(msg)) return;

    try {
      const res = await fetch("/api/photos/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: Array.from(selectedIds), context: "library" }),
      });
      const data = await res.json();
      if (data.success) {
        setAllPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setSelectionMode(false);
      }
    } catch (err) {
      console.error("批量删除失败:", err);
    }
  }, [selectedIds, allPhotos]);

  // 批量加入摄影集
  const handleBatchAddToCollection = useCallback(
    async (collectionId: number) => {
      try {
        const res = await fetch("/api/photos/batch", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_ids: Array.from(selectedIds),
            collection_id: collectionId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setAllPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
          setSelectedIds(new Set());
          setSelectionMode(false);
        }
      } catch (err) {
        console.error("批量导入失败:", err);
      }
    },
    [selectedIds]
  );

  // 导入照片到摄影集
  const handleImportToCollection = useCallback(
    async (photoId: number, collectionId: number) => {
      try {
        await fetch(`/api/photos/${photoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection_id: collectionId }),
        });
        setAllPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (err) {
        console.error("导入失败:", err);
      }
    },
    []
  );

  // 重置所有筛选
  const handleResetFilters = () => {
    setFilters({ camera: null, lens: null, aperture: null, iso: null });
    setTimeFilter({ preset: "all", year: null, from: null, to: null });
    setNoteStatus("all");
    setFocalRange(null);
    setSearchQuery("");
  };

  return (
    <>
      {/* 筛选栏 */}
      <FilterBar
        cameras={filterOptions.cameras}
        lenses={filterOptions.lenses}
        focalRanges={FOCAL_RANGES.map((r) => ({ range: r.range, mm: r.mm }))}
        camera={filters.camera}
        lens={filters.lens}
        focalRange={focalRange}
        noteStatus={noteStatus}
        time={timeFilter}
        searchQuery={searchQuery}
        sortOrder={sortOrder}
        onCameraChange={(value) => setFilters((prev) => ({ ...prev, camera: value }))}
        onLensChange={(value) => setFilters((prev) => ({ ...prev, lens: value }))}
        onFocalRangeChange={setFocalRange}
        onNoteStatusChange={setNoteStatus}
        onTimeChange={setTimeFilter}
        onSearchChange={setSearchQuery}
        onSortChange={setSortOrder}
        onReset={handleResetFilters}
        selectionMode={selectionMode}
        onToggleSelection={() => {
          setSelectionMode((prev) => !prev);
          setSelectedIds(new Set());
        }}
      />

      {/* 照片瀑布流（主视觉） */}
      <div className="mt-6">
        <PhotoGrid
          photos={filteredPhotos}
          onPhotoClick={(id) => {
            if (selectionMode) return;
            setSelectedPhotoId(id);
          }}
          onDelete={handleDelete}
          collections={collections}
          onImportToCollection={handleImportToCollection}
          selectable={selectionMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onBatchDelete={handleBatchDelete}
          batchActionLabel="删除选中照片"
          onBatchAddToCollection={handleBatchAddToCollection}
          batchAddCollections={collections}
        />
      </div>

      {/* 详情弹窗 */}
      {selectedPhotoId && (
        <PhotoModal
          photo={selectedPhoto}
          photos={filteredPhotos}
          onClose={() => setSelectedPhotoId(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          onNoteChange={handleNoteChange}
        />
      )}
    </>
  );
}
