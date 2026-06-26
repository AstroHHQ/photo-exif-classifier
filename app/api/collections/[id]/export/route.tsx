/**
 * 摄影书 PDF 导出接口 —— GET /api/collections/[id]/export
 *
 * 生成摄影书 PDF 并返回下载。
 * 数据流：Collection → buildBookDocument() → resolveBookImages() → PhotoBook → pdf()
 * resolveBookImages 内集成了 export-size 图片优化（resize + JPEG compress）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollectionById, getCollectionPhotos, getCollectionChapters } from "@/lib/db";
import { buildBookDocument, resolveBookImages } from "@/lib/export/schema";
import { PhotoBook } from "@/lib/export/pdf";
import { renderToBuffer } from "@react-pdf/renderer";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);

  const collection = getCollectionById(collectionId);
  if (!collection) {
    return NextResponse.json({ error: "摄影集不存在" }, { status: 404 });
  }

  const photos = getCollectionPhotos(collectionId);
  const chapters = getCollectionChapters(collectionId);
  if (photos.length === 0) {
    return NextResponse.json({ error: "摄影集中没有照片" }, { status: 400 });
  }

  // 构建 BookDocument
  const bookDoc = buildBookDocument(collection, photos, chapters);

  // 加载图片 + 导出尺寸优化
  const { document: resolved, imageStats } = await resolveBookImages(bookDoc);

  // 生成 PDF buffer
  const pdfBuffer = await renderToBuffer(
    <PhotoBook document={resolved} />
  );

  // 文件名
  const safeTitle = (collection.title || "untitled")
    .replace(/[^a-zA-Z0-9一-鿿]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  const filename = `${safeTitle}-v${collection.version}.pdf`;

  // ---- 导出指标 ----
  const fontFileBytes = 20 * 1024 * 1024; // SongtiSC-Regular.ttf 完整文件大小
  // react-pdf / PDFKit 自动 subset 字体 —— 仅嵌入使用的 glyph
  const estimatedFontBytes = Math.min(fontFileBytes, resolved.pages.reduce((sum, p) => {
    const chars = (p.title ?? "").length + (p.caption ?? "").length;
    return sum + chars;
  }, 0) * 200 + 50000); // 粗略估算：每字符 ~200 bytes glyph data + 50KB overhead

  console.log(`
┌─────────────────────────────────────────┐
│  PDF Export Metrics                     │
├─────────────────────────────────────────┤
│  Title:        ${collection.title || "untitled"}
│  Pages:        ${resolved.totalPages}
│  Images:       ${imageStats.count}
│  PDF size:     ${formatBytes(pdfBuffer.length)}
│  Font (file):  ${formatBytes(fontFileBytes)}
│  Font (est.):  ${formatBytes(estimatedFontBytes)} (subset embedded)
├─────────────────────────────────────────┤
│  Image Optimization                     │
│  Before:       ${formatBytes(imageStats.totalOriginalBytes)}
│  After:        ${formatBytes(imageStats.totalOptimizedBytes)}
│  Saved:        ${formatBytes(imageStats.totalOriginalBytes - imageStats.totalOptimizedBytes)} (${imageStats.totalOriginalBytes > 0 ? Math.round((1 - imageStats.totalOptimizedBytes / imageStats.totalOriginalBytes) * 100) : 0}%)
└─────────────────────────────────────────┘
`);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
