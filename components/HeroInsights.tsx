"use client";

/**
 * HeroInsights —— 摄影报告摘要。
 *
 * 从 /api/stats 生成自然语言摄影摘要。
 * 不展示图表、不展示百分比、不展示统计细节。
 * 像年度摄影报告的开场白。
 */

import { useEffect, useState } from "react";

/* ---- 类型 ---- */

interface FocalDist {
  range: string;
  mm: string;
  count: number;
  percentage: number;
}

interface MonthlyFocalDist {
  month: string;
  label: string;
  distribution: FocalDist[];
}

interface StatsData {
  cameras: { value: string; count: number }[];
  lenses: { value: string; count: number }[];
  totalPhotos: number;
  lastPhotoDate: string | null;
  recentCount: number;
  last90Days: number;
  yearlyCount: number;
  focalDistribution: FocalDist[];
  monthlyFocalDistribution: MonthlyFocalDist[];
}

/* ---- 工具 ---- */

function clean(val: string): string {
  return val.trim();
}

function isUnknown(val: string): boolean {
  return !val || val === "未知";
}

/* ---- 生成自然语言摘要 ---- */

function generateSentences(stats: StatsData): string[] {
  const lines: string[] = [];

  // 1. 拍摄活跃度
  if (stats.recentCount > 0) {
    lines.push(`最近 30 天拍摄 ${stats.recentCount} 张照片。`);
    if (stats.last90Days > stats.recentCount) {
      lines.push(`近 90 天共 ${stats.last90Days} 张，今年累计 ${stats.yearlyCount} 张。`);
    }
  } else if (stats.last90Days > 0) {
    lines.push(`近 90 天拍摄 ${stats.last90Days} 张照片，今年累计 ${stats.yearlyCount} 张。`);
  } else {
    lines.push(`摄影库共 ${stats.totalPhotos} 张照片。`);
  }

  // 2. 主力设备
  const topCamera = stats.cameras[0];
  if (topCamera && !isUnknown(topCamera.value)) {
    lines.push(`${clean(topCamera.value)} 是最常用相机。`);
  }

  const topLens = stats.lenses[0];
  if (topLens && !isUnknown(topLens.value)) {
    lines.push(`${clean(topLens.value)} 是最常用镜头。`);
  }

  // 3. 摄影语言倾向
  if (stats.focalDistribution && stats.focalDistribution.length > 0) {
    const top = stats.focalDistribution.reduce((a, b) => (a.count > b.count ? a : b));
    if (top.count > 0 && top.percentage >= 25) {
      const lang: Record<string, string> = {
        "超广角": "偏好超广角，强调空间张力与视觉冲击。",
        "广角": "偏向广角叙事，注重环境与空间关系。",
        "标准焦段": "习惯标准焦段，接近人眼观察，构图克制。",
        "中长焦": "偏好中长焦，善于压缩空间、突出主体。",
        "长焦": "偏向长焦表达，远距离捕捉与空间压缩。",
        "超长焦": "使用超长焦，专注于远距离主体与细节。",
      };
      const desc = lang[top.range];
      if (desc) lines.push(desc);
    }
  }

  // 4. 摄影语言变化（最近 3 个月 vs 整体）
  const monthly = stats.monthlyFocalDistribution;
  if (monthly && monthly.length >= 3) {
    const recent = monthly.slice(-3);
    const recentAvg: Record<string, number> = {};
    for (const m of recent) {
      for (const d of m.distribution) {
        recentAvg[d.range] = (recentAvg[d.range] || 0) + d.percentage / 3;
      }
    }
    let maxShift = 0;
    let shiftRange = "";
    for (const d of stats.focalDistribution) {
      const overall = d.percentage;
      const shift = Math.round((recentAvg[d.range] || 0) - overall);
      if (Math.abs(shift) > Math.abs(maxShift)) {
        maxShift = shift;
        shiftRange = d.range;
      }
    }
    if (Math.abs(maxShift) >= 10) {
      const dir = maxShift > 0 ? "上升" : "下降";
      lines.push(`最近 ${shiftRange} 使用占比${dir}，摄影语言正在演变。`);
    }
  }

  return lines;
}

/* ---- 主组件 ---- */

export default function HeroInsights() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data: StatsData) => setLines(generateSentences(data)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-6">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (lines.length === 0) return null;

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <p key={i} className="text-[13px] text-gray-600 leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}
