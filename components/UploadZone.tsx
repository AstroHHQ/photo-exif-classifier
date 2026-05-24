"use client";

/**
 * 照片上传组件 —— 拖拽 + 点击上传（支持多文件）。
 *
 * 状态机: idle → dragging → uploading → success | error
 *
 * Apple Photos 极简风格：
 * - 大的虚线矩形居中
 * - 浅灰底色，hover 时略微加深
 * - 拖入时蓝色高亮边框
 */

import { useState, useRef, useCallback, useEffect } from "react";

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

type UploadTarget = "homepage" | "new" | "existing";

interface CollectionOption {
  id: number;
  title: string;
}

interface Props {
  /** 是否显示上传目标选择器 */
  showTargetSelector?: boolean;
}

export default function UploadZone({ showTargetSelector = false }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传目标选择
  const [targetType, setTargetType] = useState<UploadTarget>("homepage");
  const [newTitle, setNewTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);

  // 获取已有摄影集列表
  useEffect(() => {
    if (!showTargetSelector) return;
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data: CollectionOption[]) => setCollections(data))
      .catch(console.error);
  }, [showTargetSelector]);

  /** 批量上传文件 */
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (files.length === 0) return;

    // 过滤掉不支持的文件类型
    const validFiles = Array.from(files).filter((f) => {
      const ext = "." + f.type.replace("image/", "");
      return f.type.startsWith("image/") && ACCEPT.includes(ext);
    });

    if (validFiles.length === 0) {
      setErrorMsg("只支持 JPG/JPEG/PNG 格式");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      validFiles.forEach((f) => formData.append("file", f));

      // 上传目标
      if (targetType === "new" && newTitle.trim()) {
        console.log("[UploadZone] appending newCollectionTitle:", newTitle.trim());
        formData.append("newCollectionTitle", newTitle.trim());
      } else if (targetType === "existing" && selectedCollectionId) {
        console.log("[UploadZone] appending collectionId:", selectedCollectionId);
        formData.append("collectionId", String(selectedCollectionId));
      } else {
        console.log("[UploadZone] uploading to homepage (no collection target)");
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "上传失败");
      }

      setResults(
        data.photos.map((p: any) => ({
          id: p.id,
          original_name: p.original_name,
          exif: {
            cameraModel: p.cameraModel,
            lensModel: p.lensModel,
            focalLength: p.focalLength,
            iso: p.iso,
            aperture: p.aperture,
            shutterSpeed: p.shutterSpeed,
            dateTaken: p.dateTaken,
          },
        }))
      );
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "上传失败，请重试");
      setStatus("error");
    }
  }, [targetType, newTitle, selectedCollectionId]);

  // 拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus("dragging");
  };
  const handleDragLeave = () => setStatus("idle");
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  // 点击选择文件
  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  // 重置
  const handleReset = () => {
    setStatus("idle");
    setResults([]);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ---- 上传目标选择器 ---- */}
      {showTargetSelector && status === "idle" && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 mr-1">上传到</span>
          {(["homepage", "new", "existing"] as UploadTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => setTargetType(t)}
              className={`
                text-xs px-3 py-1.5 rounded-full transition-colors
                ${
                  targetType === t
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }
              `}
            >
              {t === "homepage" && "首页"}
              {t === "new" && "新建摄影集"}
              {t === "existing" && "已有摄影集"}
            </button>
          ))}

          {/* 新建摄影集 — 标题输入 */}
          {targetType === "new" && (
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入摄影集名称…"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          )}

          {/* 已有摄影集 — 下拉选择 */}
          {targetType === "existing" && (
            <select
              value={selectedCollectionId || ""}
              onChange={(e) =>
                setSelectedCollectionId(e.target.value ? Number(e.target.value) : null)
              }
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">选择摄影集…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
            multiple
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
              <p className="text-xs text-gray-400">
                或点击选择文件 · JPG / PNG · 支持多张
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- success 状态：显示上传结果列表 ---- */}
      {status === "success" && results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                成功上传 {results.length} 张照片
              </h3>
              <button
                onClick={handleReset}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                继续上传
              </button>
            </div>

            {/* 文件列表 */}
            <ul className="divide-y divide-gray-50">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <span className="text-xs text-gray-700 truncate max-w-[60%]">
                    {r.original_name}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {[
                      r.exif.cameraModel,
                      r.exif.focalLength,
                      r.exif.aperture,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "无 EXIF"}
                  </span>
                </li>
              ))}
            </ul>
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
