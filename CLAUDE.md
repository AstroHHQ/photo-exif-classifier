# CLAUDE.md — AI Agent Memory

> 面向 Claude / AI Coding Agent。不是 README。
> 每次功能/bug/架构变更后自动更新。

---

## Documentation Hierarchy

本项目有三层文档系统，各司其职：

| 层 | 文件 | 读者 | 内容 |
|---|------|------|------|
| 1 | `README.md` | 人类开发者 | 项目概览、技术栈、功能列表、数据流、API 表、数据库结构、启动说明 |
| 2 | `CLAUDE.md` | AI Agent | 架构规则、UI Philosophy、Bug 教训、Export 规则、开发约束、Change Log |
| 3 | `~/.claude/projects/.../memory/` | 跨会话持久化 | 用户偏好、项目方向、反馈记录、外部参考 |

**规则：**
- README 不写 Bug 教训、Agent 规则、UI 禁止事项、AI Memory、Prompt 规范
- CLAUDE.md 允许非常长 — 它是 AI IDE Context，不是给人读的
- memory/ 存跨会话持久化偏好，CLAUDE.md 存项目级开发规则
- 信息不重复 — 同一事实只在一处出现

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
- **Storage Architecture V2**：referenced（默认，删除仅移除记录）和 copied（历史，删除同步删文件）。UploadZone 默认引用模式
- **摄影集删除 = 移出集合**：`collection_id` 置 NULL，照片回到瀑布流。摄影集不拥有照片，不删除原始文件
- **Electron 路线**：API Route 暂不迁移 IPC，保留 HTTP 模式便于开发调试
- **无 ORM**：直接 SQL，COALESCE 处理 date_taken/created_at fallback

### Statistics Data Source 规则

**Statistics ≠ Current Waterfall — 这是摄影产品设计决策，不是 bug。**

| 范围 | 函数 | SQL |
|------|------|-----|
| 全库统计 | `getAllPhotos()` | `SELECT * FROM photos` |
| 瀑布流 | `getUnarchivedPhotos()` | `WHERE collection_id IS NULL` |

- `lib/stats.ts` → `getStats()` 使用 `getAllPhotos()` — 统计整个摄影库
- `PhotoContainer.tsx` → `/api/photos?unarchived=1` — 仅显示未归档照片
- StatsPanel、PhotographyInsights 均通过 `/api/stats` 获取全库数据
- 照片导入摄影集后统计不变 — 相机/镜头/焦段/光圈/时段分布不受归档影响
- **禁止**将统计改为 `collection_id IS NULL` 过滤 — 这会导致归档照片从统计中消失

### z-index 分层规则

| 层级 | z-index | 用途 |
|------|---------|------|
| 普通内容 | 默认 | 页面主体、卡片 |
| 导航栏 | `z-50` | layout.tsx sticky header |
| 全屏容器 | `z-[60]` | published 阅读模式、全屏弹窗 |

全屏容器必须高于导航栏（60 > 50），否则 toolbar 按钮被导航栏遮挡。

### storage_mode 架构意义

- `copied`：当前 Web MVP 模式，上传时复制文件到 `uploads/`
- `referenced`：未来 Electron/mac App 模式，数据库只存路径，不复制文件
- `lib/file.ts` 提供 `getPhotoUrl(photo)` 抽象层，UI 层不直接拼接文件 URL
- 未来切换模式只需改 `getPhotoUrl` 实现，UI 层零改动

### BookViewer 与页面状态职责分离

- `BookViewer` 组件只负责翻页阅读（图片展示 + 键盘翻页），不包含导航/退出/状态切换
- 导航和状态切换由 `collections/[id]/page.tsx` 页面级 toolbar 统一管理
- `BookViewer` 无 onBack、无 Esc 退出、无编辑按钮
- 原因：BookViewer 曾在内部放返回按钮，导致与页面 toolbar 重复，产生双重导航 bug

---

## UI Philosophy

### 核心原则

