/**
 * 照片上传接口 —— POST /api/upload
 *
 * 接收用户上传的照片，保存到 uploads/ 目录，
 * 自动提取 EXIF 信息，写入 SQLite 数据库。
 */

import { NextRequest, NextResponse } from "next/server";
import { readExif } from "@/lib/exif";
import { insertPhoto } from "@/lib/db";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

// 允许上传的 MIME 类型
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
// 对应的文件扩展名
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export async function POST(request: NextRequest) {
  try {
    // 1. 解析上传的文件（支持多文件）
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (files.length === 0) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const results = [];

    // 2. 逐个处理每个文件
    for (const entry of files) {
      if (!(entry instanceof File)) continue;

      // 校验文件类型
      if (!ALLOWED_TYPES.includes(entry.type)) continue;

      // 生成唯一文件名，保存到 uploads/
      const ext = EXT_MAP[entry.type] || ".jpg";
      const filename = randomUUID() + ext;

      const fileBuffer = Buffer.from(await entry.arrayBuffer());
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, fileBuffer);

      // 读取 EXIF
      const exif = readExif(
        fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        )
      );

      // 写入数据库
      const id = insertPhoto({
        filename,
        original_name: entry.name,
        camera_model: exif.cameraModel,
        lens_model: exif.lensModel,
        focal_length: exif.focalLength,
        iso: exif.iso,
        aperture: exif.aperture,
        shutter_speed: exif.shutterSpeed,
        note: "",
        date_taken: exif.dateTaken,
        file_size: entry.size,
      });

      results.push({
        id,
        original_name: entry.name,
        ...exif,
      });
    }

    // 3. 返回所有结果
    return NextResponse.json({
      success: true,
      photos: results,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
