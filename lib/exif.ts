/**
 * EXIF 读取模块 —— 封装 ExifReader，提取摄影相关的 7 个关键字段。
 *
 * ExifReader 是纯 JavaScript 实现，不需要安装系统级依赖（不像 libexif/exiftool）。
 * 直接读文件 buffer 即可解析，跨平台兼容。
 */

import ExifReader from "exifreader";

/** 我们要提取的 EXIF 字段 */
export interface ExifData {
  cameraModel: string | null;
  lensModel: string | null;
  focalLength: string | null;
  iso: number | null;
  aperture: string | null;
  shutterSpeed: string | null;
  dateTaken: string | null;
}

/**
 * 从文件 buffer 中读取 EXIF 信息。
 *
 * @param buffer - 图片文件的二进制内容
 * @returns 提取到的 EXIF 数据，缺失字段为 null
 */
export function readExif(buffer: ArrayBuffer): ExifData {
  const tags = ExifReader.load(buffer);

  // ExifReader 返回的结构：
  // tags.Name.value       → RAW 值（如 IRational）
  // tags.Name.description → 人类可读的字符串（如 "1/250", "f/2.8", "70mm"）
  // 我们用 description 因为它已经格式化好了

  return {
    cameraModel: getString(tags, "Model"),
    lensModel: getString(tags, "LensModel"),
    focalLength: getDescription(tags, "FocalLength"),
    iso: getNumber(tags, "ISOSpeedRatings"),
    aperture: getDescription(tags, "FNumber"),
    shutterSpeed: getDescription(tags, "ExposureTime"),
    dateTaken: getDateTaken(tags),
  };
}

/** 获取字符串值，优先用 description，否则用 value */
function getString(tags: Record<string, any>, name: string): string | null {
  const tag = tags[name];
  if (!tag) return null;
  return tag.description || String(tag.value || "").trim() || null;
}

/** 获取数字值（ISO） */
function getNumber(tags: Record<string, any>, name: string): number | null {
  const tag = tags[name];
  if (!tag || tag.value === undefined) return null;
  const num = Number(tag.value);
  return Number.isNaN(num) ? null : num;
}

/** 获取 human-readable 的描述值（光圈、快门、焦距） */
function getDescription(tags: Record<string, any>, name: string): string | null {
  const tag = tags[name];
  if (!tag || !tag.description) return null;
  return String(tag.description).trim() || null;
}

/**
 * 解析拍摄时间。
 * ExifReader 在 DateTimeOriginal 上可能给出 description 是 ISO 字符串，
 * 也可能需要通过 value 自己拼接（"YYYY:MM:DD HH:mm:ss"）。
 */
function getDateTaken(tags: Record<string, any>): string | null {
  const tag = tags["DateTimeOriginal"];
  if (!tag) return null;

  // 如果 description 已经是 ISO 格式，直接用
  if (tag.description) {
    // 尝试把 "2024:01:15 14:30:00" 转成 ISO 8601 "2024-01-15T14:30:00"
    const iso = String(tag.description).replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
    if (iso) return iso;
  }

  return null;
}
