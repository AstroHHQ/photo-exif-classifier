/**
 * BookDocument 构建器。
 *
 * 将 Collection + Photos 转换为 BookDocument 中间结构。
 * 所有导出 renderer 的输入都是 BookDocument。
 */

import { readFileSync } from "fs";
import path from "path";
import type { Collection, Photo } from "@/lib/db";
import type { BookDocument, Page } from "./types";

/** 从 uploads/ 目录读取照片并转为 base64 data URL */
function loadImageDataUrl(filename: string): string {
  const filePath = path.join(process.cwd(), "uploads", filename);
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

/**
 * 从 Collection 和照片列表构建 BookDocument。
 */
export function buildBookDocument(
  collection: Collection,
  photos: Photo[]
): BookDocument {
  const pages: Page[] = [];

  // 封面页
  pages.push({
    type: "cover",
    pageNumber: 1,
    title: collection.title || "Untitled",
    caption: `v${collection.version}`,
    // 如果有封面照片，用作封面图
    imageFilename: collection.cover_photo_id != null
      ? photos.find(p => p.id === collection.cover_photo_id)?.filename
      : photos[0]?.filename,
  });

  // 照片页（按 sort_order 排序）
  const sortedPhotos = [...photos].sort((a, b) => {
    const ao = a.sort_order ?? 9999;
    const bo = b.sort_order ?? 9999;
    return ao - bo;
  });

  for (const photo of sortedPhotos) {
    pages.push({
      type: "image-with-caption",
      photoId: photo.id,
      imageFilename: photo.filename,
      caption: photo.note || undefined,
      pageNumber: pages.length + 1,
    });
  }

  // 加载图片 data URL（仅在 PDF 导出时调用此函数）
  // 注意：此步骤在服务端 API route 中执行

  return {
    title: collection.title || "Untitled",
    ratio: collection.book_ratio || "4:5",
    version: collection.version,
    pages,
    totalPages: pages.length,
  };
}

/**
 * 为 BookDocument 的所有页面加载图片 data URL。
 * 分离此步骤是因为 data URL 体积大，不应序列化传递。
 */
export function resolveBookImages(doc: BookDocument): BookDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.imageFilename) {
        try {
          return {
            ...page,
            imageFilename: loadImageDataUrl(page.imageFilename),
          };
        } catch {
          return { ...page, imageFilename: undefined };
        }
      }
      return page;
    }),
  };
}
