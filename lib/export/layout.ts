/**
 * 摄影书页面布局规则。
 *
 * 所有 renderer（PDF、未来 IDML 等）共用此模块。
 * 不在此文件中引用任何特定 renderer。
 */

import type { PageSize } from "./types";

/** 基础页面宽度（pt），所有比例基于此宽度缩放 */
const BASE_WIDTH = 420; // ≈ 14.8cm / 5.8in，适合摄影书

/** 比例 → 页面尺寸 [width, height]（单位：pt） */
export function pageDimensions(ratio: string): PageSize {
  switch (ratio) {
    case "4:5": return [BASE_WIDTH, Math.round(BASE_WIDTH * 5 / 4)];  // 420 × 525
    case "1:1": return [BASE_WIDTH, BASE_WIDTH];                       // 420 × 420
    case "3:2": return [Math.round(BASE_WIDTH * 3 / 2), BASE_WIDTH];  // 630 × 420
    case "2:3": return [BASE_WIDTH, Math.round(BASE_WIDTH * 3 / 2)];  // 420 × 630
    default:    return [BASE_WIDTH, Math.round(BASE_WIDTH * 5 / 4)];
  }
}

/** 页面边距（pt） */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 每种页面类型的边距 */
export function pageMargins(type: string): PageMargins {
  switch (type) {
    case "cover":
      return { top: 0, right: 0, bottom: 0, left: 0 };
    case "full-bleed":
      return { top: 0, right: 0, bottom: 0, left: 0 };
    case "image-with-caption":
      return { top: 36, right: 36, bottom: 56, left: 36 };
    case "spread":
      return { top: 0, right: 0, bottom: 0, left: 0 };
    default:
      return { top: 36, right: 36, bottom: 36, left: 36 };
  }
}

/** 排版常量 */
export const TYPOGRAPHY = {
  /** 中文字体家族 —— 思源宋体（Songti SC），适用于中文 caption / 标题 / 页码 */
  fontFamily: "SongtiSC",
  /** 封面标题字号 */
  coverTitleSize: 18,
  /** caption 字号 */
  captionSize: 9,
  /** caption 颜色 */
  captionColor: "#666666",
  /** 页码字号 */
  pageNumberSize: 7,
  /** 页码颜色 */
  pageNumberColor: "#999999",
  /** 封面副标题（版本号）字号 */
  versionSize: 8,
} as const;

/** 内容区尺寸（页面尺寸减去边距） */
export function contentArea(pageSize: PageSize, margins: PageMargins): { width: number; height: number } {
  return {
    width: pageSize[0] - margins.left - margins.right,
    height: pageSize[1] - margins.top - margins.bottom,
  };
}