- **风格参考**：Apple Photos（浏览）/ Eagle（管理）/ Linear（效率）
- **色彩**：低饱和，灰度优先，黑白灰为主。数据可视化只用灰度，禁止彩色 chart
- **摄影作品优先**：照片直角（rounded-none），不裁切，不留圆角。UI chrome 可以圆角，照片不行
- **信息密度**：首页三层节奏（upload+stats → filter → waterfall），gap-10 间距
- **Modal**：bg-black/92 沉浸式，照片直接浮在暗色背景上，无白色容器包裹
- **禁止**：dashboard 风格、彩色 badge、过度 hover 动效、emoji 装饰

### 语言约定

- **用户可见 UI**：统一中文（删除、导入摄影集、发布、重新编辑、确认、取消）
- **技术代码**：英文（handleDelete、collection_id、storage_mode、getScatterTransform）
- **注释**：中文

### 色彩语义

| 元素 | 颜色 | 语义 |
|------|------|------|
| draft 状态标签 | `amber` | 温暖、素材阶段 |
| ready 状态标签 | `blue` | 冷静、已就绪 |
| published 状态标签 | `green` | 完成、已发布 |
| 删除按钮 | `red` | 危险操作 |
| 导入按钮 | `blue` | 有益操作 |
| 进度条 0-20% | `red` | 刚开始 |
| 进度条 80-100% | `green` | 接近完成 |

### PhotoCard Visual Language

瀑布流 PhotoCard 遵循"照片优先"原则，操作和信息不抢占照片注意力。

**照片展示：**
- **直角照片**：`rounded-none`，模拟相纸 / contact sheet / 摄影书页面感
- **容器微圆角**：卡片容器保留 `rounded-xl`，作为照片的展示框

**信息层级：**

| 层级 | 元素 | 可见条件 |
|------|------|----------|
| 默认 | 照片本身 | 始终可见 |
| hover | metadata overlay（相机 · 焦段 · 光圈） | 鼠标悬停，底部渐变浮现 |
| hover | 操作图标（导入 + / 删除） | 鼠标悬停，右上角浮现 |
| 始终 | 编辑控件（排序 / 封面） | 仅摄影集编辑模式显示 |

**操作按钮：**
- 默认隐藏：导入（+）和删除（垃圾桶图标）仅在 hover 时显示
- 半透明背景：`bg-black/40` 圆形图标按钮，不抢照片注意力
- hover 增强：`bg-black/60` 或 `bg-red-500`（删除）

**hover 动画：** 仅允许三种效果：`opacity`（overlay 淡入）、`shadow`（shadow-sm → shadow-lg）、`translateY`（-0.5 上浮）。不使用 scale、bounce、spring。

**间距：** PhotoGrid 列间距 `gap-8`，卡片底部间距 `mb-8`，照片之间呼吸感。

**设计意图：** 目标气质：摄影 contact sheet / 艺术档案 / 摄影师工作台。不是：SaaS dashboard / 后台管理系统。

### Homepage Layout Philosophy

首页布局遵循"从动作到内容"的心流路径：

```
上传区 (动作入口)
  ↓ gap-10
StatsPanel (数据洞察)
  ↓ gap-10
FilterBar (筛选 + 排序)
  ↓ gap-8
PhotoGrid (瀑布流)
```

三层之间用 `gap-10` (40px) 留白隔开，形成清晰的视觉节奏。上传区是行内紧凑条而非大面积拖拽框 — 用户可能只会上传一次，之后主要浏览和筛选。

**与摄影集的关系：** 首页不是"全部照片"，是"未组织的素材"。照片归入 Collection 后从首页消失（unarchived 查询 `collection_id IS NULL`）。

### Modal Viewing Experience

- 全屏遮罩 `bg-black/92`，照片直接浮在暗色背景
- 左图右信息（desktop），上图下信息（mobile）
- 键盘导航：← → 切换照片，Esc 关闭
- 无白色容器包裹照片 — 让照片成为唯一视觉焦点

### StatsPanel Visual Philosophy

- 6 维度横向滚动卡片（相机、镜头、焦距、ISO、光圈、快门）
- 纯灰度配色：`bg-gray-100` 背景，`bg-gray-800` 高亮条
- 每维度 Top 5，其余聚合为"其他 N 项"
- 进度条宽度用百分比，不是像素 — 保证跨维度可比

### Activity Heatmap System

GitHub contribution 风格每日拍摄日历。核心设计决策：

