/**
 * 单个摄影集接口 —— GET / PATCH /api/collections/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCollectionById,
  getCollectionPhotos,
  updateCollection,
} from "@/lib/db";

/** 获取单个摄影集详情（含照片列表） */
export async function GET(
  _request: NextRequest,
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

  const photos = getCollectionPhotos(collectionId);

  // 自动检测 ready：draft 状态下，全部备注或全部排序 → 自动升为 ready
  if (collection.status === "draft" && photos.length > 0) {
    const allNoted = photos.every((p) => p.note && p.note !== "");
    const sortedOrders = new Set(photos.map((p) => p.sort_order));
    const allSorted = sortedOrders.size === photos.length;
    if (allNoted || allSorted) {
      updateCollection(collectionId, { status: "ready" });
      collection.status = "ready";
    }
  }

  return NextResponse.json({ ...collection, photos });
}

/** 更新摄影集 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "无效的摄影集 ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // ready → published 时自动递增版本号
    if (body.status === "published") {
      const current = getCollectionById(collectionId);
      if (current && current.status !== "published") {
        body.version = current.version + 1;
      }
    }

    const updated = updateCollection(collectionId, body);
    if (!updated) {
      return NextResponse.json({ error: "摄影集不存在" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update collection error:", error);
    return NextResponse.json({ error: "更新摄影集失败" }, { status: 500 });
  }
}
