"use client";

/**
 * PhotoContainer —— 照片管理容器。
 *
 * 职责：
 * - 获取全量照片
 * - 管理筛选状态
 * - 管理弹窗状态（选中照片 + 前后切换）
 * - 备注更新（调用 PATCH API 并同步本地状态）
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import StatsPanel from "./StatsPanel";
import FilterBar from "./FilterBar";
import PhotoGrid from "./PhotoGrid";
import PhotoModal from "./PhotoModal";
import type { PhotoData } from "./PhotoCard";
import type { Filters } from "@/lib/stats";

export default function PhotoContainer() {
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);
  const [collections, setCollections] = useState<{ id: number; title: string }[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    camera: null,
    lens: null,
    aperture: null,
    iso: null,
  });

  // 获取全量照片
  useEffect(() => {
    fetch("/api/photos?unarchived=1")
      .then((res) => res.json())
      .then((data: PhotoData[]) => setAllPhotos(data))
      .catch(console.error);
  }, []);

  // 获取可编辑摄影集列表（排除 published，用于导入选择）
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
      apertures: pick((p) => p.aperture),
      isos: pick((p) => (p.iso != null ? String(p.iso) : null)),
    };
  }, [allPhotos]);

  // 筛选后的照片
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter((p) => {
      if (filters.camera && p.camera_model !== filters.camera) return false;
      if (filters.lens && p.lens_model !== filters.lens) return false;
      if (filters.aperture && p.aperture !== filters.aperture) return false;
      if (filters.iso && String(p.iso) !== filters.iso) return false;
      return true;
    });
  }, [allPhotos, filters]);

  const handleFilterChange = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ camera: null, lens: null, aperture: null, iso: null });
  };

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
      // 乐观更新本地状态
      setAllPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, note } : p))
      );
      // 调用 API 持久化
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
    if (!window.confirm("确认删除这张照片？")) return;
    try {
      await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
      setAllPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error("删除失败:", err);
    }
  }, []);

  // 导入照片到摄影集
  const handleImportToCollection = useCallback(
    async (photoId: number, collectionId: number) => {
      try {
        await fetch(`/api/photos/${photoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection_id: collectionId }),
        });
        // 从未归档列表移除
        setAllPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (err) {
        console.error("导入失败:", err);
      }
    },
    []
  );

  return (
    <>
      {/* 统计面板 */}
      <StatsPanel />

      {/* 筛选栏 */}
      <FilterBar
        options={filterOptions}
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* 照片瀑布流 */}
      <PhotoGrid
        photos={filteredPhotos}
        onPhotoClick={(id) => setSelectedPhotoId(id)}
        onDelete={handleDelete}
        collections={collections}
        onImportToCollection={handleImportToCollection}
      />

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
