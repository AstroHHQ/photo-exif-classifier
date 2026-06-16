"use client";

/**
 * FilterBar —— 首页照片筛选系统。
 *
 * 筛选维度：相机 · 镜头 · 时间 · 焦段区间 · 备注状态 · 关键词搜索
 * 排序：拍摄时间 / 导入时间
 *
 * 设计原则：首页负责找照片，Analytics 负责分析照片。
 * 不包含 ISO、光圈、快门等分析维度。
 */

import { useState } from "react";

/* ---- 类型 ---- */

export type TimePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "year-select"
  | "custom";

export interface TimeFilter {
  preset: TimePreset;
  year: number | null;
  from: string | null; // "YYYY-MM-DD"
  to: string | null;
}

export type SortOrder = "date_desc" | "date_asc" | "imported_desc" | "imported_asc";
export type NoteFilter = "all" | "has" | "none";

interface Props {
  cameras: string[];
  lenses: string[];
  focalRanges: { range: string; mm: string }[];
  camera: string | null;
  lens: string | null;
  focalRange: string | null;
  noteStatus: NoteFilter;
  time: TimeFilter;
  searchQuery: string;
  sortOrder: SortOrder;
  onCameraChange: (value: string | null) => void;
  onLensChange: (value: string | null) => void;
  onFocalRangeChange: (value: string | null) => void;
  onNoteStatusChange: (value: NoteFilter) => void;
  onTimeChange: (time: TimeFilter) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (order: SortOrder) => void;
  onReset: () => void;
  /** 多选模式（预留） */
  selectionMode?: boolean;
  onToggleSelection?: () => void;
}

/* ---- 常量 ---- */

const TIME_PILLS: { value: TimePreset; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "today", label: "今天" },
  { value: "week", label: "7 天" },
  { value: "month", label: "30 天" },
  { value: "quarter", label: "90 天" },
  { value: "year", label: "本年" },
  { value: "year-select", label: "年份" },
  { value: "custom", label: "自定义" },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "date_desc", label: "拍摄时间 新→旧" },
  { value: "date_asc", label: "拍摄时间 旧→新" },
  { value: "imported_desc", label: "导入时间 新→旧" },
  { value: "imported_asc", label: "导入时间 旧→新" },
];

const NOTE_OPTIONS: { value: NoteFilter; label: string }[] = [
  { value: "all", label: "全部备注" },
  { value: "has", label: "有备注" },
  { value: "none", label: "无备注" },
];

/* ---- 年份列表 ---- */

function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= 2000; y--) years.push(y);
  return years;
}

/* ---- 组件 ---- */

export default function FilterBar({
  cameras, lenses, focalRanges,
  camera, lens, focalRange, noteStatus, time, searchQuery, sortOrder,
  onCameraChange, onLensChange, onFocalRangeChange, onNoteStatusChange,
  onTimeChange, onSearchChange, onSortChange, onReset,
  selectionMode, onToggleSelection,
}: Props) {
  const hasFilters = camera || lens || focalRange || noteStatus !== "all" || time.preset !== "all" || searchQuery;

  const [showCustomDate, setShowCustomDate] = useState(time.preset === "custom");
  const [showYearSelect, setShowYearSelect] = useState(time.preset === "year-select");

  const handleTimePreset = (preset: TimePreset) => {
    setShowCustomDate(preset === "custom");
    setShowYearSelect(preset === "year-select");
    if (preset === "custom") {
      onTimeChange({ preset, year: null, from: time.from || "", to: time.to || "" });
    } else if (preset === "year-select") {
      onTimeChange({ preset, year: time.year || new Date().getFullYear(), from: null, to: null });
    } else {
      onTimeChange({ preset, year: null, from: null, to: null });
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Row 1: 搜索 + 排序 + 选择 */}
      <div className="flex items-center gap-2">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索文件名或备注…"
            className="
              w-full pl-7 pr-3 py-1.5
              text-[11px] text-gray-600
              bg-white border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-gray-200
              placeholder-gray-300
            "
          />
        </div>

        {/* 排序 */}
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            className="
              appearance-none bg-white border border-gray-200
              rounded-lg pl-2.5 pr-6 py-1.5
              text-[10px] text-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* 选择模式 */}
        {onToggleSelection && (
          <button
            onClick={onToggleSelection}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${
              selectionMode
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {selectionMode ? "完成" : "选择"}
          </button>
        )}
      </div>

      {/* Row 2: 时间 + 设备 + 焦段 + 备注 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 时间快捷筛选 */}
        <div className="flex items-center gap-1">
          {TIME_PILLS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleTimePreset(p.value)}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                time.preset === p.value
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 分隔 */}
        <span className="w-px h-4 bg-gray-200 shrink-0" />

        {/* 相机 */}
        <div className="relative">
          <select
            value={camera || ""}
            onChange={(e) => onCameraChange(e.target.value || null)}
            className="
              appearance-none bg-white border border-gray-200
              rounded-lg pl-2.5 pr-6 py-1
              text-[10px] text-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            <option value="">全部相机</option>
            {cameras.map((v) => (
              <option key={v} value={v}>{v.trim()}</option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* 镜头 */}
        <div className="relative">
          <select
            value={lens || ""}
            onChange={(e) => onLensChange(e.target.value || null)}
            className="
              appearance-none bg-white border border-gray-200
              rounded-lg pl-2.5 pr-6 py-1
              text-[10px] text-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            <option value="">全部镜头</option>
            {lenses.map((v) => (
              <option key={v} value={v}>{v.trim()}</option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* 焦段 */}
        <div className="relative">
          <select
            value={focalRange || ""}
            onChange={(e) => onFocalRangeChange(e.target.value || null)}
            className="
              appearance-none bg-white border border-gray-200
              rounded-lg pl-2.5 pr-6 py-1
              text-[10px] text-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            <option value="">全部焦段</option>
            {focalRanges.map((r) => (
              <option key={r.range} value={r.range}>{r.range} ({r.mm})</option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* 备注状态 */}
        <div className="flex items-center gap-1">
          {NOTE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onNoteStatusChange(opt.value)}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                noteStatus === opt.value
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 清除 */}
        {hasFilters && (
          <button
            onClick={onReset}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors ml-1"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Row 3: 自定义日期范围（条件显示） */}
      {showCustomDate && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">日期范围</span>
          <input
            type="date"
            value={time.from || ""}
            onChange={(e) => onTimeChange({ ...time, from: e.target.value || null })}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <span className="text-[10px] text-gray-300">至</span>
          <input
            type="date"
            value={time.to || ""}
            onChange={(e) => onTimeChange({ ...time, to: e.target.value || null })}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      )}

      {/* Row 3 alt: 年份选择（条件显示） */}
      {showYearSelect && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">选择年份</span>
          <select
            value={time.year || new Date().getFullYear()}
            onChange={(e) => onTimeChange({ ...time, year: parseInt(e.target.value) })}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {getYearOptions().map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
