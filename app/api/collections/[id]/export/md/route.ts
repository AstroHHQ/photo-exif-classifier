/**
 * Markdown Export 接口 —— GET /api/collections/[id]/export/md
 *
 * 导出摄影集为 Markdown 源文件格式（zip）。
 * 数据流：Collection → buildBookDocument() → buildMarkdownContent() → zip(book.md + images/)
 *
 * 与 PDF Export 的区别：
 * - PDF = 最终出版物（含版式、字体、页码）
 * - Markdown = 可编辑源文件（仅内容）
 * - Markdown Export 不经过 resolveBookImages()（不需要 base64 优化）
 * - 图片直接复制原文件到 zip 的 images/ 目录
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollectionById, getCollectionPhotos } from "@/lib/db";
import { buildBookDocument } from "@/lib/export/schema";
import { buildMarkdownContent, getExportImageMap } from "@/lib/export/markdown";
import AdmZip from "adm-zip";
import { readFileSync } from "fs";
import path from "path";

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

  // 构建 BookDocument
  const bookDoc = buildBookDocument(collection, photos);

  // 生成 markdown 内容
  const markdown = buildMarkdownContent(bookDoc);

  // 获取图片映射（输出文件名 → 源文件名）
  const imageMap = getExportImageMap(bookDoc);

  // 创建 zip
  const zip = new AdmZip();
  zip.addFile("book.md", Buffer.from(markdown, "utf-8"));

  // 添加 images/
  const uploadsDir = path.join(process.cwd(), "uploads");
  for (const [exportName, sourceFilename] of imageMap) {
    const filePath = path.join(uploadsDir, sourceFilename);
    try {
      const buffer = readFileSync(filePath);
      zip.addFile(`images/${exportName}`, buffer);
    } catch {
      console.error(`Markdown Export: 图片文件不存在 ${sourceFilename}`);
    }
  }

  const zipBuffer = zip.toBuffer();

  // 文件名
  const safeTitle = (collection.title || "untitled")
    .replace(/[^a-zA-Z0-9一-鿿]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  const filename = `${safeTitle}-v${collection.version}-source.zip`;

  console.log(`
┌─────────────────────────────────────────┐
│  Markdown Export Metrics                │
├─────────────────────────────────────────┤
│  Title:        ${collection.title || "untitled"}
│  Pages:        ${bookDoc.totalPages}
│  Images:       ${imageMap.size}
│  Zip size:     ${(zipBuffer.length / 1024).toFixed(1)} KB
└─────────────────────────────────────────┘
  `);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
