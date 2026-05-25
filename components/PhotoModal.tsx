"use client";

/**
 * PhotoModal —— 照片详情灯箱。
 *
 * 沉浸式照片浏览：暗色背景、照片保持原始直角、信息面板轻量。
 * 键盘 Esc 关闭，← → 切换前后照片。
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { PhotoData } from "./PhotoCard";
import { getPhotoUrl } from "@/lib/file";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;
const isSpeechSupported = !!SpeechRecognitionAPI;

interface Props {
  photo: PhotoData | null;
  photos: PhotoData[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNoteChange: (photoId: number, note: string) => void;
}

const EXIF_FIELDS: { label: string; key: keyof PhotoData }[] = [
  { label: "相机型号", key: "camera_model" },
  { label: "镜头", key: "lens_model" },
  { label: "焦距", key: "focal_length" },
  { label: "ISO", key: "iso" },
  { label: "光圈", key: "aperture" },
  { label: "快门", key: "shutter_speed" },
  { label: "拍摄时间", key: "date_taken" },
];

export default function PhotoModal({
  photo,
  photos,
  onClose,
  onPrev,
  onNext,
  onNoteChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editingRef = useRef(editing);
  editingRef.current = editing;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const photoRef = useRef(photo);
  photoRef.current = photo;
  const noteDraftRef = useRef(noteDraft);
  noteDraftRef.current = noteDraft;

  const doSave = useCallback(() => {
    const p = photoRef.current;
    const draft = noteDraftRef.current;
    if (!p || draft === p.note) return;
    setSaveStatus("saving");
    onNoteChange(p.id, draft);
    setSaveStatus("saved");
  }, [onNoteChange]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setEditing(false);
    setNoteDraft("");
    setListening(false);
    setInterimText("");
    setSaveStatus("idle");
    clearSaveTimer();
  }, [photo?.id, clearSaveTimer]);

  useEffect(() => {
    if (!editing) return;
    clearSaveTimer();
    const draft = noteDraft;
    const p = photoRef.current;
    if (!p || draft === p.note) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      doSave();
    }, 1000);
    return clearSaveTimer;
  }, [noteDraft, editing, clearSaveTimer, doSave]);

  const index = photo ? photos.indexOf(photo) : -1;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    if (!isSpeechSupported || listeningRef.current) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setNoteDraft((prev) => prev + final);
      }
      setInterimText(interim);
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [stopListening]);

  const handleStartEdit = useCallback(() => {
    const p = photoRef.current;
    setNoteDraft(p?.note || "");
    setEditing(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onClose, onPrev, onNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      stopListening();
    };
  }, [handleKeyDown, stopListening]);

  useEffect(() => {
    const handleSpaceDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (document.activeElement === textareaRef.current) return;

      e.preventDefault();

      if (!editingRef.current) {
        const p = photoRef.current;
        if (p) {
          setNoteDraft(p.note || "");
          setEditing(true);
        }
      }

      if (isSpeechSupported && !listeningRef.current) {
        startListening();
      }
    };

    const handleSpaceUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (document.activeElement === textareaRef.current) return;

      e.preventDefault();

      if (listeningRef.current) {
        stopListening();
      }
    };

    document.addEventListener("keydown", handleSpaceDown);
    document.addEventListener("keyup", handleSpaceUp);

    return () => {
      document.removeEventListener("keydown", handleSpaceDown);
      document.removeEventListener("keyup", handleSpaceUp);
    };
  }, [startListening, stopListening]);

  if (!photo) return null;

  const imageUrl = getPhotoUrl(photo);

  const handleFinish = useCallback(() => {
    clearSaveTimer();
    doSave();
    setEditing(false);
  }, [clearSaveTimer, doSave]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex animate-modal-in"
      onClick={onClose}
    >
      {/* 左侧：照片（无容器裁切，直角） */}
      <div className="flex-1 flex items-center justify-center min-w-0" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt={photo.original_name}
          className="max-w-full max-h-[92vh] object-contain rounded-none"
          draggable={false}
        />
      </div>

      {/* 右侧：信息面板 */}
      <div
        className="w-80 shrink-0 bg-white flex flex-col max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭 + 导航 */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <button
            onClick={onPrev}
            disabled={index <= 0}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-default hover:text-gray-600 hover:border-gray-200 transition-colors"
          >
            ←
          </button>
          <button
            onClick={onNext}
            disabled={index >= photos.length - 1}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-default hover:text-gray-600 hover:border-gray-200 transition-colors"
          >
            →
          </button>
          <span className="text-[10px] text-gray-300 ml-auto">
            {index + 1} / {photos.length}
          </span>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 可滚动内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 文件名 */}
          <h3 className="text-sm font-medium text-gray-700 mb-4 truncate">
            {photo.original_name}
          </h3>

          {/* EXIF */}
          <dl className="space-y-0">
            {EXIF_FIELDS.map(({ label, key }) => (
              <div key={key} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-[11px] text-gray-400">{label}</dt>
                <dd className="text-xs text-gray-600 text-right max-w-[55%] truncate">
                  {photo[key] != null ? String(photo[key]) : "—"}
                </dd>
              </div>
            ))}
          </dl>

          <hr className="my-4 border-gray-50" />

          {/* 备注 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-medium">备注</span>
            {!editing && (
              <button
                onClick={handleStartEdit}
                className="text-[11px] text-blue-500 hover:text-blue-600 transition-colors"
              >
                编辑
              </button>
            )}
          </div>

          {editing ? (
            <>
              <textarea
                ref={textareaRef}
                rows={3}
                value={noteDraft + (interimText ? ` ${interimText}` : "")}
                onChange={(e) => {
                  const userInput = e.target.value.replace(
                    interimText ? ` ${interimText}` : "",
                    ""
                  );
                  setNoteDraft(userInput);
                }}
                placeholder="添加备注…"
                className="w-full rounded-lg border border-gray-200 text-xs p-2.5 text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                {isSpeechSupported && (
                  <button
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onMouseLeave={stopListening}
                    onTouchStart={startListening}
                    onTouchEnd={stopListening}
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${listening ? "bg-red-500 animate-pulse" : "bg-gray-100 hover:bg-gray-200"}
                    `}
                    title={listening ? "录音中…" : "按住录音（或按住空格键）"}
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${listening ? "text-white" : "text-gray-400"}`}
                      fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                )}
                <div className="flex-1" />
                <span
                  className={`
                    text-[10px] mr-2
                    ${saveStatus === "saving" ? "text-amber-500" : ""}
                    ${saveStatus === "saved" ? "text-green-500" : ""}
                    ${saveStatus === "idle" ? "text-transparent" : ""}
                  `}
                >
                  {saveStatus === "saving" && "保存中…"}
                  {saveStatus === "saved" && "已保存"}
                </span>
                <button
                  onClick={handleFinish}
                  className="text-[11px] text-gray-500 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  完成
                </button>
              </div>
            </>
          ) : (
            <p
              className={`text-xs ${photo.note ? "text-gray-500" : "text-gray-300 italic"}`}
            >
              {photo.note || "暂无备注"}
            </p>
          )}
        </div>
      </div>

      {/* 入场动画 */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-modal-in {
          animation: modalIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
