"use client";

/**
 * StatsPanel —— 摄影档案 Dashboard。
 *
 * 五个部分：
 * 1. Photography Activity — 拍摄活跃度（计数卡片 + GitHub 热力图）
 * 2. Camera Usage — 主力相机 Top 3
 * 3. Lens Usage — 主力镜头 Top 5
 * 4. Photography Language Distribution — 垂直柱状图（6 类摄影语言）
 * 5. Photography Evolution — 12 个月摄影语言变化趋势
 *
 * 视觉语言：单色灰度、纯 CSS 实现、无图表库依赖。
 */

import { useEffect, useState } from "react";

/* ---- 类型 ---- */

interface StatItem {
  value: string;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
}

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
  last90Days: number;
  yearlyCount: number;
  timeOfDay: { period: string; count: number }[];
  focalDistribution: FocalDist[];
  monthlyFocalDistribution: MonthlyFocalDist[];
}

/* ---- 极简细线 icon ---- */

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
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
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

function IconTrend() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="16 7 21 7 21 12" />
    </svg>
  );
}

/* ---- 计数卡片 ---- */

function StatCount({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-gray-50 min-w-[64px]">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className="text-lg font-light text-gray-700 tabular-nums">{count.toLocaleString()}</span>
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

  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  return (
    <div className="relative overflow-x-auto">
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
        <span className="text-[9px] invisible">Jan</span>
      </div>

      <div className="flex">
        <div className="flex flex-col gap-[2px] mr-1.5 shrink-0" style={{ marginTop: 2 }}>
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="text-[9px] text-gray-300 leading-none h-3 flex items-center">
              {label}
            </span>
          ))}
        </div>

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

/* ---- 垂直柱状图：摄影语言分布 ---- */

/** 六段摄影语言的灰度色阶（从广到长逐步加深） */
const FOCAL_BAR_COLORS: Record<string, string> = {
  "超广角": "bg-gray-300",
  "广角": "bg-gray-400",
  "标准焦段": "bg-gray-500",
  "中长焦": "bg-gray-600",
  "长焦": "bg-gray-700",
  "超长焦": "bg-gray-800",
};

