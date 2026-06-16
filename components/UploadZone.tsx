"use client";

/**
 * 照片上传组件 —— 轻量摄影工具栏。
 *
 * 支持：拖拽上传、文件多选、文件夹导入、分批上传 (>50张自动分批)。
 * 状态机: idle → dragging → uploading → success | error
 */

import { useState, useRef, useCallback, useEffect } from "react";

const ACCEPT = ".jpg,.jpeg,.png";
const BATCH_SIZE = 50;

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

interface UploadProgress {
  currentBatch: number;
  totalBatches: number;
  uploadedCount: number;
  totalCount: number;
}

type Status = "idle" | "dragging" | "uploading" | "success" | "error";
type UploadTarget = "homepage" | "new" | "existing";
type StorageMode = "referenced" | "copied";

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
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [targetType, setTargetType] = useState<UploadTarget>("homepage");
  const [newTitle, setNewTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("referenced");

  useEffect(() => {
    if (!showTargetSelector) return;
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data: CollectionOption[]) => setCollections(data))
      .catch(console.error);
  }, [showTargetSelector]);

  /** 判断文件是否为支持的图片格式 */
  const isValidImage = (f: File) => {
    const ext = "." + f.type.replace("image/", "");
    return f.type.startsWith("image/") && ACCEPT.includes(ext);
  };

  /** 分批上传文件列表 */
  const batchUpload = useCallback(async (validFiles: File[]) => {
    const totalBatches = Math.ceil(validFiles.length / BATCH_SIZE);
    const allResults: UploadResult[] = [];

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const batch = validFiles.slice(start, start + BATCH_SIZE);

      setProgress({
        currentBatch: batchIdx + 1,
        totalBatches,
        uploadedCount: allResults.length,
        totalCount: validFiles.length,
      });

      const formData = new FormData();
      batch.forEach((f) => formData.append("file", f));
      formData.append("storage_mode", storageMode);

      if (targetType === "new" && newTitle.trim()) {
        formData.append("newCollectionTitle", newTitle.trim());
      } else if (targetType === "existing" && selectedCollectionId) {
        formData.append("collectionId", String(selectedCollectionId));
      }

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `第 ${batchIdx + 1} 批上传失败`);
      }

      const batchResults: UploadResult[] = data.photos.map((p: any) => ({
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
      }));

      allResults.push(...batchResults);
    }

    setProgress(null);
    return allResults;
  }, [targetType, newTitle, selectedCollectionId, storageMode]);

  /** 入口：处理来自拖拽/文件选择/文件夹选择的文件列表 */
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (files.length === 0) return;

    const validFiles = Array.from(files).filter(isValidImage);

    if (validFiles.length === 0) {
      setErrorMsg("只支持 JPG/JPEG/PNG 格式");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      const allResults = await batchUpload(validFiles);
      setResults(allResults);
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "上传失败，请重试");
      setStatus("error");
    }
  }, [batchUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus("dragging");
  };
  const handleDragLeave = () => setStatus("idle");
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleFolderClick = () => folderInputRef.current?.click();
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleReset = () => {
    setStatus("idle");
    setResults([]);
    setErrorMsg("");
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
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
                ${targetType === t
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"}
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
              onChange={(e) => setSelectedCollectionId(e.target.value ? Number(e.target.value) : null)}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">选择摄影集…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 存储模式选择器 */}
      {status === "idle" && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 mr-0.5">模式</span>
          {(["referenced", "copied"] as StorageMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setStorageMode(m)}
              className={`
                text-[10px] px-2.5 py-1 rounded-full transition-colors
                ${storageMode === m
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"}
              `}
            >
              {m === "referenced" && "引用"}
              {m === "copied" && "复制"}
            </button>
          ))}
          {storageMode === "referenced" && (
            <span className="text-[9px] text-gray-300">不占用额外磁盘空间</span>
          )}
        </div>
      )}

      {/* idle / dragging / uploading */}
      {status !== "success" && status !== "error" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative rounded-xl border transition-all duration-200 select-none
            ${status === "dragging"
              ? "border-blue-400 bg-blue-50/60"
              : "border-gray-200 bg-white hover:bg-gray-50"}
          `}
        >
          {/* 隐藏的 input */}
          <input ref={fileInputRef} type="file" accept={ACCEPT} multiple onChange={handleFileChange} className="hidden" />
          <input ref={folderInputRef} type="file" accept={ACCEPT} multiple onChange={handleFolderChange} className="hidden"
            // @ts-expect-error webkitdirectory is not in React types
            webkitdirectory="" directory="" />

          {status === "uploading" ? (
            <div className="flex flex-col items-center justify-center h-20 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span className="text-xs text-gray-500">
                  上传中
                  {progress && ` (${progress.uploadedCount + progress.currentBatch > 1 ? Math.min(progress.currentBatch * BATCH_SIZE, progress.totalCount) : 0}/${progress.totalCount})`}
                </span>
              </div>
              {progress && progress.totalBatches > 1 && (
                <>
                  {/* 进度条 */}
                  <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-600 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.currentBatch / progress.totalBatches) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400">
                    第 {progress.currentBatch}/{progress.totalBatches} 批
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 h-20">
              <div
                onClick={handleFileClick}
                className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span>导入照片</span>
                <span className="text-gray-300">—</span>
                <span>拖拽到此处</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleFileClick(); }}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  选择文件
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFolderClick(); }}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  选择文件夹
                </button>
              </div>
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
            <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                  <span className="text-[11px] text-gray-600 truncate max-w-[60%]">{r.original_name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {[r.exif.cameraModel, r.exif.focalLength, r.exif.aperture]
                      .filter(Boolean).join(" · ") || "无 EXIF"}
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
          <button onClick={handleReset} className="text-xs text-blue-500 hover:text-blue-600 transition-colors">
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