- **不是统计图表，是摄影节奏可视化** — 让摄影师看到自己的拍摄节奏和"空白期"
- **灰度单色**：`bg-gray-100` (0张) → `bg-gray-300` → `bg-gray-500` → `bg-gray-700` → `bg-gray-900` (4+张)
- **数据源**：`getAllPhotoDates()` — `COALESCE(date_taken, created_at)` 确保无 EXIF 照片也参与统计
- **实现**：服务端 API `/api/stats?type=heatmap` → 客户端 53 列 × 7 行 grid
- **空值处理**：无照片日期显示为 `bg-gray-50`，与 0 张的 `bg-gray-100` 区分

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
| `ready` | 已整理，可设置比例 | 设置 book_ratio、→ published / → draft |
| `published` | 全屏阅读模式 (BookViewer) | 导出 PDF、→ ready / → draft |

### 状态语义

| 状态 | 语义 | UI 模式 |
|------|------|---------|
| `draft` | 素材散落阶段，仍在选片整理 | 编辑模式（PhotoGrid + PhotoModal） |
| `ready` | 整理完成，等待发布 | 编辑模式（PhotoGrid + PhotoModal） |
| `published` | 已出版冻结，只读展示 | 阅读模式（BookViewer 全屏） |

### 首页未归档原则

- 首页只显示 `collection_id IS NULL` 的照片
- `GET /api/photos?unarchived=1` 对应 `getUnarchivedPhotos()`
- 照片一旦归入 Collection，立即从首页消失

### Published 冻结原则

- 已锁定：禁止导入新照片（API 层 400 + UI 层过滤下拉框）
- 待锁定（后续版本）：删除照片、修改排序、编辑备注
- 解锁方式：published → ready → 修改 → 重新发布
- 双重校验：UI 层过滤（`?editable=1`）+ API 层验证（PATCH 前检查 targetCollection.status）

### 版本系统

- 初始值：创建时为 1
- 递增时机：ready / draft → published 时自动 +1
- 不递增：published → ready / draft 回退时保持不变
- 含义："发布了多少次"，而非内容快照版本

### Draft Visual Style

draft 摄影集使用"散落照片"视觉语言，表达仍在整理中的创作状态。

- 基于 `photo.id` 的 Knuth 乘法哈希生成可复现伪随机偏移
- 每张预览照片有独立锚点（top: 2%~18%, left: 2%~18%）+ rotate（±11°）
- 图片缩至 78%，留出散落空间
- 同一摄影集每次渲染结果完全一致

| 状态 | 预览风格 | 语义 |
|------|----------|------|
| draft | 不同锚点 + 独立旋转 + 重叠 | 仍在整理，素材散落在桌面上 |
| ready | 规整 6px 递进偏移堆叠 | 已整理完毕，等待发布 |
| published | 单张封面图 | 已出版，正式作品集 |

---

## PDF Export Rules

### 核心原则

摄影书导出不是"把照片放进 PDF"，而是将数字档案转化为适合阅读的摄影出版物。

- **摄影书，不是文档**：大留白、黑白灰、极简页码、宋体 caption
- **比例跟随 Collection**：PDF 页面尺寸使用 Collection 的 book_ratio，不是固定 A4
- **图片居中**：`object-contain`，白色背景，留白作为"书页"
- **阅读体验优先**：420pt 页面（≈14.8cm）上的照片不需要 6000px 原图 — 人眼在阅读距离无法分辨差异

### Export Architecture

```
Collection + Photos
       ↓
buildBookDocument()          ← schema.ts
       ↓
BookDocument (中间结构)
       ↓
resolveBookImages()          ← schema.ts (加载图片 base64 + sharp 优化)
       ↓
PhotoBook (react-pdf)        ← pdf.tsx (renderer)
       ↓
renderToBuffer() → PDF
```

- **schema.ts**：Collection → BookDocument（数据转换，与输出格式无关）
- **layout.ts**：页面尺寸、边距、排版常量（所有 renderer 共用）
- **pdf.tsx**：PDF renderer（只是 BookDocument 的一个渲染目标）
- **types.ts**：BookDocument / Page 类型定义

未来扩展（IDML / EPUB / Web Book）只需新增 renderer，复用 `buildBookDocument()` 和 `layout.ts`。

### 页面类型

