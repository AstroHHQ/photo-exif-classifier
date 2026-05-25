"use client";

/**
 * StatsPanel —— 摄影档案可视化。
 *
 * 目标：一眼看懂拍摄习惯，而非阅读数据表。
 * 视觉语言：单色灰度、细线 icon、横向占比条、月度活跃度迷你图。
 */

import { useEffect, useState } from "react";

interface StatItem {
  value: string;
  count: number;
}

interface MonthlyCount {
  month: string;
  count: number;
}

interface StatsData {
  cameras: StatItem[];
  lenses: StatItem[];
  focalLengths: StatItem[];
  isos: StatItem[];
  apertures: StatItem[];
  shutterSpeeds: StatItem[];
  totalPhotos: number;
  monthlyCounts: MonthlyCount[];
  lastPhotoDate: string | null;
  recentCount: number;
}

/* ---- 极简细线 icon（lucide 风格） ---- */

function IconCamera() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h2l1-2h6l1 2h2a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm7 10a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function IconLens() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 2v4m0 12v4M2 12h4m12 0h4M5.6 5.6l2.8 2.8m7.2 7.2l2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2l2.8-2.8" />
    </svg>
  );
}

function IconFocal() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="8" y1="8" x2="4" y2="8" />
      <line x1="16" y1="8" x2="20" y2="8" />
      <line x1="8" y1="16" x2="4" y2="16" />
      <line x1="16" y1="16" x2="20" y2="16" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ---- 占比条 ---- */

function ProportionBar({ value, count, total, maxWidth }: { value: string; count: number; total: number; maxWidth: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const barWidth = (count / maxWidth) * 100;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 text-gray-500 truncate shrink-0 text-right">{value}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
        <div
          className="h-full bg-gray-400 rounded-sm transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="w-8 text-gray-400 shrink-0 tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

/* ---- 月度活跃度迷你图 ---- */

function MonthlyTimeline({ monthlyCounts }: { monthlyCounts: MonthlyCount[] }) {
  const max = Math.max(...monthlyCounts.map((m) => m.count), 1);
  const maxBarPx = 40; // 最高柱像素高度
  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400">{monthlyCounts[0]?.month.split("-")[0]}</span>
        <span className="text-[10px] text-gray-400">{monthlyCounts[monthlyCounts.length - 1]?.month.split("-")[0]}</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: maxBarPx + 18 }}>
        {monthlyCounts.map((m) => {
          const barHeight = Math.max((m.count / max) * maxBarPx, 2);
          const monthLabel = months[parseInt(m.month.split("-")[1]) - 1];
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: m.count > 0 ? "#9ca3af" : "#e5e7eb",
                }}
                title={`${m.month}: ${m.count} 张`}
              />
              <span className="text-[9px] text-gray-300 leading-none">{monthLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- 主组件 ---- */

export default function StatsPanel() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data: StatsData) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || stats.totalPhotos === 0) return null;

  const topCamera = stats.cameras[0];
  const topFocal = stats.focalLengths[0];

  const cameraMax = stats.cameras[0]?.count ?? 1;
  const focalMax = stats.focalLengths[0]?.count ?? 1;

  // 最近拍摄日期格式化
  const lastDateStr = stats.lastPhotoDate
    ? new Date(stats.lastPhotoDate).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-5">
      {/* 头部：总数 */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-light text-gray-800 tabular-nums">{stats.totalPhotos}</span>
        <span className="text-xs text-gray-400">张照片</span>
      </div>

      {/* 月度活跃度 */}
      {stats.monthlyCounts.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-gray-300"><IconCalendar /></span>
            <span className="text-[10px] text-gray-400 font-medium">拍摄活跃度</span>
          </div>
          <MonthlyTimeline monthlyCounts={stats.monthlyCounts} />
        </section>
      )}

      {/* 相机 */}
      {topCamera && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gray-300"><IconCamera /></span>
            <span className="text-[10px] text-gray-400 font-medium">相机</span>
          </div>
          <div className="space-y-1.5">
            {stats.cameras.slice(0, 3).map((item) => (
              <ProportionBar key={item.value} value={item.value} count={item.count} total={stats.totalPhotos} maxWidth={cameraMax} />
            ))}
          </div>
        </section>
      )}

      {/* 焦段 —— 摄影语言 */}
      {topFocal && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gray-300"><IconFocal /></span>
            <span className="text-[10px] text-gray-400 font-medium">焦段</span>
          </div>
          <div className="space-y-1.5">
            {stats.focalLengths.slice(0, 5).map((item) => (
              <ProportionBar key={item.value} value={item.value} count={item.count} total={stats.totalPhotos} maxWidth={focalMax} />
            ))}
          </div>
        </section>
      )}

      {/* 最近拍摄状态 */}
      <section className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">最近</span>
          <span className="text-[11px] text-gray-600">{lastDateStr || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">30 天</span>
          <span className="text-[11px] text-gray-600 tabular-nums">{stats.recentCount} 张</span>
        </div>
      </section>
    </div>
  );
}
