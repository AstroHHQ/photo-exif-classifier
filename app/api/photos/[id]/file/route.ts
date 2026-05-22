/**
 * 照片文件接口 —— GET /api/photos/[id]/file
 *
 * 根据照片 ID 从 uploads/ 目录读取原始文件并返回。
 * 设置缓存头，浏览器可以缓存一天。
 */

import { NextRequest, NextResponse } from "next/server";
import { getPhotoById } from "@/lib/db";
import path from "path";
import fs from "fs/promises";

// MIME 类型映射
const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photoId = parseInt(id, 10);
  if (isNaN(photoId)) {
    return NextResponse.json({ error: "无效的照片 ID" }, { status: 400 });
  }

  // 1. 从数据库查照片记录
  const photo = getPhotoById(photoId);
  if (!photo) {
    return NextResponse.json({ error: "照片不存在" }, { status: 404 });
  }

  // 2. 读取 uploads/ 下的文件
  const filePath = path.join(process.cwd(), "uploads", photo.filename);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "文件读取失败" }, { status: 404 });
  }

  // 3. 返回图片，设置 Content-Type 和缓存头
  const ext = path.extname(photo.filename).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // 浏览器缓存 1 天
    },
  });
}