function VerticalBarChart({ distribution }: { distribution: FocalDist[] }) {
  const maxPct = Math.max(...distribution.map((d) => d.percentage), 1);
  const barMaxH = 100; // 最大柱高 px

  return (
    <div className="flex items-end justify-center gap-3" style={{ height: 160 }}>
      {distribution.map((item) => {
        const h = Math.max((item.percentage / maxPct) * barMaxH, item.percentage > 0 ? 4 : 0);
        return (
          <div key={item.range} className="flex flex-col items-center gap-1" style={{ width: 48 }}>
            {/* 百分比 */}
            <span className="text-[10px] text-gray-500 tabular-nums leading-none">
              {item.percentage}%
            </span>
            {/* 柱体 */}
            <div className="w-full flex flex-col justify-end" style={{ height: barMaxH }}>
              <div
                className={`w-full rounded-sm transition-all duration-500 ${FOCAL_BAR_COLORS[item.range]}`}
                style={{ height: h }}
              />
            </div>
            {/* 标签 */}
            <span className="text-[9px] text-gray-400 leading-tight text-center mt-1">
              {item.range}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 摄影语言演变趋势 ---- */

/** 六段摄影语言在 evolution mini bar 中的灰度 */
const EVO_COLORS: string[] = [
  "bg-gray-300", // 超广角
  "bg-gray-400", // 广角
  "bg-gray-500", // 标准焦段
  "bg-gray-600", // 中长焦
  "bg-gray-700", // 长焦
  "bg-gray-800", // 超长焦
];

function EvolutionTimeline({ monthly }: { monthly: MonthlyFocalDist[] }) {
  if (!monthly || monthly.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1.5" style={{ minWidth: monthly.length * 28 }}>
        {monthly.map((m) => (
          <div key={m.month} className="flex flex-col items-center gap-1" style={{ width: 22 }}>
            {/* 堆叠柱 */}
            <div className="w-full flex flex-col rounded-sm overflow-hidden" style={{ height: 56 }}>
              {m.distribution.map((d, i) => {
                if (d.percentage === 0) return null;
                return (
                  <div
                    key={d.range}
                    className={`w-full transition-all duration-500 ${EVO_COLORS[i]}`}
                    style={{ height: `${d.percentage}%` }}
                    title={`${m.label} ${d.range}: ${d.percentage}%`}
                  />
                );
              })}
            </div>
            {/* 月份标签 */}
            <span className="text-[8px] text-gray-400 leading-none">{m.label}</span>
          </div>
        ))}
      </div>
      {/* 图例 */}
      <div className="flex items-center gap-2 mt-2 justify-center">
        {["超广角", "广角", "标准", "中长焦", "长焦", "超长焦"].map((label, i) => (
          <div key={label} className="flex items-center gap-0.5">
            <div className={`w-2 h-2 rounded-sm ${EVO_COLORS[i]}`} />
            <span className="text-[8px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- 设备占比条 ---- */

function UsageBar({ value, count, total, maxCount }: { value: string; count: number; total: number; maxCount: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-36 text-gray-600 truncate shrink-0">{value}</span>
      <span className="w-8 text-gray-400 shrink-0 tabular-nums text-right">{count}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden">
        <div
          className="h-full bg-gray-400 rounded-sm transition-all duration-500"
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className="w-7 text-gray-400 shrink-0 tabular-nums text-right text-[10px]">{pct}%</span>
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

  const cameraMax = stats.cameras[0]?.count ?? 1;
  const lensMax = stats.lenses[0]?.count ?? 1;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-6">

      {/* ======== Part 1: Photography Activity ======== */}

      <section>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-gray-300"><IconCalendar /></span>
          <span className="text-[10px] text-gray-400 font-medium">拍摄活跃度</span>
        </div>

        {/* 计数卡片 */}
        <div className="flex gap-2 mb-4">
          <StatCount label="30 天" count={stats.recentCount} />
          <StatCount label="90 天" count={stats.last90Days} />
          <StatCount label="本年" count={stats.yearlyCount} />
          <StatCount label="总计" count={stats.totalPhotos} />
        </div>

        {/* 热力图 */}
        {stats.dailyActivity.length > 0 && (
          <ActivityHeatmap dailyActivity={stats.dailyActivity} />
        )}
      </section>

      {/* ======== Part 2: Camera Usage ======== */}

      {stats.cameras.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gray-300"><IconCamera /></span>
            <span className="text-[10px] text-gray-400 font-medium">相机</span>
          </div>
          <div className="space-y-1.5">
            {stats.cameras.slice(0, 3).map((item) => (
              <UsageBar
                key={item.value}
                value={item.value}
                count={item.count}
                total={stats.totalPhotos}
                maxCount={cameraMax}
              />
            ))}
          </div>
        </section>
      )}

      {/* ======== Part 3: Lens Usage ======== */}

      {stats.lenses.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-gray-300"><IconLens /></span>
            <span className="text-[10px] text-gray-400 font-medium">镜头</span>
          </div>
          <div className="space-y-1.5">
            {stats.lenses.slice(0, 5).map((item) => (
              <UsageBar
                key={item.value}
                value={item.value}
                count={item.count}
                total={stats.totalPhotos}
                maxCount={lensMax}
              />
            ))}
          </div>
        </section>
      )}

      {/* ======== Part 4: Photography Language Distribution ======== */}

      {stats.focalDistribution.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-gray-300"><IconFocal /></span>
            <span className="text-[10px] text-gray-400 font-medium">摄影语言分布</span>
            <span className="text-[9px] text-gray-300">35mm 等效</span>
          </div>
          <VerticalBarChart distribution={stats.focalDistribution} />
        </section>
      )}

      {/* ======== Part 5: Photography Evolution ======== */}

      {stats.monthlyFocalDistribution && stats.monthlyFocalDistribution.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-gray-300"><IconTrend /></span>
            <span className="text-[10px] text-gray-400 font-medium">摄影语言演变</span>
            <span className="text-[9px] text-gray-300">过去 12 个月</span>
          </div>
          <EvolutionTimeline monthly={stats.monthlyFocalDistribution} />
        </section>
      )}
    </div>
  );
}
