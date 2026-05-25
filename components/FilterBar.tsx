"use client";

/**
 * FilterBar —— 摄影语言筛选 + 时间排序。
 *
 * 只保留相机和镜头两个摄影语言维度。
 * 右侧时间排序 pill 切换最新/最早。
 */

interface Props {
  cameras: string[];
  lenses: string[];
  camera: string | null;
  lens: string | null;
  onCameraChange: (value: string | null) => void;
  onLensChange: (value: string | null) => void;
  onReset: () => void;
  /** 时间排序 */
  sortOrder: "newest" | "oldest";
  onSortChange: (order: "newest" | "oldest") => void;
}

export default function FilterBar({
  cameras,
  lenses,
  camera,
  lens,
  onCameraChange,
  onLensChange,
  onReset,
  sortOrder,
  onSortChange,
}: Props) {
  const hasFilters = camera || lens;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* 左侧：筛选下拉 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 相机 */}
        <div className="relative">
          <select
            value={camera || ""}
            onChange={(e) => onCameraChange(e.target.value || null)}
            className="
              appearance-none bg-white border border-gray-200
              rounded-lg px-3 py-1.5 pr-7
              text-xs text-gray-600
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            <option value="">全部相机</option>
            {cameras.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
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
              rounded-lg px-3 py-1.5 pr-7
              text-xs text-gray-600
              focus:outline-none focus:ring-2 focus:ring-gray-200
              cursor-pointer
            "
          >
            <option value="">全部镜头</option>
            {lenses.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {hasFilters && (
          <button
            onClick={onReset}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            清除
          </button>
        )}
      </div>

      {/* 右侧：时间排序 pill */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-400 mr-1">排序</span>
        {(["newest", "oldest"] as const).map((order) => (
          <button
            key={order}
            onClick={() => onSortChange(order)}
            className={`
              text-[10px] px-2.5 py-1 rounded-full transition-colors
              ${
                sortOrder === order
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }
            `}
          >
            {order === "newest" ? "最新" : "最早"}
          </button>
        ))}
      </div>
    </div>
  );
}
