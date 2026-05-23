"use client";

/**
 * FilterBar —— 照片筛选栏。
 *
 * 四个下拉选择器：相机 / 镜头 / 光圈 / ISO。
 * 选中后即时生效，可单独清除或一键重置。
 */

import type { FilterOptions, Filters } from "@/lib/stats";

interface Props {
  options: FilterOptions;
  filters: Filters;
  onChange: (key: keyof Filters, value: string | null) => void;
  onReset: () => void;
}

/** 下拉配置 */
const FIELDS: { key: keyof Filters; label: string }[] = [
  { key: "camera", label: "相机" },
  { key: "lens", label: "镜头" },
  { key: "aperture", label: "光圈" },
  { key: "iso", label: "ISO" },
];

export default function FilterBar({ options, filters, onChange, onReset }: Props) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {FIELDS.map(({ key, label }) => {
        const values =
          key === "camera"
            ? options.cameras
            : key === "lens"
              ? options.lenses
              : key === "aperture"
                ? options.apertures
                : options.isos;
        const current = filters[key];

        return (
          <div key={key} className="relative">
            <select
              value={current || ""}
              onChange={(e) => onChange(key, e.target.value || null)}
              className="
                appearance-none bg-white border border-gray-200
                rounded-lg px-3 py-2 pr-8
                text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-gray-200
                cursor-pointer
              "
            >
              <option value="">全部{label}</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </div>
        );
      })}

      {hasFilters && (
        <button
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
