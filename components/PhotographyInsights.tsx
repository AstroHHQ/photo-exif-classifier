"use client";

/**
 * PhotographyInsights — 摄影习惯分析卡片。
 *
 * 用规则引擎从 EXIF 统计数据中生成 3-5 条观察结果。
 * 复用现有 /api/stats，不新增数据库查询。
 *
 * 风格参考：Apple Photos 年度回顾 / Notion 卡片
 * 禁止：营销文案、ChatGPT 对话风格
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

interface TimeOfDayCount {
  period: "上午" | "下午" | "傍晚" | "夜晚";
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
  timeOfDay: TimeOfDayCount[];
  focalDistribution: FocalDist[];
  monthlyFocalDistribution: MonthlyFocalDist[];
}

interface Insight {
  id: string;
  label: string;
  headline: string;
  detail: string;
}

/* ---- 规则引擎 ---- */

/** 从光圈字符串提取 f-number，如 "f/2.8" → 2.8 */
function parseFNumber(aperture: string): number | null {
  const m = aperture.match(/f\/?(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return parseFloat(m[1]);
}

/** 判断是否为"未知"或空值 */
function isUnknown(val: string): boolean {
  return !val || val === "未知";
}

/** 清理 EXIF 值中的尾部空格 */
function clean(val: string): string {
  return val.trim();
}

/** 摄影语言倾向描述 */
const FOCAL_LANGUAGE: Record<string, string> = {
  "超广角": "你的拍摄明显偏向超广角叙事（{pct}%），强调空间张力和视觉冲击感。",
  "广角": "最近你的拍摄明显偏向广角叙事摄影（{pct}%），构图习惯更强调环境与空间关系。",
  "标准焦段": "你主要使用标准焦段拍摄（{pct}%），视角接近人眼，注重构图本身而非镜头特性。",
  "中长焦": "最近偏好中长焦拍摄（{pct}%），善于压缩空间、突出主体。",
  "长焦": "你的拍摄明显偏向长焦（{pct}%），善于远距离捕捉和空间压缩。",
  "超长焦": "你在使用超长焦拍摄（{pct}%），专注于远距离主体和极致空间压缩。",
};

/** 规则 1: 摄影语言倾向（基于 35mm 等效焦段分布） */
function ruleFocalLanguage(stats: StatsData): Insight | null {
  if (!stats.focalDistribution || stats.focalDistribution.length === 0) return null;
  const top = stats.focalDistribution.reduce((a, b) => (a.count > b.count ? a : b));
  if (top.count === 0 || top.percentage < 25) return null;
  const template = FOCAL_LANGUAGE[top.range];
  if (!template) return null;

  return {
    id: "focal",
    label: "摄影语言倾向",
    headline: template.replace("{pct}", String(top.percentage)),
    detail: `${top.range}（${top.mm}）占所有照片的 ${top.percentage}%`,
  };
}

/** 规则 2: 光圈习惯 */
function ruleAperture(stats: StatsData): Insight | null {
  let wideCount = 0;
  let validTotal = 0;
  for (const item of stats.apertures) {
    if (isUnknown(item.value)) continue;
    const f = parseFNumber(item.value);
    if (f === null) continue;
    validTotal += item.count;
    if (f <= 2.8) wideCount += item.count;
  }
  if (validTotal === 0) return null;
  const pct = Math.round((wideCount / validTotal) * 100);
  if (pct < 60) return null;

  return {
    id: "aperture",
    label: "光圈习惯",
    headline: "你长期依赖大光圈营造氛围感。",
    detail: `f/2.8 及更大光圈占 ${pct}%`,
  };
}

/** 规则 3: 拍摄时间 */
function ruleTimeOfDay(stats: StatsData): Insight | null {
  const top = stats.timeOfDay[0];
  if (!top || top.count === 0) return null;
  const pct = stats.totalPhotos > 0 ? Math.round((top.count / stats.totalPhotos) * 100) : 0;

  const labels: Record<string, string> = {
    "上午": "你偏爱在上午出门拍摄。",
    "下午": "你最常在下午进行拍摄。",
    "傍晚": "你最常在傍晚进行拍摄。",
    "夜晚": "你是一位夜间拍摄者。",
  };

  return {
    id: "timeofday",
    label: "拍摄时段",
    headline: labels[top.period] || `你最常在${top.period}进行拍摄。`,
    detail: `占所有照片的 ${pct}%`,
  };
}

/** 规则 4: 主力设备 */
function ruleCamera(stats: StatsData): Insight | null {
  const top = stats.cameras[0];
  if (!top || isUnknown(top.value)) return null;
  const pct = stats.totalPhotos > 0 ? Math.round((top.count / stats.totalPhotos) * 100) : 0;
  if (pct < 40) return null;

  return {
    id: "camera",
    label: "主力设备",
    headline: `${clean(top.value)} 已成为你的主要创作设备。`,
    detail: `占所有照片的 ${pct}%`,
  };
}

/** 规则 5: 拍摄节奏（最近 30 天） */
function ruleRhythm(stats: StatsData): Insight | null {
  if (stats.recentCount === 0) return null;
  const daysWithPhotos = new Set(
    stats.dailyActivity
      .filter((d) => d.count > 0)
      .map((d) => d.date)
  ).size;
  const avgPerDay = daysWithPhotos > 0 ? (stats.recentCount / daysWithPhotos).toFixed(1) : "0";

  if (stats.recentCount >= 30) {
    return {
      id: "rhythm",
      label: "拍摄节奏",
      headline: "最近 30 天你保持高频率拍摄，创作状态活跃。",
      detail: `共 ${stats.recentCount} 张 · 日均 ${avgPerDay} 张`,
    };
  }
  if (stats.recentCount >= 10) {
    return {
      id: "rhythm",
      label: "拍摄节奏",
      headline: "你保持着稳定的拍摄节奏。",
      detail: `最近 30 天拍摄 ${stats.recentCount} 张`,
    };
  }
  return null;
}

/** 规则 6: 摄影语言演变（比较最近 3 个月 vs 整体分布） */
function ruleFocalEvolution(stats: StatsData): Insight | null {
  const monthly = stats.monthlyFocalDistribution;
  if (!monthly || monthly.length < 3) return null;
  if (!stats.focalDistribution || stats.focalDistribution.length === 0) return null;

  // 最近 3 个月的平均分布
  const recent = monthly.slice(-3);
  const recentAvg: Record<string, number> = {};
  const rangeNames = stats.focalDistribution.map((d) => d.range);
  for (const r of rangeNames) recentAvg[r] = 0;
  for (const m of recent) {
    for (const d of m.distribution) {
      recentAvg[d.range] += d.percentage / 3;
    }
  }

  // 找到降幅最大和涨幅最大的范围
  let maxDrop = 0, maxRise = 0;
  let dropRange = "", riseRange = "";
  for (const r of rangeNames) {
    const overall = stats.focalDistribution.find((d) => d.range === r)?.percentage || 0;
    const shift = Math.round((recentAvg[r] || 0) - overall);
    if (shift < maxDrop) { maxDrop = shift; dropRange = r; }
    if (shift > maxRise) { maxRise = shift; riseRange = r; }
  }

  // 需要至少 10pp 的变化
  if (Math.abs(maxDrop) < 10 && Math.abs(maxRise) < 10) return null;

  // 构建自然语言描述
  const narratives: Record<string, string> = {
    "广角": "广角叙事",
    "标准焦段": "纪实观察",
    "中长焦": "主体表达",
    "长焦": "远距离观察",
    "超广角": "空间张力探索",
    "超长焦": "极致细节捕捉",
  };

  let headline = "";
  if (dropRange && riseRange && Math.abs(maxDrop) >= 10 && maxRise >= 10) {
    const from = narratives[dropRange] || dropRange;
    const to = narratives[riseRange] || riseRange;
    headline = `你的摄影语言正从${from}逐渐转向${to}。`;
  } else if (riseRange && maxRise >= 10) {
    const to = narratives[riseRange] || riseRange;
    headline = `${riseRange}占比持续增加（+${maxRise}%），最近更关注${to}。`;
  } else if (dropRange && Math.abs(maxDrop) >= 10) {
    headline = `${dropRange}占比持续下降（${maxDrop}%），拍摄风格正在转变。`;
  } else {
    return null;
  }

  const parts: string[] = [];
  if (dropRange && Math.abs(maxDrop) >= 8) parts.push(`${dropRange} ${maxDrop}%`);
  if (riseRange && maxRise >= 8) parts.push(`${riseRange} +${maxRise}%`);

  return {
    id: "focal-evolution",
    label: "摄影语言演变",
    headline,
    detail: `最近 3 个月 vs 整体 · ${parts.join("，")}`,
  };
}

/** 运行所有规则，返回适用的洞察 */
function runRules(stats: StatsData): Insight[] {
  const rules = [ruleFocalLanguage, ruleAperture, ruleTimeOfDay, ruleCamera, ruleRhythm, ruleFocalEvolution];
  const results: Insight[] = [];
  for (const rule of rules) {
    const insight = rule(stats);
    if (insight) results.push(insight);
  }
  return results.slice(0, 5);
}

/* ---- icon ---- */

function IconSparkle() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

/* ---- 洞察条目 ---- */

function InsightRow({ insight, index }: { insight: Insight; index: number }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-[10px] text-gray-300 tabular-nums mt-0.5 shrink-0 w-4 text-right">
        {index + 1}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-gray-700 leading-relaxed">{insight.headline}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{insight.detail}</p>
      </div>
    </div>
  );
}

/* ---- 主组件 ---- */

export default function PhotographyInsights() {
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
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!stats || stats.totalPhotos === 0) return null;

  const insights = runRules(stats);
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
      {/* 标题区 */}
      <div className="flex items-center gap-2">
        <span className="text-gray-300"><IconSparkle /></span>
        <span className="text-xs text-gray-400 font-medium">摄影习惯</span>
        <span className="text-[10px] text-gray-300">基于所有照片自动生成</span>
      </div>

      {/* 洞察列表 */}
      <div className="space-y-3 pt-1">
        {insights.map((insight, i) => (
          <InsightRow key={insight.id} insight={insight} index={i} />
        ))}
      </div>

      {/* 底部规则引擎标识 */}
      <div className="pt-2 border-t border-gray-50 flex items-center gap-1.5">
        <span className="text-[9px] text-gray-300">规则引擎生成</span>
        <span className="text-[9px] text-gray-200">·</span>
        <span className="text-[9px] text-gray-300">非 AI</span>
      </div>
    </div>
  );
}
