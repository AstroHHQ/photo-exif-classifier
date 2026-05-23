"use client";

/**
 * PhotoModal —— 照片详情弹窗。
 *
 * 功能：
 * - 左图右 EXIF，全屏遮罩
 * - 键盘 Esc 关闭，← → 切换前后照片
 * - 按住空格键直接录音，松开停止并填入备注框
 * - 备注编辑 + 🎤 按钮手动录音
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { PhotoData } from "./PhotoCard";

/** 检测浏览器是否支持语音识别 */
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

/** EXIF 显示字段 */
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
  // 备注编辑状态
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  // 语音识别
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // refs 用于在事件回调中读取最新 state（避免闭包过期）
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const photoRef = useRef(photo);
  photoRef.current = photo;

  // 重置编辑状态（照片切换时）
  useEffect(() => {
    setEditing(false);
    setNoteDraft("");
    setListening(false);
    setInterimText("");
  }, [photo?.id]);

  const index = photo ? photos.indexOf(photo) : -1;

  // ---- 语音识别 ----
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

  /** 进入编辑模式 */
  const handleStartEdit = useCallback(() => {
    const p = photoRef.current;
    setNoteDraft(p?.note || "");
    setEditing(true);
  }, []);

  // 键盘：Esc / ← / →
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onClose, onPrev, onNext]
  );

  // 主体键盘绑定 + body scroll lock
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      stopListening();
    };
  }, [handleKeyDown, stopListening]);

  // ---- 空格键录音 ----
  useEffect(() => {
    const handleSpaceDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // 用户正在 textarea 打字时不拦截
      if (document.activeElement === textareaRef.current) return;

      e.preventDefault();

      // 不在编辑模式则自动进入
      if (!editingRef.current) {
        const p = photoRef.current;
        if (p) {
          setNoteDraft(p.note || "");
          setEditing(true);
        }
      }

      // 有语音支持则开始录音
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

  const imageUrl = `/api/photos/${photo.id}/file`;

  /** 保存备注 */
  const handleSave = () => {
    onNoteChange(photo.id, noteDraft);
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden flex flex-col md:flex-row max-w-5xl w-full max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：照片 */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center min-h-[300px]">
          <img
            src={imageUrl}
            alt={photo.original_name}
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>

        {/* 右侧：信息面板 */}
        <div className="w-full md:w-80 p-6 overflow-y-auto relative shrink-0">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 导航按钮 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={onPrev}
              disabled={index <= 0}
              className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-default hover:bg-gray-50 transition-colors"
            >
              ← 上一张
            </button>
            <button
              onClick={onNext}
              disabled={index >= photos.length - 1}
              className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-default hover:bg-gray-50 transition-colors"
            >
              下一张 →
            </button>
          </div>

          {/* 文件名 */}
          <h3 className="text-sm font-semibold mb-4 text-gray-900">
            {photo.original_name}
          </h3>

          {/* EXIF 列表 */}
          <dl className="space-y-0">
            {EXIF_FIELDS.map(({ label, key }) => (
              <div key={key} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="text-sm text-gray-700">
                  {photo[key] != null ? String(photo[key]) : "—"}
                </dd>
              </div>
            ))}
          </dl>

          {/* 分隔线 */}
          <hr className="my-4 border-gray-100" />

          {/* 备注区域 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">备注</span>
            {!editing && (
              <button
                onClick={handleStartEdit}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
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
                className="w-full rounded-xl border border-gray-200 text-sm p-3 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                {/* 语音按钮 */}
                {isSpeechSupported && (
                  <button
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onMouseLeave={stopListening}
                    onTouchStart={startListening}
                    onTouchEnd={stopListening}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-colors
                      ${listening ? "bg-red-500 animate-pulse" : "bg-gray-100 hover:bg-gray-200"}
                    `}
                    title={listening ? "录音中…" : "按住录音（或按住空格键）"}
                  >
                    <svg
                      className={`w-4 h-4 ${listening ? "text-white" : "text-gray-500"}`}
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
                <button
                  onClick={handleSave}
                  className="text-xs text-white bg-blue-500 rounded-lg px-3 py-1.5 hover:bg-blue-600 transition-colors"
                >
                  保存
                </button>
              </div>
            </>
          ) : (
            <p
              className={`text-sm ${photo.note ? "text-gray-600" : "text-gray-400 italic"}`}
            >
              {photo.note || "暂无备注"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
