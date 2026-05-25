"use client";

/**
 * StatsPanel —— 摄影档案可视化。
 *
 * GitHub contribution 风格热力图展示拍摄活跃度。
 * 视觉语言：单色灰度、细线 icon、横向占比条。
 */

import { useEffect, useState } from "react";

interface StatItem {
  value: string;
  count: number;
}

interface DailyCount {
  date: string;
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
  dailyActivity: DailyCount[];
  lastPhotoDate: string | null;
  recentCount: number;
}

/* ---- 极简细线 icon ---- */

function IconCamera() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h2l1-2h6l1 2h2a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm7 10a4 4 0 100-8 4 4 0 000 8z" />
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

/* ---- 热力图颜色映射 ---- */

function heatColor(count: number | null): string {
  if (count === null) return "bg-transparent";
  if (count === 0) return "bg-gray-100";
  if (count <= 2) return "bg-gray-300";
  if (count <= 5) return "bg-gray-500";
  return "bg-gray-800";
}

/* ---- 活跃度热力图（GitHub contribution 风格） ---- */

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ActivityHeatmap({ dailyActivity }: { dailyActivity: DailyCount[] }) {
  // 补齐开头到 Sunday
  const firstDate = new Date(dailyActivity[0].date);
  const startDay = firstDate.getDay(); // 0=Sun
  const padded: (DailyCount | null)[] = [
    ...Array(startDay).fill(null),
    ...dailyActivity,
  ];

  // 按周分组（每 7 天）
  const weeks: (DailyCount | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // 月份标签：记录每个月份首次出现的列索引
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

  // 当前 hover 的 tooltip
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  return (
    <div className="relative overflow-x-auto">
      {/* 月份标签行 */}
      <div className="flex mb-1" style={{ paddingLeft: 28 }}>
        {monthMarkers.map((m, i) => (
          <span
            key={i}
            className="text-[9px] text-gray-400"
            style={{ position: "absolute", left: 28 + m.col * 14 }}
          >
            {m.label}
          </span>
        ))}
        {/* 隐形占位让容器有高度 */}
        <span className="text-[9px] invisible">Jan</span>
      </div>

      {/* 热力图主体 */}
      <div className="flex">
        {/* 星期标签列 */}
        <div className="flex flex-col gap-[2px] mr-1.5 shrink-0" style={{ marginTop: 2 }}>
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="text-[9px] text-gray-300 leading-none h-3 flex items-center">
              {label}
            </span>
          ))}
        </div>

        {/* 格子列 */}
        <div className="flex gap-[2px]">
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-[2px]">
              {week.map((day, row) => {
                if (!day) {
                  return <div key={row} className="w-3 h-3 rounded-sm bg-transparent" />;
                }
                return (
                  <div
                    key={row}
                    className={`w-3 h-3 rounded-sm ${heatColor(day.count)}`}
                    onMouseEnter={(e) => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ date: day.date, count: day.count, x: rect.left + 6, y: rect.top - 28 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translateX(-50%)" }}
        >
          {tooltip.date} · {tooltip.count} 张
        </div>
      )}
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

      {/* 活跃度热力图 */}
      {stats.dailyActivity.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-gray-300"><IconCalendar /></span>
            <span className="text-[10px] text-gray-400 font-medium">拍摄活跃度</span>
          </div>
          <ActivityHeatmap dailyActivity={stats.dailyActivity} />
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

      {/* 焦段 */}
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
