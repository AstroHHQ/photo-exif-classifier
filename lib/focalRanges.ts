/**
 * 等效焦段引擎 —— 共享模块。
 *
 * 供 lib/stats.ts（服务端统计）和 PhotoContainer.tsx（客户端筛选）共用。
 * 纯函数，无副作用，无外部依赖。
 */

/** 从相机型号字符串检测 crop factor */
export function detectCropFactor(cameraModel: string | null): number {
  if (!cameraModel) return 1.0;
  const m = cameraModel;

  if (m.includes("FUJIFILM") || m.includes("Fujifilm")) {
    if (m.includes("GFX")) return 0.79;
    return 1.5;
  }

  if (m.includes("SONY") || m.includes("Sony")) {
    if (/ILCE-[679]/.test(m)) return 1.0;
    if (/ILCE-1\b/.test(m)) return 1.0;
    if (/NEX|ILCE-[345]/.test(m)) return 1.5;
    return 1.0;
  }

  if (m.includes("Canon") || m.includes("CANON")) {
    if (/EOS\s*R[5678]/.test(m)) return 1.6;
    if (/EOS\s*R/.test(m)) return 1.0;
    if (/EOS\s*Rebel|EOS\s*\d{3,4}D/.test(m)) return 1.6;
    if (/EOS\s*7D/.test(m)) return 1.6;
    if (/EOS\s*1D/.test(m)) return 1.0;
    if (/EOS\s*[56]D/.test(m)) return 1.0;
    return 1.0;
  }

  if (m.includes("NIKON") || m.includes("Nikon")) {
    if (/Z\s*[569]|Z\s*7|Z\s*8|Zf/.test(m)) return 1.0;
    if (/Z\s*50|Z\s*30|Z\s*fc/.test(m)) return 1.5;
    if (/D[345]\d{3}/.test(m)) return 1.5;
    if (/D[678]\d{2}/.test(m)) return 1.0;
    return 1.0;
  }

  if (m.includes("LEICA") || m.includes("Leica")) return 1.0;
  if (/RICOH|GR\d/.test(m)) return 1.5;
  if (/iPhone|iPad|Samsung|Pixel|Xiaomi|Huawei/i.test(m)) return 1.0;

  return 1.0;
}

/** 从焦段字符串解析数字 mm，如 "18.3 mm" → 18.3，"24-70mm" → 24（取广角端） */
export function parseFocalLengthMm(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (!m) return null;
  return parseFloat(m[1]);
}

/** 摄影语言分类范围（按焦段从短到长排列） */
export const FOCAL_RANGES: { range: string; mm: string; min: number; max: number }[] = [
  { range: "超广角", mm: "≤20mm", min: 0, max: 20 },
  { range: "广角", mm: "21-35mm", min: 21, max: 35 },
  { range: "标准焦段", mm: "36-70mm", min: 36, max: 70 },
  { range: "中长焦", mm: "71-105mm", min: 71, max: 105 },
  { range: "长焦", mm: "106-200mm", min: 106, max: 200 },
  { range: "超长焦", mm: "200mm+", min: 201, max: Infinity },
];

/** 将等效焦段分类到摄影语言范围 */
export function classifyFocalRange(equivalentMm: number): string {
  for (const r of FOCAL_RANGES) {
    if (equivalentMm >= r.min && equivalentMm <= r.max) return r.range;
  }
  return "标准焦段";
}

/** 计算 35mm 等效焦段（从 Photo 原始字段） */
export function computeEquivalentFocalLength(
  focalLength35mm: number | null,
  cameraModel: string | null,
  focalLength: string | null,
): number | null {
  if (focalLength35mm != null) return focalLength35mm;
  const cropFactor = detectCropFactor(cameraModel);
  const rawMm = parseFocalLengthMm(focalLength);
  if (rawMm !== null) return Math.round(rawMm * cropFactor);
  return null;
}
