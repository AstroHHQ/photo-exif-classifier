/**
 * 批量操作照片 —— /api/photos/batch
 *
 * DELETE: 批量删除/移出照片
 *   Body: { photo_ids: number[], context?: "library" | "collection" }
 *
 * PATCH: 批量加入摄影集
 *   Body: { photo_ids: number[], collection_id: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { batchDeletePhotos, batchRemoveFromCollection, batchAddToCollection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const photoIds: number[] = body.photo_ids;
    const collectionId: number = body.collection_id;

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: "请提供 photo_ids 数组" }, { status: 400 });
    }
    if (collectionId == null) {
      return NextResponse.json({ error: "请提供 collection_id" }, { status: 400 });
    }

    const count = batchAddToCollection(photoIds, collectionId);

    return NextResponse.json({
      success: true,
      imported: count,
      collection_id: collectionId,
    });
  } catch (error) {
    console.error("Batch add to collection error:", error);
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const photoIds: number[] = body.photo_ids;
    const context: "library" | "collection" = body.context || "library";

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: "请提供 photo_ids 数组" }, { status: 400 });
    }

    if (context === "collection") {
      const count = batchRemoveFromCollection(photoIds);
      return NextResponse.json({ success: true, removed: count, context: "collection" });
    }

    // library context：批量删除
    const deleted = batchDeletePhotos(photoIds);
    let filesDeleted = 0;
    let recordsDeleted = deleted.length;

    for (const info of deleted) {
      if (info.storage_mode === "copied") {
        try {
          const filePath = path.join(process.cwd(), "uploads", info.filename);
          await fs.unlink(filePath);
          filesDeleted++;
        } catch {
          // 文件可能已不存在
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted: recordsDeleted,
      filesDeleted,
      context: "library",
    });
  } catch (error) {
    console.error("Batch delete error:", error);
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 });
  }
}
