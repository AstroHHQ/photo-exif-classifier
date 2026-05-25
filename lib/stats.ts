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

/** 月度拍摄计数 */
export interface MonthlyCount {
  month: string; // "2026-05"
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
  /** 月度拍摄活跃度（最近 12 个月） */
  monthlyCounts: MonthlyCount[];
  /** 最近一次拍摄日期 */
  lastPhotoDate: string | null;
  /** 最近 30 天拍摄数量 */
  recentCount: number;
}

/** 将 null/undefined 统一为 "未知" */
function label(val: unknown): string {
  if (val === null || val === undefined) return "未知";
  return String(val);
}

/**
 * 解析日期字符串。
 * 支持两种格式：
 * - EXIF ISO 8601: "2026-04-04T00:08:46"
 * - SQLite datetime: "2026-05-22 14:14:43"
 */
function parseDate(raw: string): Date | null {
  // SQLite datetime "YYYY-MM-DD HH:mm:ss" → ISO "YYYY-MM-DDTHH:mm:ss"
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 获取可用于统计的日期。
 * 优先 date_taken（EXIF），为 null 时 fallback 到 created_at（上传时间）。
 */
function getPhotoDate(p: Photo): { date: Date; dateStr: string } | null {
  const raw = p.date_taken || p.created_at;
  if (!raw) return null;
  const d = parseDate(raw);
  if (!d) return null;
  // 统一 month key 格式：YYYY-MM
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { date: d, dateStr: key };
}

export function getStats(): Stats {
  const photos = getAllPhotos();

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

  // 月度拍摄活跃度（最近 12 个月）
  const now = new Date();
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = 0;
  }

  let lastPhotoDate: string | null = null;
  let recentCount = 0;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const p of photos) {
    const pd = getPhotoDate(p);
    if (!pd) continue;

    if (monthlyMap[pd.dateStr] !== undefined) {
      monthlyMap[pd.dateStr]++;
    }

    // 最近拍摄日期取原始字符串（date_taken 优先，用于 UI 展示）
    const rawDate = p.date_taken || p.created_at;
    if (!lastPhotoDate || rawDate > lastPhotoDate) {
      lastPhotoDate = rawDate;
    }

    if (pd.date >= thirtyDaysAgo) {
      recentCount++;
    }
  }

  const monthlyCounts: MonthlyCount[] = Object.entries(monthlyMap).map(
    ([month, count]) => ({ month, count })
  );

  return {
    cameras: aggregate((p) => p.camera_model || (p as any).Make),
    lenses: aggregate((p) => p.lens_model),
    focalLengths: aggregate((p) => p.focal_length),
    isos: aggregate((p) => (p.iso != null ? String(p.iso) : "")),
    apertures: aggregate((p) => p.aperture),
    shutterSpeeds: aggregate((p) => p.shutter_speed),
    totalPhotos: photos.length,
    monthlyCounts,
    lastPhotoDate,
    recentCount,
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
