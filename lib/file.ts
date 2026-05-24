/**
 * 文件访问抽象层 —— 统一处理 copied / referenced 两种存储模式。
 *
 * copied（当前 Web MVP）：
 *   照片已复制到 uploads/，通过 /api/photos/[id]/file 访问。
 *
 * referenced（未来 Electron/mac App）：
 *   照片引用原始文件路径，通过 file:// 或 Electron custom protocol 访问。
 *   不复制文件，避免重复占用磁盘空间（RAW 文件尤其重要）。
 */

import type { Photo } from "./db";

/**
 * 获取照片的访问 URL。
 *
 * copied 模式返回 API 路由，referenced 模式返回原始文件路径
 * （未来可通过 Electron protocol 转换为可访问的 URL）。
 */
export function getPhotoUrl(photo: Pick<Photo, "id" | "storage_mode" | "filename">): string {
  if (photo.storage_mode === "referenced") {
    // 未来：Electron 下通过 custom protocol 或 file:// 访问
    // 当前 Web MVP 不会触发此分支，仅作为架构占位
    return `/api/photos/${photo.id}/file`;
  }
  // copied 模式：通过 API 路由从 uploads/ 读取
  return `/api/photos/${photo.id}/file`;
}
