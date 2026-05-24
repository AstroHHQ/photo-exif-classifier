/**
 * 摄影集列表接口 —— GET /api/collections, POST /api/collections
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllCollections,
  createCollection,
  getCollectionPhotos,
  getCollectionProgress,
} from "@/lib/db";

/** 获取所有摄影集列表（含前 3 张预览照片 + 编辑进度）。?editable=1 只返回 draft + ready */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const editableOnly = searchParams.get("editable") === "1";

  let collections = getAllCollections();
  if (editableOnly) {
    collections = collections.filter((c) => c.status !== "published");
  }

  const withPreviews = collections.map((c) => ({
    ...c,
    previewPhotos: getCollectionPhotos(c.id).slice(0, 3),
    photoCount: getCollectionPhotos(c.id).length,
    progress: getCollectionProgress(c.id),
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