| 类型 | 说明 | 用途 |
|------|------|------|
| `cover` | 封面（全幅照片或标题文字） | 第一页 |
| `full-bleed` | 照片铺满页面 | 关键作品跨页 |
| `image-with-caption` | 照片 + 下方 caption | 标准照片页 |
| `spread` | 跨页照片 | 横幅作品（待实现） |

### PDF 布局规则

- **caption 不可跨页**：contentColumn → imageArea(flex:1) + captionArea(height:48px)
- **Image 约束**：`maxWidth/maxHeight` 而非 `width/height` — react-pdf 同时设两个维度会拉伸图片破坏 objectFit
- **留白来自 objectFit**：`objectFit: contain` 自动为 portrait/landscape 创建不同留白，不要手动方向检测
- **页码不参与布局流**：`position: absolute` 固定在页面底部 18pt 处

**最终稳定布局：**

```
Page
├── contentColumn (flex:1, column)
│   ├── imageArea (flex:1, overflow:hidden)
│   │   └── Image (maxWidth:100% maxHeight:100% objectFit:contain)
│   └── captionArea (height:48px)
└── pageNumber (position:absolute, bottom:18)
```

### PDF Font System

react-pdf 内置字体（Helvetica、Times-Roman、Times-Italic）不支持中文字符，需要注册 CJK 字体。

**字体选择：Songti SC（宋体-简）**
- 来源：macOS 系统字体 `/System/Library/Fonts/Supplemental/Songti.ttc`
- 提取：使用 fontTools 从 TrueType Collection 中提取 Regular 字重为独立 `.ttf`
- 存放位置：`public/fonts/SongtiSC-Regular.ttf`（~20MB）
- 注册方式：`Font.register({ family: "SongtiSC", src: "public/fonts/SongtiSC-Regular.ttf" })`
- 注册位置：`lib/export/pdf.tsx` 模块顶层（react-pdf 要求在组件渲染前完成注册）

**为什么是宋体：** 衬线体（serif）与摄影书的艺术气质一致。传统中文排版中正文和标题默认使用宋体。与 Helvetica 无衬线英文标题形成内在对比。

**字体子集化：** react-pdf 底层 PDFKit 自动执行 `font.createSubset()` → `subset.includeGlyph()` → `subset.encode()`。仅嵌入 PDF 中实际使用的 glyph，而非完整 20MB 字体文件。这是引擎级别自动行为，无需额外配置。

### Export Typography

- **封面**：18pt 宋体标题、深灰 `#333`、+1 字母间距，极简。标题即封面
- **Caption**：9pt 宋体、中灰 `#666`、居中对齐、无斜体。中文不用斜体（传统中文排版不使用 italic）
- **页码**：7pt 宋体、浅灰 `#999`、页面底部居中。封面不显示页码
- **留白哲学**：照片页 36pt 上/左/右留白 + 56pt 下留白。留白是摄影书的一部分，不是浪费
- **黑色文字，白色页面**：无彩色、无渐变、无装饰元素。让设计隐退

### Export Image Pipeline

```
原始照片（6000×4000, ~8MB JPEG）
    ↓
optimizeExportImage()                         ← lib/export/image.ts
    ↓ sharp.resize(3000, 3000, fit: "inside")
    ↓ sharp.jpeg({ quality: 85 })
    ↓
导出图片（3000×2000, ~300KB JPEG）
    ↓
base64 data URL → BookDocument Page → PDF embed
```

- 最长边限制 3000px，JPEG quality 0.85（视觉无损，文件减小 60-80%）
- 不上传时限制尺寸 — 上传照片用于全屏查看（PhotoModal）需要原始分辨率
- `lib/export/image.ts` 是所有 renderer 共用的导出图片处理入口
- JPEG quality 0.85 在印刷/屏幕显示中视觉无损

### PDF Page Layout Bug 教训（三次迭代）

**Bug #1 — caption 跨页：** `Image` 使用 `height: "100%"` + imageContainer `flex: 1` → 图片占满整个 Page，caption 无布局空间。
修复：显式划分 `contentColumn` → `imageArea` (flex: 1) + `captionArea` (height: 48px)

**Bug #2 — width/height 100% 拉伸 + 页码覆盖（修复 Bug #1 引入）：** `Image` 同时设置 `width: "100%"` 和 `height: "100%"` 强制匹配父容器宽高比，`objectFit: "contain"` 失效，图片拉伸变形。
修复：改用 `maxWidth: "100%" maxHeight: "100%" objectFit: "contain"`

