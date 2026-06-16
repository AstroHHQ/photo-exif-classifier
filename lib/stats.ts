/**
 * 统计聚合模块 —— 用纯 JS reduce 对照片 EXIF 数据做分组统计。
 *
 * 不写复杂 SQL，直接从 getAllPhotos() 拿全量数据在内存里算。
 * 本地 SQLite 管理几十万张照片毫无压力，这种聚合毫秒级完成。
 */

import { getAllPhotos, type Photo } from "./db";
import { detectCropFactor, parseFocalLengthMm, FOCAL_RANGES, classifyFocalRange, computeEquivalentFocalLength } from "./focalRanges";

/** 统计项：参数值 + 出现次数 */
interface StatItem {
  value: string;
  count: number;
}

/** 单日拍摄计数 */
export interface DailyCount {
  date: string; // "2026-05-26"
  count: number;
}

/** 时段拍摄计数 */
export interface TimeOfDayCount {
  period: "上午" | "下午" | "傍晚" | "夜晚";
  count: number;
}

/** 摄影语言分布项 */
export interface FocalDistribution {
  /** 摄影语言范围，如 "广角"、"标准焦段" */
  range: string;
  /** 等效焦段范围，如 "21-35mm" */
  mm: string;
  count: number;
  percentage: number;
}

/** 月度摄影语言分布 */
export interface MonthlyFocalDist {
  month: string;   // "2026-01"
  label: string;   // "1月"
  distribution: FocalDistribution[];
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
  /** 每日拍摄活跃度（最近 365 天，用于热力图） */
  dailyActivity: DailyCount[];
  /** 最近一次拍摄日期 */
  lastPhotoDate: string | null;
  /** 最近 30 天拍摄数量 */
  recentCount: number;
  /** 最近 90 天拍摄数量 */
  last90Days: number;
  /** 本年累计拍摄数量 */
  yearlyCount: number;
  /** 时段分布（上午/下午/傍晚/夜晚） */
  timeOfDay: TimeOfDayCount[];
  /** 摄影语言分布（基于 35mm 等效焦段） */
  focalDistribution: FocalDistribution[];
  /** 过去 12 个月每月的摄影语言分布 */
  monthlyFocalDistribution: MonthlyFocalDist[];
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
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** 格式化日期为 YYYY-MM-DD */
function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 根据小时数返回时段 */
function getTimePeriod(hour: number): "上午" | "下午" | "傍晚" | "夜晚" {
  if (hour >= 6 && hour < 12) return "上午";
  if (hour >= 12 && hour < 18) return "下午";
  if (hour >= 18 && hour < 21) return "傍晚";
  return "夜晚";
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

  // 每日拍摄活跃度（最近 365 天）
  const now = new Date();
  const dailyMap: Record<string, number> = {};
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap[formatDayKey(d)] = 0;
  }

  let lastPhotoDate: string | null = null;
  let recentCount = 0;
  let last90Days = 0;
  let yearlyCount = 0;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // 时段分布
  const timeOfDayMap: Record<string, number> = { "上午": 0, "下午": 0, "傍晚": 0, "夜晚": 0 };

  for (const p of photos) {
    const raw = p.date_taken || p.created_at;
    if (!raw) continue;
    const d = parseDate(raw);
    if (!d) continue;

    const dayKey = formatDayKey(d);
    if (dailyMap[dayKey] !== undefined) {
      dailyMap[dayKey]++;
    }

    const rawDate = p.date_taken || p.created_at;
    if (!lastPhotoDate || rawDate > lastPhotoDate) {
      lastPhotoDate = rawDate;
    }

    if (d >= thirtyDaysAgo) {
      recentCount++;
    }
    if (d >= ninetyDaysAgo) {
      last90Days++;
    }
    if (d >= yearStart) {
      yearlyCount++;
    }

    timeOfDayMap[getTimePeriod(d.getHours())]++;
  }

  const dailyActivity: DailyCount[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const timeOfDay: TimeOfDayCount[] = (["上午", "下午", "傍晚", "夜晚"] as const)
    .map((period) => ({ period, count: timeOfDayMap[period] }))
    .sort((a, b) => b.count - a.count);

  // 等效焦段 → 摄影语言分布
  const focalRangeMap: Record<string, number> = {};
  for (const r of FOCAL_RANGES) focalRangeMap[r.range] = 0;
  for (const p of photos) {
    const eq = computeEquivalentFocalLength(p.focal_length_35mm, p.camera_model, p.focal_length);
    if (eq !== null) {
      const range = classifyFocalRange(eq);
      focalRangeMap[range]++;
    }
  }
  const focalDistribution: FocalDistribution[] = FOCAL_RANGES.map((r) => ({
    range: r.range,
    mm: r.mm,
    count: focalRangeMap[r.range],
    percentage: photos.length > 0 ? Math.round((focalRangeMap[r.range] / photos.length) * 100) : 0,
  }));

  // 月度摄影语言分布（过去 12 个月）
  const monthlyMap: Record<string, Record<string, number>> = {};
  for (const p of photos) {
    const raw = p.date_taken || p.created_at;
    if (!raw) continue;
    const d = parseDate(raw);
    if (!d) continue;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {};
      for (const r of FOCAL_RANGES) monthlyMap[monthKey][r.range] = 0;
    }
    const eq = computeEquivalentFocalLength(p.focal_length_35mm, p.camera_model, p.focal_length);
    if (eq !== null) {
      monthlyMap[monthKey][classifyFocalRange(eq)]++;
    }
  }

  // 生成过去 12 个月列表
  const monthLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthlyFocalDistribution: MonthlyFocalDist[] = monthLabels.map((mk) => {
    const monthData = monthlyMap[mk] || {};
    const total = Object.values(monthData).reduce((a, b) => a + b, 0);
    const distribution: FocalDistribution[] = FOCAL_RANGES.map((r) => ({
      range: r.range,
      mm: r.mm,
      count: monthData[r.range] || 0,
      percentage: total > 0 ? Math.round(((monthData[r.range] || 0) / total) * 100) : 0,
    }));
    const [y, m] = mk.split("-");
    return { month: mk, label: `${parseInt(m)}月`, distribution };
  });

  return {
    cameras: aggregate((p) => p.camera_model || (p as any).Make),
    lenses: aggregate((p) => p.lens_model),
    focalLengths: aggregate((p) => p.focal_length),
    isos: aggregate((p) => (p.iso != null ? String(p.iso) : "")),
    apertures: aggregate((p) => p.aperture),
    shutterSpeeds: aggregate((p) => p.shutter_speed),
    totalPhotos: photos.length,
    dailyActivity,
    lastPhotoDate,
    recentCount,
    last90Days,
    yearlyCount,
    timeOfDay,
    focalDistribution,
    monthlyFocalDistribution,
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
