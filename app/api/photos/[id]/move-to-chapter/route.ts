/**
 * 移动到章节接口 —— PATCH /api/photos/[id]/move-to-chapter
 *
 * 将照片移动到目标章节之后（调整 sort_order，不建立 chapter_id 归属）。
 * Body: { chapterId: number, collectionId: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { movePhotoToChapter, getCollectionById } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photoId = parseInt(id, 10);
  if (isNaN(photoId)) {
    return NextResponse.json({ error: "无效的照片 ID" }, { status: 400 });
  }

  try {
    const { chapterId, collectionId } = await request.json();
    if (!chapterId || !collectionId) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }

    // 已发布摄影集不允许修改
    const collection = getCollectionById(collectionId);
    if (!collection) {
      return NextResponse.json({ error: "摄影集不存在" }, { status: 404 });
    }
    if (collection.status === "published") {
      return NextResponse.json(
        { error: "已发布摄影集无法修改" },
        { status: 400 }
      );
    }

    const photo = movePhotoToChapter(photoId, chapterId, collectionId);
    if (!photo) {
      return NextResponse.json({ error: "章节或照片不存在" }, { status: 404 });
    }

    return NextResponse.json(photo);
  } catch (error) {
    console.error("Move to chapter error:", error);
    return NextResponse.json({ error: "移动失败" }, { status: 500 });
  }
}
