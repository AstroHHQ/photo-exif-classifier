/**
 * 摄影集章节接口 —— POST / DELETE /api/collections/[id]/chapters
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCollectionById,
  createCollectionChapter,
  deleteCollectionChapter,
} from "@/lib/db";

/** 新增章节 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "无效的摄影集 ID" }, { status: 400 });
  }

  const collection = getCollectionById(collectionId);
  if (!collection) {
    return NextResponse.json({ error: "摄影集不存在" }, { status: 404 });
  }

  try {
    const { title } = await request.json();
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "章节标题不能为空" }, { status: 400 });
    }
    const chapter = createCollectionChapter(collectionId, title.trim());
    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("Create chapter error:", error);
    return NextResponse.json({ error: "创建章节失败" }, { status: 500 });
  }
}

/** 删除章节（query: ?id=chapterId） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "无效的摄影集 ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const chapterId = parseInt(searchParams.get("id") || "", 10);
  if (isNaN(chapterId)) {
    return NextResponse.json({ error: "请提供章节 ID (?id=)" }, { status: 400 });
  }

  const ok = deleteCollectionChapter(chapterId);
  if (!ok) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
