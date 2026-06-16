/**
 * 批量删除/移出照片 —— DELETE /api/photos/batch
 *
 * Body: { photo_ids: number[], context?: "library" | "collection" }
 *
 * - context = "library"（默认）：根据 storage_mode 决定是否删除文件。
 *   copied → 删文件 + 数据库记录；referenced → 仅删数据库记录。
 * - context = "collection"：仅移出摄影集（collection_id → NULL），不删除。
 */

import { NextRequest, NextResponse } from "next/server";
import { batchDeletePhotos, batchRemoveFromCollection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

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