**Bug #3 — JPEG SOF 字节扫描误判方向：** `getImageOrientation()` 逐字节扫描 SOF marker，但嵌入 EXIF 缩略图（如 160×120）先于主图被命中，导致方向误判。
修复：移除 `getImageOrientation()`，信任 `objectFit: "contain"` 自动适配

**关键教训：**
- react-pdf Image 不要同时设 `width` 和 `height` 为 100%
- `objectFit` 在 max 约束下正确，在显式 width+height 下失效
- JPEG 字节扫描不可靠（缩略图干扰），不要在 renderer 中检测图片方向
- `objectFit: "contain"` 天然适配 portrait/landscape 混合排版
- react-pdf 分页系统真实分页 — 超出 Page 固定高度内容真的被推到下一页

### PDF 与 Web 布局差异

| 概念 | Web (CSS) | PDF (react-pdf) |
|------|-----------|-----------------|
| 页面 | 无限滚动 | 固定尺寸 Page |
| 溢出 | scroll / hidden | 自动分页到下一页 |
| flex 高度解析 | 视口高度 | Page 固定高度 |
| 位置 | 相对视口 | 相对当前 Page |
| Image sizing | width/height 100% + objectFit 正常 | 应使用 maxWidth/maxHeight + objectFit |

**新增页面类型时的检查清单：**
- [ ] 所有内容在 Page 固定高度内吗？
- [ ] caption 和 photo 在同一页吗？
- [ ] Image 使用的是 `maxWidth`/`maxHeight` 而非 `width`/`height` 吗？
- [ ] 没有 JPEG 字节解析或图片方向检测逻辑吗？
- [ ] 固定高度元素（caption、页码）在 flex 容器外吗？

---

## Known UI Bugs & Lessons

1. **overflow-hidden 裁切直角照片**：父容器 `rounded-xl overflow-hidden` 会裁切 img 的直角。解决方案：移除 overflow-hidden。PhotoCard 照片 `rounded-none` + 容器 `rounded-xl`。

2. **aspect-ratio + max-height 百分比失效**：CSS `aspect-ratio` 不产生显式 height，子元素 `max-height:100%` 无法解析百分比。解决方案：absolute inset-0 定位。具体：BookViewer 中 img 从 `max-w-full max-h-full object-contain` 改为 `absolute inset-0 w-full h-full object-contain`。

3. **react-pdf Image width+height 100% 拉伸**：显式 width+height 强制 Image 匹配父容器宽高比，objectFit 失效。解决方案：maxWidth/maxHeight。

4. **JPEG SOF 字节扫描方向检测不可靠**：嵌入 EXIF 缩略图先于主图 SOF 被扫描命中。解决方案：不要字节解析，信任 objectFit。

5. **react-pdf 分页系统真实分页**：超出 Page 固定高度的内容真的被推到下一页。解决方案：先划分区域再填充。

6. **月度柱状图空值**：CSS `height:2%` 在 flex child 中解析为 0px。解决方案：JS 计算像素高度（Activity Heatmap）。

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

## Photography Insights System

规则引擎驱动的摄影习惯分析卡片。核心设计决策：

- **不是 AI**：纯规则引擎，无大模型依赖，零成本、完全离线
- **数据复用**：共享 `/api/stats`，不新增 DB 查询。Stats 接口扩展 `timeOfDay` 字段
- **规则函数签名**：`(stats: Stats) => Insight | null` — 每条规则独立，可单独替换
- **阈值设计**：焦段 25%、光圈 60%、设备 40% — 避免弱信号触发无意义洞察
- **展示位置**：首页 UploadZone 下方，与 StatsPanel 并列，高度接近

### UI 哲学

- Apple Photos 年度回顾 + Notion 卡片风格
- 编号 + 标题 + 数据百分比，不含糊其辞
- 禁止营销文案（"解锁你的摄影潜力"）、ChatGPT 风格（"看起来你是个…"）
- 底部标注"规则引擎生成 · 非 AI"，诚实透明

## Change Log

### 2026-06-16

