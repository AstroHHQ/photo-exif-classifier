"use client";

/**
 * 照片上传组件 —— 拖拽 + 点击上传。
 *
 * 状态机: idle → dragging → uploading → success | error
 *
 * Apple Photos 极简风格：
 * - 大的虚线矩形居中
 * - 浅灰底色，hover 时略微加深
 * - 拖入时蓝色高亮边框
 */

import { useState, useRef, useCallback } from "react";

// 允许的文件类型
const ACCEPT = ".jpg,.jpeg,.png";

interface ExifInfo {
  cameraModel: string | null;
  lensModel: string | null;
  focalLength: string | null;
  iso: number | null;
  aperture: string | null;
  shutterSpeed: string | null;
  dateTaken: string | null;
}

interface UploadResult {
  id: number;
  original_name: string;
  exif: ExifInfo;
}

type Status = "idle" | "dragging" | "uploading" | "success" | "error";

export default function UploadZone() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // 本地预览 URL（上传前）
  const [preview, setPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 处理文件上传 */
  const uploadFile = useCallback(async (file: File) => {
    // 校验类型
    if (!file.type.startsWith("image/") || !ACCEPT.includes(file.type.replace("image/", "."))) {
      setErrorMsg("只支持 JPG/JPEG/PNG 格式");
      setStatus("error");
      return;
    }

    // 生成本地预览
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "上传失败");
      }

      setResult({
        id: data.photo.id,
        original_name: data.photo.original_name,
        exif: {
          cameraModel: data.photo.cameraModel,
          lensModel: data.photo.lensModel,
          focalLength: data.photo.focalLength,
          iso: data.photo.iso,
          aperture: data.photo.aperture,
          shutterSpeed: data.photo.shutterSpeed,
          dateTaken: data.photo.dateTaken,
        },
      });
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "上传失败，请重试");
      setStatus("error");
    }
  }, []);

  // 拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus("dragging");
  };
  const handleDragLeave = () => setStatus("idle");
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  // 点击选择文件
  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  // 重置，准备下次上传
  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ---- idle / dragging / uploading 状态：显示上传区 ---- */}
      {status !== "success" && status !== "error" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={status === "idle" ? handleClick : undefined}
          className={`
            relative flex flex-col items-center justify-center
            h-64 rounded-2xl border-2 border-dashed
            transition-all duration-200 cursor-pointer select-none
            ${
              status === "dragging"
                ? "border-blue-400 bg-blue-50/50 scale-[1.02]"
                : "border-gray-200 bg-gray-50 hover:bg-gray-100"
            }
            ${status === "uploading" ? "pointer-events-none" : ""}
          `}
        >
          {/* 隐藏的文件选择器 */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />

          {status === "uploading" ? (
            // 上传中
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span className="text-sm text-gray-500">正在读取照片信息…</span>
            </div>
          ) : (
            // 待上传
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              {/* 图标 */}
              <svg
                className={`w-10 h-10 mb-2 ${
                  status === "dragging" ? "text-blue-400" : "text-gray-300"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-sm font-medium text-gray-600">
                {status === "dragging" ? "松开放到这里" : "拖拽照片到此处"}
              </p>
              <p className="text-xs text-gray-400">或点击选择文件 · JPG / PNG</p>
            </div>
          )}
        </div>
      )}

      {/* ---- success 状态：显示上传结果 ---- */}
      {status === "success" && result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 照片预览 */}
          <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt={result.original_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-gray-300 text-sm">无预览</div>
            )}
          </div>

          {/* EXIF 信息卡片 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                上传成功 — {result.original_name}
              </h3>
              <button
                onClick={handleReset}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                继续上传
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <ExifRow label="相机" value={result.exif.cameraModel} />
              <ExifRow label="镜头" value={result.exif.lensModel} />
              <ExifRow label="焦距" value={result.exif.focalLength} />
              <ExifRow label="光圈" value={result.exif.aperture} />
              <ExifRow label="快门" value={result.exif.shutterSpeed} />
              <ExifRow label="ISO" value={result.exif.iso?.toString() ?? null} />
              <ExifRow label="拍摄时间" value={result.exif.dateTaken} />
            </dl>
          </div>
        </div>
      )}

      {/* ---- error 状态 ---- */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-red-100 bg-red-50">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button
            onClick={handleReset}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}

/** EXIF 信息行 —— 单行键值对 */
function ExifRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-50 last:border-0">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-xs text-gray-700 font-medium">{value || "—"}</dd>
    </div>
  );
}
