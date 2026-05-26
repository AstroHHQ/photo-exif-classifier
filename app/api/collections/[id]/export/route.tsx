/**
 * 摄影书 PDF 导出接口 —— GET /api/collections/[id]/export
 *
 * 生成摄影书 PDF 并返回下载。
 * 数据流：Collection → buildBookDocument() → resolveBookImages() → PhotoBook → pdf()
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollectionById, getCollectionPhotos } from "@/lib/db";
import { buildBookDocument, resolveBookImages } from "@/lib/export/schema";
import { PhotoBook } from "@/lib/export/pdf";
import { renderToBuffer } from "@react-pdf/renderer";

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
  if (photos.length === 0) {
    return NextResponse.json({ error: "摄影集中没有照片" }, { status: 400 });
  }

  // 构建 BookDocument + 加载图片
  const bookDoc = buildBookDocument(collection, photos);
  const resolved = resolveBookImages(bookDoc);

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

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
