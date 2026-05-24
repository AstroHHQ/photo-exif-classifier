/**
 * 摄影集列表接口 —— GET /api/collections, POST /api/collections
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllCollections,
  createCollection,
  getCollectionPhotos,
} from "@/lib/db";

/** 获取所有摄影集列表（含前 3 张预览照片） */
export async function GET() {
  const collections = getAllCollections();
  const withPreviews = collections.map((c) => ({
    ...c,
    previewPhotos: getCollectionPhotos(c.id).slice(0, 3),
    photoCount: getCollectionPhotos(c.id).length,
  }));
  return NextResponse.json(withPreviews);
}

/** 创建新摄影集 */
export async function POST(request: NextRequest) {
  try {
    const { title, description } = await request.json();
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    const collection = createCollection({
      title: title.trim(),
      description: description || "",
    });
    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    console.error("Create collection error:", error);
    return NextResponse.json({ error: "创建摄影集失败" }, { status: 500 });
  }
}
