"use client";

/**
 * CollectionCard —— 摄影集卡片。
 *
 * draft 类型：多张照片堆叠效果，像"待整理素材"
 * curated 类型：封面图为主，像摄影书封面
 */

import type { PhotoData } from "./PhotoCard";
import { getPhotoUrl } from "@/lib/file";

/**
 * 基于 photo.id 生成可复现的伪随机偏移。
 * 使用 Knuth 乘法哈希，确保同一张照片每次渲染结果一致。
 *
 * 散落感的来源是每张照片有不同的锚点位置（top/left），而非仅 transform。
 * 之前无效的根因：所有照片共享 top:6%/left:6%，rotate + translate 从同一原点
 * 出发，视觉上几乎完全重叠。
 */
function getScatterTransform(
  id: number
): { rotate: number; topPct: number; leftPct: number } {
  const h = (id * 2654435761) >>> 0; // 32-bit Knuth hash
  const r1 = ((h >>> 16) & 0xffff) / 0xffff; // 0~1
  const r2 = ((h >>> 8) & 0xffff) / 0xffff;
  const r3 = (h & 0xffff) / 0xffff;

  return {
    rotate: (r1 - 0.5) * 22,    // -11deg ~ 11deg
    topPct: 2 + r2 * 16,        // 2% ~ 18%
    leftPct: 2 + r3 * 16,       // 2% ~ 18%
  };
}

/** 根据进度百分比返回进度条颜色 */
function getProgressColor(progress: number): string {
  if (progress <= 0.2) return "bg-red-400";
  if (progress <= 0.4) return "bg-orange-400";
  if (progress <= 0.6) return "bg-yellow-400";
  if (progress <= 0.8) return "bg-emerald-400";
  return "bg-green-400";
}

interface ProgressData {
  total: number;
  noted: number;
  sorted: number;
  progress: number; // 0 ~ 1
}

interface Props {
  id: number;
  title: string;
  status: "draft" | "ready" | "published";
  coverPhotoId: number | null;
  previewPhotos: PhotoData[];
  photoCount: number;
  progress?: ProgressData;
  version?: number;
  onClick: () => void;
}

export default function CollectionCard({
  title,
  status,
  coverPhotoId,
  previewPhotos,
  photoCount,
  progress,
  version,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      className="
        break-inside-avoid mb-6 cursor-pointer
        bg-white rounded-xl border border-gray-100
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        overflow-hidden
      "
    >
      {status === "draft" ? (
        /* ---- draft：散落照片（contact sheet 风格） ---- */
        <div className="relative bg-gray-50 p-6 aspect-[3/2]">
          {previewPhotos.length === 0 ? (
            <div className="absolute inset-6 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">暂无照片</span>
            </div>
          ) : (
            <>
              <div
                className="absolute w-[80%] h-[80%] bg-gray-200/60 rounded-lg"
                style={{ top: "8%", left: "10%", zIndex: 0 }}
              />
              {previewPhotos.slice(0, 3).map((photo, i) => {
                const t = getScatterTransform(photo.id);
                return (
                  <img
                    key={photo.id}
                    src={getPhotoUrl(photo)}
                    alt=""
                    className="absolute object-cover rounded-lg border border-white/80 shadow-md"
                    style={{
                      top: `${t.topPct}%`,
                      left: `${t.leftPct}%`,
                      width: "78%",
                      height: "78%",
                      transform: `rotate(${t.rotate}deg)`,
                      zIndex: 3 - i,
                    }}
                  />
                );
              })}
            </>
          )}
        </div>
      ) : status === "ready" ? (
        /* ---- ready：规整堆叠 ---- */
        <div className="relative bg-gray-50 p-4 pb-2">
          {previewPhotos.length === 0 && (
            <div className="aspect-[3/2] bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">暂无照片</span>
            </div>
          )}
          {previewPhotos.length > 0 && (
            <div className="relative aspect-[3/2]">
              {previewPhotos.slice(0, 3).map((photo, i) => (
                <img
                  key={photo.id}
                  src={getPhotoUrl(photo)}
                  alt=""
                  className={`
                    absolute inset-0 w-full h-full object-cover rounded-lg
                    border border-white/80 shadow-sm
                  `}
                  style={{
                    transform: `translate(${i * 6}px, ${i * 6}px)`,
                    zIndex: 3 - i,
                  }}
                />
              ))}
              <div
                className="absolute inset-0 bg-gray-200 rounded-lg"
                style={{
                  transform: `translate(${Math.min(previewPhotos.length, 3) * 6}px, ${Math.min(previewPhotos.length, 3) * 6}px)`,
                  zIndex: 0,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* ---- curated：封面图 ---- */
        <div className="relative bg-gray-50">
          {coverPhotoId ? (
            <img
              src={`/api/photos/${coverPhotoId}/file`}
              alt={title}
              className="w-full aspect-[4/3] object-cover"
            />
          ) : previewPhotos.length > 0 ? (
            <img
              src={getPhotoUrl(previewPhotos[0])}
              alt={title}
              className="w-full aspect-[4/3] object-cover"
            />
          ) : (
            <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
              <span className="text-xs text-gray-400">暂无封面</span>
            </div>
          )}
        </div>
      )}

      {/* 底部信息 */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-800 truncate">
            {title || "未命名摄影集"}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {photoCount} 张照片
          </p>
          {/* 进度条（draft / ready 显示） */}
          {status !== "published" && progress && progress.total > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[9px] text-gray-400 mb-0.5">
                <span>
                  备注 {progress.noted}/{progress.total} · 排序 {progress.sorted}/{progress.total}
                </span>
                <span>{Math.round(progress.progress * 100)}%</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getProgressColor(progress.progress)}`}
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <span
          className={`
            text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2
            ${status === "draft" ? "bg-amber-50 text-amber-600" : ""}
            ${status === "ready" ? "bg-blue-50 text-blue-600" : ""}
            ${status === "published" ? "bg-green-50 text-green-600" : ""}
          `}
        >
          {status === "draft" && "待整理"}
          {status === "ready" && "可发布"}
          {status === "published" && "已发布"}
        </span>
        {status === "published" && version != null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-1 bg-gray-50 text-gray-400">
            v{version}
          </span>
        )}
      </div>
    </div>
  );
}
