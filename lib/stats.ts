/**
 * 统计聚合模块 —— 用纯 JS reduce 对照片 EXIF 数据做分组统计。
 *
 * 不写复杂 SQL，直接从 getAllPhotos() 拿全量数据在内存里算。
 * 本地 SQLite 管理几十万张照片毫无压力，这种聚合毫秒级完成。
 */

import { getAllPhotos, type Photo } from "./db";

/** 统计项：参数值 + 出现次数 */
interface StatItem {
  value: string;
  count: number;
}

/** 统计面板所需的所有数据 */
export interface Stats {
  cameras: StatItem[];
  lenses: StatItem[];
  focalLengths: StatItem[];
  isos: StatItem[];
  apertures: StatItem[];
  shutterSpeeds: StatItem[];
  totalPhotos: number;
}

/** 将 null/undefined 统一为 "未知" */
function label(val: unknown): string {
  if (val === null || val === undefined) return "未知";
  return String(val);
}

export function getStats(): Stats {
  const photos = getAllPhotos();

  /**
   * 通用聚合函数：
   * 1. 按 fn(photo) 分组计数
   * 2. 按 count 降序排列
   */
  const aggregate = (fn: (p: Photo) => string | null): StatItem[] => {
    const map = photos.reduce<Record<string, number>>((acc, p) => {
      const key = label(fn(p));
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(map)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    cameras: aggregate((p) => p.camera_model || (p as any).Make), // 用 camera_model
    lenses: aggregate((p) => p.lens_model),
    focalLengths: aggregate((p) => p.focal_length),
    isos: aggregate((p) => (p.iso != null ? String(p.iso) : "")),
    apertures: aggregate((p) => p.aperture),
    shutterSpeeds: aggregate((p) => p.shutter_speed),
    totalPhotos: photos.length,
  };
}

/** 筛选选项 */
export interface FilterOptions {
  cameras: string[];
  lenses: string[];
  apertures: string[];
  isos: string[];
}

/** 筛选条件 */
export interface Filters {
  camera: string | null;
  lens: string | null;
  aperture: string | null;
  iso: string | null;
}

/** 获取可用的筛选选项（去重排序） */
export function getFilterOptions(): FilterOptions {
  const photos = getAllPhotos();
  const unique = (fn: (p: Photo) => string | null): string[] => {
    const set = new Set<string>();
    for (const p of photos) {
      const val = fn(p);
      if (val) set.add(val);
    }
    return Array.from(set).sort();
  };
  return {
    cameras: unique((p) => p.camera_model),
    lenses: unique((p) => p.lens_model),
    apertures: unique((p) => p.aperture),
    isos: unique((p) => (p.iso != null ? String(p.iso) : null)),
  };
}

/** 根据筛选条件过滤照片 */
export function filterPhotos(filters: Filters): Photo[] {
  const photos = getAllPhotos();
  return photos.filter((p) => {
    if (filters.camera && p.camera_model !== filters.camera) return false;
    if (filters.lens && p.lens_model !== filters.lens) return false;
    if (filters.aperture && p.aperture !== filters.aperture) return false;
    if (filters.iso && String(p.iso) !== filters.iso) return false;
    return true;
  });
}
