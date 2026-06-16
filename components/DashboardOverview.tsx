"use client";

/**
 * DashboardOverview —— 首页 Dashboard 概览。
 *
 * 精简版本，只回答四个问题：
 * 1. 拍了多少？（总数 + 最近 30 天）
 * 2. 用什么拍？（最常用相机 + 镜头名称）
 * 3. 什么时候拍？（GitHub 热力图）
 *
 * 不展示：详细列表、柱状图、百分比、摄影语言分布、演变趋势。
 */

import { useEffect, useState } from "react";

/* ---- 类型 ---- */

interface DailyCount {
  date: string;
  count: number;
}

interface StatsData {
  cameras: { value: string; count: number }[];
  lenses: { value: string; count: number }[];
  totalPhotos: number;
  dailyActivity: DailyCount[];
  lastPhotoDate: string | null;
  recentCount: number;
}

/* ---- icon ---- */

function IconCamera() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h2l1-2h6l1 2h2a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm7 10a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function IconLens() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/* ---- 热力图（精简版，与 StatsPanel 共享逻辑） ---- */

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function heatColor(count: number | null): string {
  if (count === null) return "bg-transparent";
  if (count === 0) return "bg-gray-100";
  if (count <= 2) return "bg-gray-300";
  if (count <= 5) return "bg-gray-500";
  return "bg-gray-800";
}

function MiniHeatmap({ dailyActivity }: { dailyActivity: DailyCount[] }) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  if (!dailyActivity || dailyActivity.length === 0) return null;

  const firstDate = new Date(dailyActivity[0].date);
  const startDay = firstDate.getDay();
  const padded: (DailyCount | null)[] = [
    ...Array(startDay).fill(null),
    ...dailyActivity,
  ];

  const weeks: (DailyCount | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const monthMarkers: { col: number; label: string }[] = [];
  weeks.forEach((week, col) => {
    for (const day of week) {
      if (day) {
        const m = parseInt(day.date.split("-")[1]) - 1;
        const label = MONTH_NAMES[m];
        const last = monthMarkers[monthMarkers.length - 1];
        if (!last || last.label !== label) {
          monthMarkers.push({ col, label });
        }
        break;
      }
    }
  });

  return (
    <div className="relative overflow-x-auto">
      <div className="flex mb-1" style={{ paddingLeft: 20 }}>
        {monthMarkers.map((m, i) => (
          <span
            key={i}
            className="text-[8px] text-gray-400"
            style={{ position: "absolute", left: 20 + m.col * 12 }}
          >
            {m.label}
          </span>
        ))}
        <span className="text-[8px] invisible">Jan</span>
      </div>

      <div className="flex">
        <div className="flex flex-col gap-[2px] mr-1 shrink-0" style={{ marginTop: 2 }}>
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="text-[8px] text-gray-300 leading-none h-2.5 flex items-center">
              {label}
            </span>
          ))}
        </div>

        <div className="flex gap-[2px]">
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-[2px]">
              {week.map((day, row) => {
                if (!day) {
                  return <div key={row} className="w-2.5 h-2.5 rounded-sm bg-transparent" />;
                }
                return (
                  <div
                    key={row}
                    className={`w-2.5 h-2.5 rounded-sm ${heatColor(day.count)}`}
                    onMouseEnter={(e) => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ date: day.date, count: day.count, x: rect.left + 5, y: rect.top - 24 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translateX(-50%)" }}
        >
          {tooltip.date} · {tooltip.count} 张
        </div>
      )}
    </div>
  );
}

/* ---- 统计数字 ---- */

function StatFigure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-light text-gray-800 tabular-nums">{value}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}

/* ---- 主组件 ---- */

export default function DashboardOverview() {
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
      <div className="flex justify-center py-12">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || stats.totalPhotos === 0) return null;

  const topCamera = stats.cameras[0];
  const topLens = stats.lenses[0];

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
      {/* 核心数字 */}
      <div className="flex items-center gap-6">
        <StatFigure value={stats.totalPhotos.toLocaleString()} label="张照片" />
        <StatFigure value={stats.recentCount.toLocaleString()} label="近 30 天" />
      </div>

      {/* 设备摘要 */}
      <div className="flex items-center gap-4 text-[11px]">
        {topCamera && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="text-gray-300"><IconCamera /></span>
            <span className="text-gray-400">相机</span>
            <span>{topCamera.value.trim()}</span>
          </div>
        )}
        {topLens && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="text-gray-300"><IconLens /></span>
            <span className="text-gray-400">镜头</span>
            <span>{topLens.value.trim()}</span>
          </div>
        )}
      </div>

      {/* 活跃度热力图 */}
      {stats.dailyActivity.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-400 mb-2">拍摄活跃度</div>
          <MiniHeatmap dailyActivity={stats.dailyActivity} />
        </div>
      )}
    </div>
  );
}
