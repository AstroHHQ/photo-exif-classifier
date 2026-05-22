/**
 * 照片列表接口 —— GET /api/photos
 *
 * 预留接口，后续用于瀑布流加载照片列表。
 * 当前返回空数组。
 */

import { NextResponse } from "next/server";
import { getAllPhotos } from "@/lib/db";

export async function GET() {
  const photos = getAllPhotos();
  return NextResponse.json(photos);
}
