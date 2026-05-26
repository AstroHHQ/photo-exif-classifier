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
import { optimizeExportImage, type ImageOptimizationStats } from "./image";

/** 从 uploads/ 目录读取照片 buffer */
function loadFileBuffer(filename: string): Buffer {
  const filePath = path.join(process.cwd(), "uploads", filename);
  return readFileSync(filePath);
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

  return {
    title: collection.title || "Untitled",
    ratio: collection.book_ratio || "4:5",
    version: collection.version,
    pages,
    totalPages: pages.length,
  };
}

/**
 * 为 BookDocument 的所有页面加载图片并优化为导出尺寸。
 *
 * 优化规则：
 * - 最长边限制 3000px
 * - JPEG quality 0.85
 * - 仅在需要时 resize（原图 ≤3000px 则跳过）
 *
 * 返回优化后的 BookDocument 和统计信息。
 */
export async function resolveBookImages(
  doc: BookDocument
): Promise<{ document: BookDocument; imageStats: ImageOptimizationStats }> {
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let imageCount = 0;

  const resolvedPages = await Promise.all(
    doc.pages.map(async (page) => {
      if (page.imageFilename) {
        try {
          const buffer = loadFileBuffer(page.imageFilename);
          const result = await optimizeExportImage(buffer, page.imageFilename);
          totalOriginalBytes += result.originalSize;
          totalOptimizedBytes += result.optimizedSize;
          imageCount++;
          return { ...page, imageFilename: result.dataUrl };
        } catch {
          // 优化失败时回退到原始 base64（不 resize/compress）
          try {
            const buffer = loadFileBuffer(page.imageFilename);
            const base64 = buffer.toString("base64");
            const ext = path.extname(page.imageFilename).toLowerCase();
            const mime = ext === ".png" ? "image/png" : "image/jpeg";
            return {
              ...page,
              imageFilename: `data:${mime};base64,${base64}`,
            };
          } catch {
            return { ...page, imageFilename: undefined };
          }
        }
      }
      return page;
    })
  );

  return {
    document: {
      ...doc,
      pages: resolvedPages,
    },
    imageStats: {
      totalOriginalBytes,
      totalOptimizedBytes,
      count: imageCount,
    },
  };
}
