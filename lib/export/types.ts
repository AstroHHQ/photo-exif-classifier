/**
 * Export Pipeline 核心类型定义。
 *
 * BookDocument 是所有导出格式的中间结构——
 * PDF、IDML、EPUB 都基于同一个 BookDocument 渲染。
 */

/** 页面类型 */
export type PageType = "cover" | "chapter" | "full-bleed" | "image-with-caption" | "spread";

/** 单页定义 */
export interface Page {
  type: PageType;
  /** 该页对应的 photo id（封面和空白页可为空） */
  photoId?: number;
  /** 照片文件在 uploads/ 下的 filename（UUID），用于加载图片 */
  imageFilename?: string;
  /** 用户上传时的原始文件名，用于导出命名 */
  originalName?: string;
  /** 照片上方标题（如封面标题） */
  title?: string;
  /** 照片下方说明文字（来自 photo.note） */
  caption?: string;
  /** 页码（从 1 开始，封面不显示页码） */
  pageNumber: number;
}

/** 摄影书文档 —— 所有导出格式的中间结构 */
export interface BookDocument {
  title: string;
  /** 摄影书比例："4:5" | "1:1" | "3:2" | "2:3" */
  ratio: string;
  version: number;
  pages: Page[];
  totalPages: number;
}

/** 比例对应的页面尺寸（单位：pt，1pt = 1/72 inch） */
export type PageSize = [number, number]; // [width, height]
