/**
 * 照片操作接口 —— PATCH / DELETE /api/photos/[id]
 *
 * PATCH：更新照片字段（导入/移出摄影集）
 * DELETE：删除照片。copied 模式删除 uploads/ 文件 + 数据库记录；referenced 模式仅删除数据库记录
 */

import { NextRequest, NextResponse } from "next/server";
import { deletePhoto, getPhotoById, getCollectionById, updatePhotoCollectionId, getDb } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photoId = parseInt(id, 10);
  if (isNaN(photoId)) {
    return NextResponse.json({ error: "无效的照片 ID" }, { status: 400 });
  }

  const body = await request.json();

  // 移出摄影集：collection_id 设为 null
  if (body.collection_id === null) {
    const photo = getPhotoById(photoId);
    if (!photo) {
      return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    }
    const d = getDb();
    d.prepare("UPDATE photos SET collection_id = NULL, sort_order = NULL WHERE id = ?").run(photoId);
    // 清理封面引用
    d.prepare("UPDATE collections SET cover_photo_id = NULL WHERE cover_photo_id = ?").run(photoId);
    return NextResponse.json(getPhotoById(photoId));
  }

  // 导入摄影集：更新 collection_id
  if (body.collection_id !== undefined) {
    const collectionId = parseInt(body.collection_id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "无效的摄影集 ID" }, { status: 400 });
    }

    // 已发布摄影集不允许修改内容
    const targetCollection = getCollectionById(collectionId);
    if (!targetCollection) {
      return NextResponse.json({ error: "摄影集不存在" }, { status: 404 });
    }
    if (targetCollection.status === "published") {
      return NextResponse.json(
        { error: "已发布摄影集无法修改，请先重新编辑" },
        { status: 400 }
      );
    }

    const updated = updatePhotoCollectionId(photoId, collectionId);
    if (!updated) {
      return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "未提供有效更新字段" }, { status: 400 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photoId = parseInt(id, 10);
  if (isNaN(photoId)) {
    return NextResponse.json({ error: "无效的照片 ID" }, { status: 400 });
  }

  // 先读取照片信息（判断 storage_mode + 获取 filename）
  const photo = getPhotoById(photoId);
  if (!photo) {
    return NextResponse.json({ error: "照片不存在" }, { status: 404 });
  }

  // 删除数据库记录（含封面清理 + sort_order 整理）
  deletePhoto(photoId);

  // copied 模式：删除实体文件
  if (photo.storage_mode === "copied") {
    try {
      const filePath = path.join(process.cwd(), "uploads", photo.filename);
      await fs.unlink(filePath);
    } catch {
      // 文件可能已不存在，忽略
    }
  }
  // referenced 模式：不删除原始文件

  return NextResponse.json({ success: true, id: photoId });
}
