/**
 * 照片排序接口 —— PATCH /api/photos/[id]/move
 *
 * 在摄影集内上下移动照片，交换相邻照片的 sort_order。
 * Body: { collectionId: number, direction: "up" | "down" }
 */

import { NextRequest, NextResponse } from "next/server";
import { movePhotoInCollection } from "@/lib/db";

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
    const { collectionId, direction } = await request.json();
    if (!collectionId || !["up", "down"].includes(direction)) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }

    const photos = movePhotoInCollection(photoId, collectionId, direction);
    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Move photo error:", error);
    return NextResponse.json({ error: "排序失败" }, { status: 500 });
  }
}