#### Feature
- Homepage Information Architecture V2 — 首页重构为照片优先的双栏 Hero 布局
- HeroInsights — 首页自然语言摄影摘要（无图表、无百分比、无统计细节）
- DashboardOverview — 首页精简 Dashboard（总数 + 近 30 天 + 热力图 + 设备名称）
- Analytics Page (`/analytics`) — 独立统计分析页面，承载完整 StatsPanel + PhotographyInsights
- 导航栏新增「统计分析」入口

#### Architecture
- 首页视觉层级：照片（主体）> 洞察（摘要）> 数据（概览）
- 统计模块从首页迁移到 `/analytics`——首页不再承担统计中心角色
- `app/page.tsx` → Hero 双栏（左 35% UploadZone + HeroInsights，右 65% DashboardOverview）
- `app/analytics/page.tsx` → StatsPanel + PhotographyInsights 完整展示
- `components/HeroInsights.tsx` → 从 /api/stats 生成自然语言摘要行
- `components/DashboardOverview.tsx` → MiniHeatmap + StatFigure + 设备摘要
- StatsPanel 保留完整五段 Dashboard（仅用于 Analytics 页面）
- UploadZone 在首页左栏紧凑展示（视觉权重降低）

#### Feature
- FilterBar 完全重写 — 6 维度筛选系统（相机 / 镜头 / 时间 / 焦段 / 备注 / 搜索）
- 时间筛选 8 种预设 — 全部、今天、7天、30天、90天、本年、年份、自定义范围
- 焦段筛选 — 6 类摄影语言范围（超广角 / 广角 / 标准 / 中长焦 / 长焦 / 超长焦）
- 备注筛选 — 全部、有备注、无备注
- 关键词搜索 — 文件名 + 备注 模糊匹配
- 4 种排序 — date_desc、date_asc、imported_desc、imported_asc
- PhotoContainer 客户端筛选引擎 — `matchesTimeFilter()` + `filteredPhotos` useMemo 统一过滤
- 首页筛选哲学 — "首页负责找照片，Analytics 负责分析照片，摄影集负责组织照片"

#### Architecture
- `lib/focalRanges.ts` — 共享焦段计算模块，从 stats.ts 提取供前后端复用
- `computeEquivalentFocalLength()` 签名变更 — 从 `(photo: Photo)` 改为 `(focalLength35mm, cameraModel, focalLength)` 三个独立参数
- `lib/db.ts` `getUnarchivedPhotos()` — switch 分支支持 4 种排序（date_desc/date_asc/imported_desc/imported_asc），date 类使用 COALESCE(date_taken, created_at)
- `app/api/photos/route.ts` — sort 参数类型扩展为 4 种
- `components/FilterBar.tsx` — Props 从 ~12 扩展到 ~25，三行布局（搜索+排序 / 筛选下拉+pill / 条件行）
- `components/PhotoContainer.tsx` — 新增 timeFilter/noteStatus/focalRange/searchQuery/sortOrder 状态 + 客户端过滤逻辑
- `components/PhotoCard.tsx` — PhotoData 接口新增 `focal_length_35mm`、`created_at` 字段
- 明确排除 ISO/光圈/快门 筛选 — 这些属于 Analytics 页面分析维度，不属于首页找照片维度
- `README.md` 新增「Photo Library Filtering Philosophy」章节 — 三页职责表 + 筛选架构 + 排除列表

### 2026-06-14

#### Feature
- 等效焦段引擎 — 35mm Equivalent Focal Length 三级换算（EXIF 标签 → Crop Factor 检测 → 原始值退回）
- Crop Factor 自动检测 — 从相机型号字符串识别画幅（Sony/Canon/Nikon/Fujifilm/Leica/RICOH）
- 摄影语言分布 — 6 类焦段范围（超广角 ≤20 / 广角 21-35 / 标准 36-70 / 中长焦 71-105 / 长焦 106-200 / 超长焦 200+）
- Photography Dashboard 升级 — StatsPanel 重构为五段 Dashboard（Activity/Camera/Lens/Focal Language/Evolution）
- Activity 计数卡片 — 30 天 / 90 天 / 本年累计 / 总照片数
- Lens Usage — Top 5 镜头使用分布
- 垂直柱状图 — 纯 CSS 六段摄影语言分布（灰度色阶、百分比标注）
- Photography Evolution — 12 个月堆叠柱状图时间轴，追踪摄影语言变化趋势
- PhotographyInsights — ruleFocalLanguage（摄影语言倾向）+ ruleFocalEvolution（摄影语言演变）
- `focal_length_35mm` 数据库列 — 存储 EXIF FocalLengthIn35mmFilm 标签值

