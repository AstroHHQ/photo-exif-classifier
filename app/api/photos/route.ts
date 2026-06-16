/**
 * 照片列表接口 —— GET /api/photos
 *
 * 查询参数：
 * - ?unarchived=1  只返回未归档照片（collection_id IS NULL）
 * - ?collectionId=X  只返回指定摄影集下的照片
 * - ?sort=newest|oldest  排序方式（默认 newest，按拍摄时间）
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllPhotos, getUnarchivedPhotos, getCollectionPhotos } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get("collectionId");
  const unarchived = searchParams.get("unarchived");
  const sort = (searchParams.get("sort") as "date_desc" | "date_asc" | "imported_desc" | "imported_asc") || "date_desc";

  if (collectionId) {
    return NextResponse.json(getCollectionPhotos(parseInt(collectionId, 10)));
  }
  if (unarchived === "1") {
    return NextResponse.json(getUnarchivedPhotos(sort));
  }
  return NextResponse.json(getAllPhotos());
}
