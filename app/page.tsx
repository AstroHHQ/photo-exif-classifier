"use client";

/**
 * 首页 —— 上传照片 + 筛选 + 瀑布流。
 *
 * 筛选支持：相机型号 / 镜头 / 光圈 / ISO。
 * 从 /api/photos 获取全量数据后在客户端做筛选，不额外请求 API。
 */

import { useState, useEffect, useMemo } from "react";
import UploadZone from "@/components/UploadZone";
import StatsPanel from "@/components/StatsPanel";
import PhotoGrid from "@/components/PhotoGrid";
import FilterBar from "@/components/FilterBar";
import type { PhotoData } from "@/components/PhotoCard";
import type { Filters } from "@/lib/stats";

export default function Home() {
  // 全量照片数据
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);
  // 筛选条件
  const [filters, setFilters] = useState<Filters>({
    camera: null,
    lens: null,
    aperture: null,
    iso: null,
  });

  // 初次加载获取全部照片
  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data: PhotoData[]) => setAllPhotos(data))
      .catch(console.error);
  }, []);

  // 从全量数据计算可用的筛选选项（客户端聚合）
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

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 引导文案 */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
          导入照片
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          上传照片，自动读取 EXIF 信息并按镜头、焦距、相机分类
        </p>
      </div>

      {/* 上传区 */}
      <UploadZone />

      {/* EXIF 统计面板 */}
      <StatsPanel />

      {/* 筛选栏 */}
      <FilterBar
        options={filterOptions}
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* 照片瀑布流（传入筛选结果） */}
      <PhotoGrid photos={filteredPhotos} />
    </div>
  );
}