#### Architecture
- `lib/exif.ts` → ExifData 新增 `focalLength35mm: number | null`
- `lib/db.ts` → Photo 接口新增 `focal_length_35mm`，insertPhoto SQL 更新，ALTER TABLE 迁移
- `lib/stats.ts` → `detectCropFactor()` `parseFocalLengthMm()` `classifyFocalRange()` `computeEquivalentFocalLength()` + `FocalDistribution` 类型 + `monthlyFocalDistribution` 字段 + `last90Days`/`yearlyCount`
- `app/api/upload/route.ts` → 上传时传递 `focal_length_35mm` 到 DB
- `FOCAL_RANGES` 常量定义 6 类摄影语言范围（min/max/range/mm label）
- StatsPanel 新增 `VerticalBarChart`（纯 CSS 柱状图）、`EvolutionTimeline`（12 月堆叠柱）、`StatCount`、`UsageBar` 组件
- PhotographyInsights 新增 `ruleFocalEvolution`（比较最近 3 个月 vs 整体分布，检测 ≥10pp 偏移）
- 移除 `ProportionBar` 组件，统一为 `UsageBar`

### 2026-06-12

#### Feature
- PhotographyInsights — 规则引擎摄影习惯分析卡片（5 条规则、3-5 条洞察）
- Stats 接口扩展 — 新增 `timeOfDay` 时段分布（上午/下午/傍晚/夜晚）
- Storage Architecture V2 — referenced 模式为默认，摄影集删除改为移出集合
- Batch Upload — 文件夹导入 + 多文件选择 + 自动分批（50张/批）+ 进度条
- Batch Delete — 多选 checkbox + 全选/反选 + 批量删除（区分 copied/referenced）+ 批量移出摄影集

#### Architecture
- Statistics Data Source 规则明确化 — `getStats()` 使用 `getAllPhotos()`（全库），瀑布流使用 `getUnarchivedPhotos()`（仅未归档），两者数据源独立
- `photos` 表新增 `original_path` 字段 — referenced 模式存储文件路径
- `insertPhoto()` 支持 `original_path`，上传 API 默认 `storage_mode = "referenced"`
- PATCH `/api/photos/[id]` 支持 `collection_id: null`（移出摄影集）
- 摄影集内删除照片 → 移出集合（`collection_id` 置 NULL），不删照片
- UploadZone 新增存储模式选择器（引用/复制），默认引用模式
- UploadZone 新增文件夹选择 + 分批上传（BATCH_SIZE=50）+ 进度条
- PhotoCard 新增多选 checkbox（左侧），selectable 模式
- PhotoGrid 新增批量操作工具栏（已选N张 · 全选 · 删除选中 · 取消选择）
- FilterBar 新增"选择"/"完成"切换按钮
- `batchDeletePhotos()` / `batchRemoveFromCollection()` — 事务内批量操作
- `DELETE /api/photos/batch` — 支持 library 和 collection 两种 context

### 2026-05-31

#### Feature
- lib/export/image.ts — sharp 导出图优化（max 3000px + JPEG 0.85）
- Export Metrics — PDF 导出时 console 输出页数/图片/体积/优化率
- CLAUDE.md — AI Agent 长期记忆文件
- 三层文档系统 — README (人类) / CLAUDE.md (AI) / memory/ (持久化偏好)

#### Bug Fix
- BookViewer portrait 照片溢出 — absolute inset-0 + object-contain
- PDF portrait→landscape 拉伸 — width/height 100% → maxWidth/maxHeight
- PDF caption 跨页 — contentColumn → imageArea(flex:1) + captionArea(48px)
- JPEG SOF 方向检测误判 — 移除字节扫描

#### Architecture
- resolveBookImages() 同步 → 异步（集成 sharp 优化）
- Export Pipeline 增加图片优化层
- README 大规模清理 — 迁移 ~500 行 dev/AI 内容到 CLAUDE.md

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
