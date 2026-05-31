# CLAUDE.md — AI Agent Memory

> 面向 Claude / AI Coding Agent。不是 README。
> 每次功能/bug/架构变更后自动更新。

---

## Project Overview

本地摄影照片管理工具（Photo Manager MVP）。上传照片 → 自动读取 EXIF → 瀑布流展示 → 参数统计 → 摄影集管理 → 摄影书 PDF 导出。

- **用户**：摄影师，中文 UI，重视排版质量和阅读体验
- **定位**：摄影工具箱，不是 DAM/资产管理后台
- **未来方向**：Electron Desktop 化

---

## Architecture Rules

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 |
| 数据库 | SQLite (better-sqlite3, 同步 API, WAL 模式) |
| EXIF | ExifReader (纯 JS) |
| PDF | @react-pdf/renderer 4.x |
| 图片处理 | sharp |

- **API Route 模式**：`GET /api/collections/[id]/export` 等，服务端直读 SQLite + 文件系统
- **uploads 目录**：当前 copied 模式（照片复制到 uploads/），未来可能 referenced + storage_mode
- **Electron 路线**：API Route 暂不迁移 IPC，保留 HTTP 模式便于开发调试
- **无 ORM**：直接 SQL，COALESCE 处理 date_taken/created_at fallback

---

## UI Philosophy

- **风格参考**：Apple Photos（浏览）/ Eagle（管理）/ Linear（效率）
- **色彩**：低饱和，灰度优先，黑白灰为主。数据可视化只用灰度，禁止彩色 chart
- **摄影作品优先**：照片直角（rounded-none），不裁切，不留圆角。UI chrome 可以圆角，照片不行
- **信息密度**：首页三层节奏（upload+stats → filter → waterfall），gap-10 间距
- **Modal**：bg-black/92 沉浸式，照片直接浮在暗色背景上，无白色容器包裹
- **禁止**：dashboard 风格、彩色 badge、过度 hover 动效、emoji 装饰

---

## Collection State Machine

```
draft → ready → published
  ↑       ↑        ↓
  └───────┴────────┘
```

| 状态 | 含义 | 可用操作 |
|------|------|---------|
| `draft` | 堆叠照片，未整理 | 排序、删图、设封面、→ ready |
| `ready` | 已整理，可设置比例 | 设置 bookmark_ratio、→ published / → draft |
| `published` | 全屏阅读模式 (BookViewer) | 导出 PDF、→ ready / → draft |

- published 下照片不出现在首页瀑布流（unarchived 查询 `collection_id IS NULL`）

---

## PDF Export Rules

- **摄影书不是网页**：固定页面尺寸 (420pt 基准)，不是 A4 文档，不是网页截图
- **caption 不可跨页**：contentColumn → imageArea(flex:1) + captionArea(height:48px)
- **Image 约束**：`maxWidth/maxHeight` 而非 `width/height` — react-pdf 同时设两个维度会拉伸图片破坏 objectFit
- **留白来自 objectFit**：`objectFit: contain` 自动为 portrait/landscape 创建不同留白，不要手动方向检测
- **字体**：Songti SC (宋体-简) Regular，react-pdf 自动 subset（只嵌入使用的 glyph）
- **图片优化**：导出前 sharp resize(max 3000px) + JPEG(quality 0.85)，lib/export/image.ts

---

## Known UI Bugs & Lessons

1. **overflow-hidden 裁切直角照片**：父容器 `rounded-xl overflow-hidden` 会裁切 img 的直角。解决方案：移除 overflow-hidden
2. **aspect-ratio + max-height 百分比失效**：CSS aspect-ratio 不产生显式 height，子元素 `max-height:100%` 无法解析百分比。解决方案：absolute inset-0 定位
3. **react-pdf Image width+height 100% 拉伸**：显式 width+height 强制 Image 匹配父容器宽高比，objectFit 失效。解决方案：maxWidth/maxHeight
4. **JPEG SOF 字节扫描方向检测不可靠**：嵌入 EXIF 缩略图先于主图 SOF 被扫描命中。解决方案：不要字节解析，信任 objectFit
5. **react-pdf 分页系统真实分页**：超出 Page 固定高度的内容真的被推到下一页。解决方案：先划分区域再填充
6. **月度柱状图空值**：CSS `height:2%` 在 flex child 中解析为 0px。解决方案：JS 计算像素高度

---

## Code Style Rules

- **不要大重构** — 优先增量修改
- **优先复用现有 API** — 不新建重复 endpoint
- **不引入复杂状态管理** — 无 Redux/Zustand，useState + useCallback 足够
- **服务端计算优先** — SQL ORDER BY / COALESCE，不在前端对大数组排序
- **不提前设计** — 不写"未来可能用到"的抽象
- **中文 UI / 英文代码** — 注释中文，标识符英文
- **commit message 中文** — 描述 WHY，不是 WHAT

---

## Current Priorities (2026-05)

- Electron Desktop 化
- 摄影书阅读体验打磨
- PDF 出版质量（排版、字体、留白）
- AI 摄影分析（未来）

---

## Change Log

### 2026-05-31

#### Feature
- lib/export/image.ts — sharp 导出图优化（max 3000px + JPEG 0.85）
- Export Metrics — PDF 导出时 console 输出页数/图片/体积/优化率
- CLAUDE.md — AI Agent 长期记忆文件

#### Bug Fix
- BookViewer portrait 照片溢出 — absolute inset-0 + object-contain
- PDF portrait→landscape 拉伸 — width/height 100% → maxWidth/maxHeight
- PDF caption 跨页 — contentColumn → imageArea(flex:1) + captionArea(48px)
- JPEG SOF 方向检测误判 — 移除字节扫描

#### Architecture
- resolveBookImages() 同步 → 异步（集成 sharp 优化）
- Export Pipeline 增加图片优化层

### 2026-05-26

#### Feature
- Export Pipeline v1 (types/schema/layout/pdf)
- BookDocument 中间结构 → react-pdf PhotoBook → PDF 下载
- Songti SC 字体注册 + Font.register()
- Activity Heatmap (GitHub contribution 风格)
- StatsPanel 数据可视化

#### Bug Fix
- PDF 中文乱码 — Songti SC 替换内置字体
- Photos 时间排序 — COALESCE(date_taken, created_at)
- FilterBar 信息收敛 — 仅保留 camera + lens
- StatsPanel 月度时间线空值 — JS pixel bar 替换 CSS %

---

## Agent Working Rules

**禁止：**
- 大规模重构已稳定模块
- 修改已稳定 UI 风格
- 引入复杂状态管理库
- 重写现有 API Route
- 提前设计"未来可能用到"的抽象
- 修改 BookDocument schema 除非必要

**优先：**
- 小步修改、增量演进
- 保持已有行为
- 保持摄影产品感（不是后台管理面板）
- 最小化 diff、不碰无关文件
- 修复后更新此文件

**每次修改前：** 读取此文件
**每次修改后：** 更新 Change Log + 受影响章节
