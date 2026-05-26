"use client";

/**
 * BookViewer —— 摄影集阅读模式。
 *
 * published 状态下以单页翻页方式浏览照片，按 sort_order 顺序。
 * 支持点击按钮和键盘翻页，带简单 fade + slide 动画。
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { PhotoData } from "./PhotoCard";
import { getPhotoUrl } from "@/lib/file";

interface Props {
  photos: PhotoData[];
  title: string;
  version?: number;
  bookRatio?: string;
}

export default function BookViewer({ photos, title, version, bookRatio }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalPages = photos.length;

  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  const goNext = useCallback(() => {
    if (indexRef.current < totalPages - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [totalPages]);

  const goPrev = useCallback(() => {
    if (indexRef.current > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, []);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  const currentPhoto = photos[currentIndex];
  if (!currentPhoto) {
    return (
      <div className="flex justify-center py-20">
        <p className="text-sm text-gray-400">摄影集中暂无照片</p>
      </div>
    );
  }

  const imageUrl = getPhotoUrl(currentPhoto);

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* 顶部栏：标题 + 版本 + 页码 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">{title}</h2>
          {version != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">v{version}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 tabular-nums">
          {currentIndex + 1}&nbsp;/&nbsp;{totalPages}
        </span>
      </div>

      {/* 主区域：照片 + 备注 */}
      <div className="flex-1 flex items-center justify-center relative min-h-0">
        {/* 左翻页按钮 */}
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white/90 shadow-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-20 disabled:cursor-default transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 照片 + 备注（key 驱动 remount 触发入场动画） */}
        <div
          key={currentIndex}
          className="flex flex-col items-center px-6 py-6 max-w-4xl w-full animate-book-fade-in"
        >
          {/* 摄影书页面容器：按 book_ratio 比例，白色背景 */ }
          <div
            className="relative w-full bg-white rounded-lg shadow-sm"
            style={{
              aspectRatio: (bookRatio || "4:5").replace(":", "/"),
              maxHeight: "70vh",
            }}
          >
            <img
              src={imageUrl}
              alt={currentPhoto.original_name}
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
          </div>
          {currentPhoto.note && (
            <p className="mt-5 text-sm text-gray-500 text-center max-w-lg italic leading-relaxed">
              {currentPhoto.note}
            </p>
          )}
        </div>

        {/* 右翻页按钮 */}
        <button
          onClick={goNext}
          disabled={currentIndex >= totalPages - 1}
          className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white/90 shadow-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-20 disabled:cursor-default transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 入场动画定义 */}
      <style>{`
        @keyframes bookFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-book-fade-in {
          animation: bookFadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
