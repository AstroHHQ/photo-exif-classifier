/**
 * 统计接口 —— GET /api/stats
 *
 * 返回所有照片的 EXIF 参数分布统计。
 */

import { NextResponse } from "next/server";
import { getStats } from "@/lib/stats";

export async function GET() {
  const stats = getStats();
  return NextResponse.json(stats);
}
