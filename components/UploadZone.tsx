"use client";

/**
 * 照片上传组件 —— 轻量摄影工具栏。
 *
 * 不再是页面视觉中心，而是紧凑的工具入口。
 * 状态机: idle → dragging → uploading → success | error
 */

import { useState, useRef, useCallback, useEffect } from "react";

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
  showTargetSelector?: boolean;
}

export default function UploadZone({ showTargetSelector = false }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [targetType, setTargetType] = useState<UploadTarget>("homepage");
  const [newTitle, setNewTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);

  useEffect(() => {
    if (!showTargetSelector) return;
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data: CollectionOption[]) => setCollections(data))
      .catch(console.error);
  }, [showTargetSelector]);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (files.length === 0) return;

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

      if (targetType === "new" && newTitle.trim()) {
        formData.append("newCollectionTitle", newTitle.trim());
      } else if (targetType === "existing" && selectedCollectionId) {
        formData.append("collectionId", String(selectedCollectionId));
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus("dragging");
  };
  const handleDragLeave = () => setStatus("idle");
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleReset = () => {
    setStatus("idle");
    setResults([]);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full">
      {/* 目标选择器 */}
      {showTargetSelector && status === "idle" && (
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 mr-0.5">上传到</span>
          {(["homepage", "new", "existing"] as UploadTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => setTargetType(t)}
              className={`
                text-[10px] px-2.5 py-1 rounded-full transition-colors
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

          {targetType === "new" && (
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="摄影集名称…"
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          )}

          {targetType === "existing" && (
            <select
              value={selectedCollectionId || ""}
              onChange={(e) =>
                setSelectedCollectionId(e.target.value ? Number(e.target.value) : null)
              }
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-200"
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

      {/* idle / dragging / uploading */}
      {status !== "success" && status !== "error" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={status === "idle" ? handleClick : undefined}
          className={`
            relative flex items-center justify-center
            h-20 rounded-xl border
            transition-all duration-200 cursor-pointer select-none
            ${
              status === "dragging"
                ? "border-blue-400 bg-blue-50/60"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }
            ${status === "uploading" ? "pointer-events-none" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {status === "uploading" ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-500">读取中…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg
                className="w-4 h-4 text-gray-300"
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
              <span>导入照片</span>
              <span className="text-gray-300">—</span>
              <span>拖拽到此处</span>
            </div>
          )}
        </div>
      )}

      {/* success */}
      {status === "success" && results.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-700">
                已上传 {results.length} 张
              </span>
              <button
                onClick={handleReset}
                className="text-[10px] text-blue-500 hover:text-blue-600 transition-colors"
              >
                继续上传
              </button>
            </div>
            <ul className="divide-y divide-gray-50">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0"
                >
                  <span className="text-[11px] text-gray-600 truncate max-w-[60%]">
                    {r.original_name}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0">
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

      {/* error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-red-100 bg-red-50">
          <p className="text-xs text-red-600">{errorMsg}</p>
          <button
            onClick={handleReset}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
