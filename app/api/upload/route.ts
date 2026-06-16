/**
 * 照片上传接口 —— POST /api/upload
 *
 * 接收用户上传的照片，支持两种存储模式：
 * - referenced（默认）：文件保存到 uploads/，标记为引用模式。删除时仅移除数据库记录。
 * - copied：文件复制到 uploads/，标记为复制模式。删除时同时删除文件。
 *
 * Web MVP 限制：浏览器上传无法获取原始文件路径，两种模式均需保存文件到 uploads/。
 * Electron 迁移后 referenced 模式将真正实现零复制（仅存 original_path）。
 */

import { NextRequest, NextResponse } from "next/server";
import { readExif } from "@/lib/exif";
import { insertPhoto, createCollection } from "@/lib/db";
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

    // 1.5 处理上传目标
    const collectionIdRaw = formData.get("collectionId");
    const newCollectionTitle = formData.get("newCollectionTitle");

    let collectionId: number | null = null;
    if (collectionIdRaw) {
      collectionId = parseInt(String(collectionIdRaw), 10);
    } else if (newCollectionTitle) {
      const newCollection = createCollection({
        title: String(newCollectionTitle).trim(),
      });
      collectionId = newCollection.id;
    }

    // 1.6 存储模式（默认 referenced）
    const storageModeRaw = formData.get("storage_mode");
    const storageMode: "copied" | "referenced" =
      storageModeRaw === "copied" ? "copied" : "referenced";

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
        focal_length_35mm: exif.focalLength35mm,
        iso: exif.iso,
        aperture: exif.aperture,
        shutter_speed: exif.shutterSpeed,
        note: "",
        storage_mode: storageMode,
        collection_id: collectionId,
        sort_order: null,
        date_taken: exif.dateTaken,
        file_size: entry.size,
        original_path: storageMode === "referenced" ? filePath : null,
      });

      results.push({
        id,
        original_name: entry.name,
        storage_mode: storageMode,
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
