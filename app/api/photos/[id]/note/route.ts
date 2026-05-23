/**
 * 备注接口 —— PATCH /api/photos/[id]/note
 *
 * 更新照片的备注。
 */

import { NextRequest, NextResponse } from "next/server";
import { updatePhotoNote } from "@/lib/db";

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
    const { note } = await request.json();
    if (typeof note !== "string") {
      return NextResponse.json({ error: "备注内容必须是字符串" }, { status: 400 });
    }

    updatePhotoNote(photoId, note);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Note update error:", error);
    return NextResponse.json({ error: "更新备注失败" }, { status: 500 });
  }
}
