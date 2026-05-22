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
    // 1. 解析上传的文件
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择一个文件" }, { status: 400 });
    }

    // 2. 校验文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "只支持 JPG/JPEG/PNG 格式" },
        { status: 400 }
      );
    }

    // 3. 生成唯一文件名，保存到 uploads/ 目录
    const ext = EXT_MAP[file.type] || ".jpg";
    const filename = randomUUID() + ext;
    const uploadsDir = path.join(process.cwd(), "uploads");
    // 确保目录存在
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, fileBuffer);

    // 4. 读取 EXIF 信息
    const exif = readExif(fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    ));

    // 5. 写入数据库
    const id = insertPhoto({
      filename,
      original_name: file.name,
      camera_model: exif.cameraModel,
      lens_model: exif.lensModel,
      focal_length: exif.focalLength,
      iso: exif.iso,
      aperture: exif.aperture,
      shutter_speed: exif.shutterSpeed,
      date_taken: exif.dateTaken,
      file_size: file.size,
    });

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      photo: {
        id,
        original_name: file.name,
        ...exif,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
