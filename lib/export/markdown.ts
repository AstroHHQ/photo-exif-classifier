/**
 * Markdown Export —— Book Source Format。
 *
 * 从 BookDocument 生成 book.md 内容。
 * Markdown 属于内容层，不属于版式层——不导出比例、边距、字体、页码等排版属性。
 *
 * 与 PDF Renderer 的区别：
 * - PDF = 最终出版物（包含版式、字体、页码）
 * - Markdown = 可编辑源文件（仅内容：标题、版本、照片、说明）
 *
 * 导出图片命名规则：
 * {collection_title}_v{version}_{pageIndex:03d}_{original_filename}
 * 保留原始扩展名，非法文件名字符替换为 "-"。
 */

import path from "path";
import type { BookDocument, Page } from "./types";

/** 替换文件名中的非法字符 */
function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, "-");
}

/** 页面在 markdown 中的图片序号（从 1 开始，3 位补零） */
function padIndex(idx: number): string {
  return String(idx).padStart(3, "0");
}

/**
 * 按页面顺序为所有含图片的页面分配导出文件名。
 *
 * 命名格式：{title}_v{version}_{pageIndex:03d}_{originalName}
 * 封面图片索引为 1（如果存在），后续照片页递增。
 */
interface ImageRef {
  /** 该页在 markdown 中的图片引用序号（1-based） */
  index: number;
  /** 导出图片文件名（含扩展名），如 "Tokyo_v3_001_R0001036.JPG" */
  filename: string;
}

function buildImageRefs(doc: BookDocument): Map<number, ImageRef> {
  const refs = new Map<number, ImageRef>();
  const safeTitle = sanitizeFilename(doc.title || "untitled");
  const version = doc.version;
  let idx = 0;

  for (const page of doc.pages) {
    if (page.imageFilename && page.originalName) {
      idx++;
      const ext = path.extname(page.originalName);
      const baseName = path.basename(page.originalName, ext);
      const safeBase = sanitizeFilename(baseName);
      const filename = `${safeTitle}_v${version}_${padIndex(idx)}_${safeBase}${ext}`;
      refs.set(page.pageNumber, {
        index: idx,
        filename,
      });
    } else if (page.imageFilename) {
      // 回退：无 originalName 时使用 imageFilename（UUID）
      idx++;
      const ext = path.extname(page.imageFilename);
      const baseName = path.basename(page.imageFilename, ext);
      const safeBase = sanitizeFilename(baseName);
      const filename = `${safeTitle}_v${version}_${padIndex(idx)}_${safeBase}${ext}`;
      refs.set(page.pageNumber, {
        index: idx,
        filename,
      });
    }
  }

  return refs;
}

/**
 * 从 BookDocument 生成 book.md 内容字符串。
 */
export function buildMarkdownContent(doc: BookDocument): string {
  const lines: string[] = [];
  const imageRefs = buildImageRefs(doc);

  // 封面标题
  lines.push(`# ${doc.title}`);
  lines.push("");
  lines.push(`Version ${doc.version}`);

  for (const page of doc.pages) {
    if (page.type === "cover") {
      const ref = imageRefs.get(page.pageNumber);
      if (ref) {
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push(`![${ref.filename}](images/${ref.filename})`);
      }
      continue;
    }

    if (page.type === "chapter") {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(`## ${page.title || ""}`);
      continue;
    }

    // 照片页（image-with-caption / full-bleed / spread）
    lines.push("");
    lines.push("---");
    lines.push("");

    const ref = imageRefs.get(page.pageNumber);
    if (ref && page.imageFilename) {
      lines.push(`![${ref.filename}](images/${ref.filename})`);
    }

    if (page.caption) {
      lines.push("");
      lines.push(page.caption);
    }
  }

  return lines.join("\n");
}

/**
 * 返回 BookDocument 中所有图片的导出文件名与源文件映射。
 * 供 API 层复制图片文件到 zip 的 images/ 目录。
 *
 * @returns Map<导出文件名, 源文件名（uploads/ 下的 filename）>
 */
export function getExportImageMap(
  doc: BookDocument
): Map<string, string> {
  const imageRefs = buildImageRefs(doc);
  const map = new Map<string, string>();

  for (const page of doc.pages) {
    const ref = imageRefs.get(page.pageNumber);
    if (ref && page.imageFilename) {
      map.set(ref.filename, page.imageFilename);
    }
  }

  return map;
}
