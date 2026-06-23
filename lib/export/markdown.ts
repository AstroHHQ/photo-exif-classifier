/**
 * Markdown Export —— Book Source Format。
 *
 * 从 BookDocument 生成 book.md 内容。
 * Markdown 属于内容层，不属于版式层——不导出比例、边距、字体、页码等排版属性。
 *
 * 与 PDF Renderer 的区别：
 * - PDF = 最终出版物（包含版式、字体、页码）
 * - Markdown = 可编辑源文件（仅内容：标题、版本、照片、说明）
 */

import path from "path";
import type { BookDocument, Page } from "./types";

/** 页面在 markdown 中的图片序号（从 1 开始，3 位补零） */
function padIndex(idx: number): string {
  return String(idx).padStart(3, "0");
}

/**
 * 按页面顺序为所有含图片的页面分配序号。
 * 封面图片索引为 1（如果存在），后续照片页递增。
 */
interface ImageRef {
  /** 该页在 markdown 中的图片引用序号（1-based） */
  index: number;
  /** 图片文件名（含扩展名），如 "001.jpg" */
  filename: string;
}

function buildImageRefs(pages: Page[]): Map<number, ImageRef> {
  const refs = new Map<number, ImageRef>();
  let idx = 0;

  for (const page of pages) {
    if (page.imageFilename) {
      idx++;
      const ext = path.extname(page.imageFilename).toLowerCase();
      const outExt = ext === ".png" ? ".png" : ".jpg";
      refs.set(page.pageNumber, {
        index: idx,
        filename: `${padIndex(idx)}${outExt}`,
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
  const imageRefs = buildImageRefs(doc.pages);

  // 封面标题
  lines.push(`# ${doc.title}`);
  lines.push("");
  lines.push(`Version ${doc.version}`);

  for (const page of doc.pages) {
    if (page.type === "cover") {
      // 封面：标题 + 版本号已在上面。如有封面图，加入作为第一张图
      const ref = imageRefs.get(page.pageNumber);
      if (ref) {
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push(`![${ref.filename}](images/${ref.filename})`);
      }
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
 * 返回 BookDocument 中所有图片的页面序号与源文件映射。
 * 供 API 层复制图片文件到 zip 的 images/ 目录。
 *
 * @returns Map<输出文件名, 源文件名（uploads/ 下的 filename）>
 */
export function getExportImageMap(
  doc: BookDocument
): Map<string, string> {
  const imageRefs = buildImageRefs(doc.pages);
  const map = new Map<string, string>();

  for (const page of doc.pages) {
    const ref = imageRefs.get(page.pageNumber);
    if (ref && page.imageFilename) {
      map.set(ref.filename, page.imageFilename);
    }
  }

  return map;
}
