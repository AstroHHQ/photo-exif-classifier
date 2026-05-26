# Photo Manager MVP

本地摄影照片管理工具，支持上传照片、自动读取 EXIF 信息、瀑布流展示、参数统计、备注，以及摄影集管理。

> **本文档定位**：AI Developer Handbook。供未来 AI Agent 快速理解项目架构、状态语义、视觉语言、已踩过的坑和开发原则。

---

## 技术栈

- **前端**：Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- **数据库**：SQLite（better-sqlite3，同步 API，WAL 模式）
- **EXIF 解析**：ExifReader（纯 JS，无需系统依赖）
- **语音输入**：Web Speech API（浏览器原生语音识别）

## 项目结构

```
photo-exif-classifier/
├── app/                                  # Next.js App Router
│   ├── layout.tsx                        # 根布局 — 顶部导航栏 + 内容区
│   ├── page.tsx                          # 首页 — 上传区 + 照片管理容器
│   ├── globals.css                       # 全局样式（Tailwind）
│   └── api/
│       ├── upload/route.ts               # POST — 上传照片、读 EXIF、写入 DB
│       ├── photos/route.ts               # GET  — 获取所有照片列表
│       ├── photos/[id]/route.ts          # PATCH / DELETE — 更新照片字段 / 删除照片
│       ├── photos/[id]/file/route.ts     # GET  — 返回照片原始文件
│       ├── photos/[id]/note/route.ts     # PATCH — 更新照片备注
│       └── stats/route.ts                # GET  — EXIF 参数统计聚合
│       ├── collections/route.ts          # GET/POST — 摄影集列表 & 创建
│       ├── collections/[id]/route.ts     # GET/PATCH — 摄影集详情 & 更新
│       └── collections/[id]/export/
│           └── route.tsx                 # GET — 导出摄影书 PDF
├── collections/
│   └── page.tsx                          # 摄影集列表页面（/collections）
├── components/                           # React 组件
│   ├── UploadZone.tsx                    # 拖拽上传组件（拖拽 + 点击，支持多文件 + 上传目标选择）
│   ├── PhotoContainer.tsx                # 照片管理容器（状态管理、筛选、弹窗控制）
│   ├── PhotoGrid.tsx                     # 瀑布流布局（CSS columns 响应式）
│   ├── PhotoCard.tsx                     # 单张照片卡片（缩略图 + EXIF 摘要 + 备注预览）
│   ├── PhotoModal.tsx                    # 照片详情弹窗（大图 + EXIF + 备注编辑 + 语音输入）
│   ├── CollectionCard.tsx                # 摄影集卡片（draft 散落 / ready 堆叠 / published 封面）
│   ├── BookViewer.tsx                    # 摄影集阅读模式（全屏单页翻页 + fade/slide 动画）
│   ├── StatsPanel.tsx                    # EXIF 统计面板（6 维度横向滚动卡片，Top 5）
│   └── FilterBar.tsx                     # 筛选栏（相机 / 镜头 + 时间排序 pill）
├── lib/                                  # 服务端工具库
│   ├── db.ts                             # SQLite 数据库（建表、增删改查、备注更新、摄影集操作）
│   ├── exif.ts                           # ExifReader 封装（提取 7 个拍摄参数）
│   ├── file.ts                           # 文件访问抽象层（copied / referenced 模式）
│   ├── stats.ts                          # 统计聚合（6 维度分组计数 + 筛选逻辑）
│   └── export/                           # 摄影书导出管道
│       ├── types.ts                      # BookDocument / Page 核心类型
│       ├── schema.ts                     # buildBookDocument() 构建中间结构
│       ├── layout.ts                     # 页面尺寸、边距、排版常量
│       └── pdf.tsx                       # PDF renderer（@react-pdf/renderer）
├── uploads/                              # 上传照片存储目录（UUID 命名）
├── photos.db                             # SQLite 数据库文件
├── package.json
├── tsconfig.json
├── next.config.ts
└── postcss.config.mjs
```

---

## Architecture Principles

### Collection 三态语义

Collection 有三个状态，不是线性流水线，而是语义不同的三种模式：

| 状态 | 语义 | 允许的操作 | UI 模式 |
|------|------|-----------|---------|
| `draft` | 素材散落阶段，仍在选片整理 | 增删照片、排序、备注、设封面 | 编辑模式（PhotoGrid + PhotoModal） |
| `ready` | 整理完成，等待发布 | 增删照片、排序、备注、设封面 | 编辑模式（PhotoGrid + PhotoModal） |
| `published` | 已出版冻结，只读展示 | 仅翻页阅读 | 阅读模式（BookViewer 全屏） |

**状态流转方向：**

```
draft ←→ ready ←→ published
         ↑        ↓
         └────────┘
```

- `draft → ready`：标记整理完成
- `ready → published`：发布，version +1
- `published → ready`：重新编辑（解锁修改）
- `published → draft`：取消发布（完全回退）

### 首页未归档原则

- 首页只显示 `collection_id IS NULL` 的照片
- `GET /api/photos?unarchived=1` 对应 `getUnarchivedPhotos()`
- 照片一旦归入 Collection，立即从首页消失
- 首页不是"全部照片"，而是"未组织的素材"

### Published 冻结原则

published 摄影集视为已出版内容，不可修改：

- **已锁定**：禁止导入新照片（API 层 400 + UI 层过滤下拉框）
- **待锁定**（后续版本）：删除照片、修改排序、编辑备注
- **解锁方式**：published → ready → 修改 → 重新发布
- 双重校验：UI 层过滤（`?editable=1`）+ API 层验证（PATCH 前检查 targetCollection.status）

### BookViewer 与页面状态职责分离

- `BookViewer` 组件只负责翻页阅读（图片展示 + 键盘翻页），不包含导航/退出/状态切换
- 导航和状态切换由 `collections/[id]/page.tsx` 页面级 toolbar 统一管理
- `BookViewer` 无 onBack、无 Esc 退出、无编辑按钮
- 原因：BookViewer 曾在内部放返回按钮，导致与页面 toolbar 重复，产生双重导航 bug

### z-index 分层规则

| 层级 | z-index | 用途 |
|------|---------|------|
| 普通内容 | 默认 | 页面主体、卡片 |
| 导航栏 | `z-50` | layout.tsx sticky header |
| 全屏容器 | `z-[60]` | published 阅读模式、全屏弹窗 |

> **规则**：全屏容器必须高于导航栏（60 > 50），否则 toolbar 按钮被导航栏遮挡。

### storage_mode 架构意义

- `copied`：当前 Web MVP 模式，上传时复制文件到 `uploads/`
- `referenced`：未来 Electron/mac App 模式，数据库只存路径，不复制文件
- `lib/file.ts` 提供 `getPhotoUrl(photo)` 抽象层，UI 层不直接拼接文件 URL
- 未来切换模式只需改 `getPhotoUrl` 实现，UI 层零改动

---

## Visual Language

UI 设计遵循"语义驱动视觉"原则。不同状态用不同视觉语言传达创作阶段。

### draft：散落 / Contact Sheet

- **隐喻**：摄影师桌面上散落的照片素材
- **实现**：每张预览照片独立锚点（top/left 基于 photo.id Knuth 哈希），rotate ±11°
- **关键**：不同锚点位置是散落感的来源，rotate 只起辅助作用
- **图片尺寸**：78%（留 22% 空间给散落偏移）
- **底板**：淡灰半透明矩形暗示"桌面"

### ready：规整 / 待出版

- **隐喻**：已整理好的照片叠，等待最终确认
- **实现**：规整 6px 递进偏移堆叠，无旋转
- **图片尺寸**：100%（填充容器）

### published：封面 / 作品集

- **隐喻**：一本已出版摄影书的封面
- **实现**：单张封面图（优先 cover_photo_id），`aspect-[4/3]`
- **进入后**：全屏 BookViewer 阅读模式，留白、干净、无编辑控件

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

### 语言约定

- **用户可见 UI**：统一中文（删除、导入摄影集、发布、重新编辑、确认、取消）
- **技术代码**：英文（handleDelete、collection_id、storage_mode、getScatterTransform）
- **注释**：中文
- **README**：中文

---

## 功能列表

- **拖拽 / 点击上传**：支持拖拽多张 JPG/PNG 照片到上传区，也支持点击选择文件批量上传，显示上传进度和 EXIF 摘要
- **自动读取 EXIF**：上传时自动提取相机型号、镜头型号、焦距、ISO、光圈、快门速度、拍摄时间 7 个字段
- **照片瀑布流**：CSS columns 实现响应式瀑布流布局（移动端 1 列 → sm 2 列 → lg 3 列 → xl 4 列）
- **EXIF 统计面板**：6 个维度（相机、镜头、焦距、ISO、光圈、快门）的 Top 5 分布统计，以横向滚动卡片展示
- **筛选栏**：4 个下拉选择器（相机 / 镜头 / 光圈 / ISO），选中即时生效，支持一键清除所有筛选
- **照片详情弹窗**：点击照片打开全屏遮罩弹窗，左图右 EXIF，键盘 ← → 切换前后照片，Esc 关闭
- **备注功能**：支持手动输入备注，以及按住空格键（或麦克风按钮）触发浏览器语音识别，松开自动填入文字
- **备注预览**：照片卡片底部显示备注缩略文字，方便快速浏览
- **摄影集管理**：支持创建摄影集，将照片归入摄影集。draft（待整理）、ready（可发布）、published（已发布）三种状态流转，编辑进度追踪
- **摄影集封面**：可在摄影集详情页手动选择任意照片作为封面，published 状态优先展示封面
- **Published Book View**：published 摄影集进入全屏单页翻页阅读模式，按 sort_order 顺序浏览，支持键盘 ← → 和按钮翻页，带淡入滑动动画
- **上传目标选择**：上传时可选择上传到首页（未归档）、新建摄影集或已有摄影集，灵活组织照片归属
- **照片导入摄影集**：首页未归档照片可随时导入已有摄影集，一键归档，非复制文件，自动追加排序和封面

## 数据流

### 1. 上传流程

```
UploadZone（可选：选择上传目标 → 首页 / 新建摄影集 / 已有摄影集）
  → POST /api/upload（附带 collectionId 或 newCollectionTitle）
  → 保存文件到 uploads/（UUID 命名）
  → ExifReader 读取 EXIF
  → 如果 newCollectionTitle 存在：先创建 Collection
  → insertPhoto() 写入 SQLite（含 collection_id）
  → 返回上传结果及 EXIF 摘要
```

### 2. 展示流程

```
PhotoContainer → GET /api/photos?unarchived=1
  → getUnarchivedPhotos() 从 SQLite 查询（collection_id IS NULL）
  → PhotoGrid 渲染瀑布流
  → PhotoCard 通过 getPhotoUrl() 加载缩略图
```

### 3. 统计流程

```
StatsPanel → GET /api/stats
  → getStats() 从 SQLite 读取全量数据
  → 纯 JS reduce 内存聚合（6 维度分组计数）
  → 返回 Top 5 分布数据
```

### 4. 备注流程

```
PhotoModal（用户编辑备注）
  → PATCH /api/photos/[id]/note
  → updatePhotoNote() 更新 SQLite
  → 乐观更新本地 UI 状态
```

### 5. 图片文件

```
GET /api/photos/[id]/file
  → getPhotoById() 查数据库获取 filename
  → 从 uploads/ 读取文件返回（带 Cache-Control 缓存 1 天）
```

### 6. 摄影集

```
/collections 页面 → GET /api/collections
  → getAllCollections() + getCollectionPhotos() 预览（含进度统计）
  → CollectionCard 渲染（draft 散落 / ready 堆叠 / published 封面）

/collections/[id] 详情页（draft / ready）→ GET /api/collections/[id]
  → PhotoGrid 瀑布流 + 排序 / 备注 / 设为封面
  → 状态流转：draft → ready → published

/collections/[id] 详情页（published）→ BookViewer 阅读模式
  → 全屏单页翻页，按 sort_order 顺序浏览
  → 键盘 ← → / 按钮翻页
  → 淡入 + 微滑动入场动画
  → toolbar 由 page.tsx 管理，BookViewer 只负责翻页

上传到摄影集 → POST /api/upload + collectionId/newCollectionTitle
  → 照片带上 collection_id，不出现在首页瀑布流

设置封面 → PATCH /api/collections/[id] { cover_photo_id }
  → PhotoCard "设为封面"按钮触发，乐观更新本地状态
```

## Published Book View

published 摄影集提供全屏阅读模式（BookViewer），将摄影集变为摄影书 / 作品集。

- **入口**：从 `/collections` 点击 published 摄影集卡片
- **阅读顺序**：按 `sort_order` 升序排列（未排序照片靠后，按 id 升序）
- **翻页**：左右箭头按钮、键盘 ← → 方向键
- **退出**：页面顶部 toolbar 的"← 返回摄影集列表"链接、重新编辑 / 取消发布按钮
- **动画**：淡入 + 微向下滑动（0.3s ease-out）
- **隐藏**：编辑按钮、排序按钮、封面按钮、进度条 — 纯阅读体验
- **备注展示**：照片备注以斜体居中显示在照片下方
- **版本显示**：顶栏标题旁显示版本号（v1, v2, …）

### 导航方式

| 操作 | 方式 |
|------|------|
| 下一页 | 右侧圆形箭头按钮、键盘 → |
| 上一页 | 左侧圆形箭头按钮、键盘 ← |
| 退出阅读 | 页面 toolbar "← 返回摄影集列表" |

> **注意**：导航（返回 / 状态切换）由 `collections/[id]/page.tsx` 页面级 toolbar 统一管理。BookViewer 只负责翻页阅读，不包含自己的返回按钮或 Esc 退出逻辑。

### 与编辑模式对比

| 模式 | 状态 | 组件 | 可见功能 |
|------|------|------|----------|
| 编辑模式 | draft / ready | PhotoGrid + PhotoModal | 排序、备注、设封面、进度条、状态流转 |
| 阅读模式 | published | BookViewer | 翻页、查看备注、页码、版本号 |

## Version System

摄影集用 `version` 字段记录发布次数。

- **初始值**：创建时为 1
- **递增时机**：ready / draft → published 时自动 +1
- **不递增**：published → ready / draft 回退时保持不变
- **含义**："发布了多少次"，而非内容快照版本

### 状态流转与版本

```
draft → ready        版本不变
ready → published    版本 +1
published → ready    版本不变（"重新编辑"按钮）
published → draft    版本不变（"取消发布"按钮）
ready → published    版本 +1（再次发布）
```

### UI 展示

- **CollectionCard**：published 状态卡片上显示版本号徽章（如 `v3`）
- **BookViewer**：顶部标题旁显示版本号
- **详情页**：published 状态下提供"重新编辑"（→ ready）和"取消发布"（→ draft）两个回退按钮

## Storage Architecture

当前 Photo Manager 支持两种存储模式，为未来 Electron/mac App 做架构预留。

### `copied` 模式（当前 Web MVP）

上传照片时复制到 `uploads/` 目录，以 UUID 重命名。照片通过 `/api/photos/[id]/file` API 路由访问。

- **优点**：实现简单，适合 Web MVP
- **缺点**：重复占用磁盘空间，RAW 文件体积大时尤其浪费

### `referenced` 模式（未来 Electron/mac App）

不复制照片文件，数据库记录原始文件路径。未来通过 Electron 的 custom protocol 或 `file://` 直接读取。

- **优点**：零额外磁盘占用，保留用户原始目录结构
- **缺点**：需要本地运行环境（Electron）

### 文件访问抽象层 `lib/file.ts`

所有 UI 组件通过 `getPhotoUrl(photo)` 获取照片 URL，不直接拼接 `/api/photos/.../file`。未来切换到 `referenced` 模式时，只需修改 `getPhotoUrl` 的实现，UI 层无需改动。

### 关键字段

| 字段 | 说明 |
|------|------|
| `photos.filename` | `copied` 模式：uploads/ 下的 UUID 文件名；`referenced` 模式：原始文件绝对路径 |
| `photos.storage_mode` | `"copied"` 或 `"referenced"`，决定 `getPhotoUrl()` 行为 |

## Photo Deletion

照片删除通过 `DELETE /api/photos/[id]` 接口完成，支持首页未归档照片和摄影集内照片删除。

### 删除行为

| 存储模式 | 数据库 | 文件系统 |
|----------|--------|----------|
| `copied` | 删除 `photos` 记录 | 删除 `uploads/` 下的 UUID 文件 |
| `referenced` | 删除 `photos` 记录 | 不删除原始文件 |

### 关联数据处理

- **封面清理**：如果被删除照片是某个摄影集的封面（`cover_photo_id`），自动置 NULL
- **排序重排**：如果照片属于某摄影集且有 `sort_order`，删除后自动重整该摄影集内剩余照片的 `sort_order`（0, 1, 2, …）

### UI 交互

- PhotoCard 底部显示红色"删除"文字按钮（仅编辑模式可见，published 阅读模式不显示）
- 点击弹出原生 `window.confirm("确认删除这张照片？")`
- 确认后：DELETE API → 本地状态过滤移除（瀑布流立即刷新）

## Photo Archive

首页未归档照片可导入已有摄影集。这不是复制照片，只是将 `photos.collection_id` 从未归档（NULL）更新为目标摄影集 ID。

### 数据流

```
首页 PhotoCard "导入摄影集" 按钮
  → 选择目标摄影集（内联 <select>）
  → PATCH /api/photos/[id] { collection_id: xxx }
  → updatePhotoCollectionId() 写入 DB
  → 首页瀑布流即时移除该照片（已归档）
```

### 导入行为

- **非复制**：只更新 `collection_id`，不复制文件、不修改 `file_path`、不影响 `storage_mode`
- **自动排序**：新导入照片的 `sort_order` 设为当前摄影集内最大值 +1，追加到末尾
- **自动封面**：若目标摄影集尚未设置封面，第一张导入的照片自动成为封面

### UI 交互

- PhotoCard 底部显示蓝色"导入摄影集"文字按钮（仅未归档照片显示）
- 点击后展开内联选择器：`<select>` 下拉选择摄影集 + "确认" / "取消"按钮
- 确认后：PATCH API → 照片从首页瀑布流移除

## Published Lock Rules

published 摄影集视为已出版／已冻结，禁止内容修改。

### 当前锁定的操作

- **禁止导入照片**：`PATCH /api/photos/[id] { collection_id }` 目标为 published 时返回 400 `"已发布摄影集无法修改，请先重新编辑"`
- **UI 层面**：首页"导入摄影集"下拉框不显示 published 摄影集（`GET /api/collections?editable=1` 过滤）

### 解锁方式

如需修改 published 摄影集内容，必须先将其状态回退到 ready（"重新编辑"按钮），修改完成后再重新发布。

### 待锁定（后续版本）

published 状态下尚未锁定的操作：删除照片、修改排序、编辑备注。这些操作后续版本将逐步锁定，统一遵循"先回退再修改"的规则。

## Draft Visual Style

draft 摄影集使用"散落照片"视觉语言，表达仍在整理中的创作状态。

### 实现方式

- 基于 `photo.id` 的 Knuth 乘法哈希生成可复现伪随机偏移
- 每张预览照片有独立锚点（top: 2%~18%, left: 2%~18%）+ rotate（±11°）
- 图片缩至 78%，留出散落空间
- 同一摄影集每次渲染结果完全一致，不受刷新影响

### 视觉对比

| 状态 | 预览风格 | 语义 |
|------|----------|------|
| draft | 不同锚点 + 独立旋转 + 重叠 | 仍在整理，素材散落在桌面上 |
| ready | 规整 6px 递进偏移堆叠 | 已整理完毕，等待发布 |
| published | 单张封面图 | 已出版，正式作品集 |

## Book Ratio

published 摄影集支持预设摄影书比例，让封面和阅读体验更像真实摄影书。

### 预设比例

| 值 | 比例 | 名称 | 适用场景 |
|------|------|------|------|
| `4:5` | 竖版 | Portrait | 默认，适合大多数人像/竖构图作品 |
| `1:1` | 方形 | Square | 方形构图，Instagram 风格 |
| `3:2` | 横版 | Landscape | 横幅风光作品 |
| `2:3` | 长竖版 | Tall Book | 高挑竖构图，时装/建筑 |

### 生效范围

- **CollectionCard**：published 封面按比例显示（`object-contain`，白色背景，不裁切）
- **BookViewer**：照片容器按比例约束，图片 `object-contain` 适配，留白作为"书页"
- **默认值**：`4:5`（新创建 + 旧数据迁移）

### 设置方式

- ready 状态详情页显示比例选择器（4 个 pill 按钮）
- 点击即时 PATCH 更新 `collections.book_ratio`
- 发布时无需额外操作，当前设置的比例自动生效

### 设计原则

- 不裁切图片（`object-contain` 而非 `object-cover`）
- 白色背景模拟摄影书页面
- 仅支持预设比例，不允许自由输入，保持视觉一致性

## Export Pipeline

published 摄影集支持导出为摄影书 PDF。Export Pipeline 采用分层架构，为未来多格式输出预留扩展点。

### Photography Book Philosophy

这不是"文件导出功能"，而是摄影出版系统。PDF 是摄影书的数字形态，不是网页截图。

设计原则：
- **摄影书，不是文档**：大留白、黑白灰、极简页码、serif caption
- **比例跟随 Collection**：PDF 页面尺寸使用 Collection 的 book_ratio，不是固定 A4
- **图片居中**：`object-contain`，白色背景，留白作为"书页"
- **Typography**：caption 使用 `Times-Italic` serif 字体，light gray `#666`，`9pt`

### Export Architecture

```
Collection + Photos
       ↓
buildBookDocument()          ← schema.ts
       ↓
BookDocument (中间结构)
       ↓
resolveBookImages()          ← schema.ts (加载图片 base64)
       ↓
PhotoBook (react-pdf)        ← pdf.tsx (renderer)
       ↓
renderToBuffer() → PDF
```

关键分层：
- **schema.ts**：Collection → BookDocument（数据转换，与输出格式无关）
- **layout.ts**：页面尺寸、边距、排版常量（所有 renderer 共用）
- **pdf.tsx**：PDF renderer（只是 BookDocument 的一个渲染目标）
- **types.ts**：BookDocument / Page 类型定义

未来扩展（IDML / EPUB / Web Book）只需新增 renderer，复用 `buildBookDocument()` 和 `layout.ts`。

### 页面类型

BookDocument 的 Page 支持四种类型：

| 类型 | 说明 | 用途 |
|------|------|------|
| `cover` | 封面（全幅照片或标题文字） | 第一页 |
| `full-bleed` | 照片铺满页面 | 关键作品跨页 |
| `image-with-caption` | 照片 + 下方 caption | 标准照片页 |
| `spread` | 跨页照片 | 横幅作品（待实现） |

### 文件名规则

`{collection-title}-v{version}.pdf`，如 `tokyo-rain-v3.pdf`。标题中的非字母数字字符转为连字符。

### 技术实现

- **PDF 引擎**：`@react-pdf/renderer`（React 组件 → PDF，非 html2canvas / 截图）
- **图片加载**：`resolveBookImages()` 从 `uploads/` 读取照片转为 base64 data URL
- **API**：`GET /api/collections/[id]/export` → 返回 PDF 文件流
- **UI**：published 状态 toolbar 的"导出 PDF"按钮（`<a href>` 直接下载）

### 与现有系统的关系

- 不修改 Collection 数据结构
- 不修改照片存储方式
- Export Pipeline 是纯新增层，读取现有数据，生成输出文件
- 封面使用 `cover_photo_id`，照片顺序使用 `sort_order`

### PDF Font System

react-pdf 内置字体（Helvetica、Times-Roman、Times-Italic）不支持中文字符，中文 caption、标题、页码会显示为乱码或方框。需要注册 CJK 字体。

**字体选择：Songti SC（宋体-简）**

- 来源：macOS 系统字体 `/System/Library/Fonts/Supplemental/Songti.ttc`
- 提取：使用 fontTools 从 TrueType Collection 中提取 Regular 字重为独立 `.ttf`
- 存放位置：`public/fonts/SongtiSC-Regular.ttf`（~20MB）
- 注册方式：`Font.register({ family: "SongtiSC", src: "public/fonts/SongtiSC-Regular.ttf" })`
- 注册位置：`lib/export/pdf.tsx` 模块顶层（react-pdf 要求在组件渲染前完成注册）

**为什么是宋体**

思源宋体（Songti SC）是摄影出版物的自然选择：
- 衬线体（serif）与摄影书的艺术气质一致
- 传统中文排版中，正文和标题默认使用宋体
- 与 Helvetica 无衬线英文标题形成内在对比（中文 serif / 西文 sans-serif）

**字体文件大小**

单个 Regular 字重 ~20MB，包含完整 CJK 字符集。不在此仓库中进一步拆分 subset —— 摄影书 caption 可能使用任意汉字，无法预判字符集。

### Export Typography Philosophy

PDF 排版不是"把文字放上去"，而是摄影书视觉语言的一部分。

- **封面**：18pt 宋体标题、深灰 `#333`、+1 字母间距，极简。无作者署名、无日期、无页眉 —— 标题即封面
- **Caption**：9pt 宋体、中灰 `#666`、居中对齐、无斜体。中文不用斜体（传统中文排版不使用 italic，宋体本身就是正文体）
- **页码**：7pt 宋体、浅灰 `#999`、页面底部居中。只出现在照片页（封面不显示页码），不打断阅读节奏
- **留白哲学**：照片页 36pt 上/左/右留白 + 56pt 下留白（为 caption 和页码留空间）。留白是摄影书的一部分，不是浪费
- **黑色文字，白色页面**：无彩色、无渐变、无装饰元素。让照片和文字对话，让设计隐退

### 字体升级路径

当需要更丰富排版时：
- 添加 Bold 字重（`STSongti-SC-Bold`）用于章节标题
- 添加 Light 字重（`STSongti-SC-Light`）用于序言 / 后记
- 切换为 Noto Serif CJK SC（Google 开源版本，跨平台一致性更好）
- 添加西文衬线体（如 Crimson Text）用于英文/数字 caption

### PDF Size Optimization

CJK 字体文件体积巨大（SongtiSC-Regular.ttf ~20MB），但 react-pdf 底层 PDFKit 自动执行字体子集化（`font.createSubset()`）—— 仅嵌入 PDF 中实际使用的 glyph，而非整个字体文件。中文 caption 通常只需数十至数百个汉字，嵌入体积远小于完整字体。

**字体子集化验证**

PDFKit 字体嵌入流程：`font.createSubset()` → `subset.includeGlyph(glyph.id)` → `subset.encode()`。每个页面渲染时，仅已使用的 glyph 被收集并入子集。这是 PDF 引擎级别的自动行为，无需额外配置。

**真正的大文件来源：原始照片**

字体已自动子集化，PDF 体积的主要贡献者是图片。`resolveBookImages()` 原使用 `readFileSync` + 原始 base64 编码，将相机原始分辨率照片（可达 6000×4000px，5-15MB/张）直接嵌入 PDF。对于 420pt 页面尺寸的摄影书，这是过度分辨率。

**优化策略**

- 图片 resize：最长边限制 3000px（远超 420pt 页面所需）
- JPEG compress：quality 0.85（视觉无损，文件大幅缩小）
- 仅在需要时处理：原图 ≤ 3000px 则跳过 resize 步骤
- 实现：`lib/export/image.ts`（sharp 图像处理）

**未来优化方向**

- 按页面实际渲染尺寸动态计算 resize 上限（而非固定 3000px）
- 灰度照片自动剥离颜色通道
- WOFF2 subset 字体服务于 EPUB/Web 导出
- 字体 glyph 预分析：render 前精确计算所需字符集

### Export Image Pipeline

导出管线中的图片经过独立处理层，而非直接使用原始上传文件。

```
原始照片（6000×4000, ~8MB JPEG）
    ↓
optimizeExportImage()                         ← lib/export/image.ts
    ↓ sharp.resize(3000, 3000, fit: "inside")
    ↓ sharp.jpeg({ quality: 85 })
    ↓
导出图片（3000×2000, ~300KB JPEG）
    ↓
base64 data URL → BookDocument Page
    ↓
PDF embed
```

**为什么不在上传时就限制尺寸**

上传的照片用于全屏查看（PhotoModal），需要原始分辨率支持放大细节。导出尺寸是摄影书特定需求 —— 420pt 页面不需要 6000px 原图。分离上传尺寸和导出尺寸，各自服务于各自的使用场景。

**image.ts 定位**

`lib/export/image.ts` 是导出图片处理的标准入口。所有未来 renderer（PDF、IDML、EPUB）共用此模块，确保导出图片质量一致。

### Photography Export Philosophy

摄影书导出不是"把照片放进 PDF"，而是将数字档案转化为适合阅读的摄影出版物。

**阅读体验优先**

- 摄影书 PDF 是为屏幕阅读和打印设计的，不是为像素级检查设计的
- 420pt 页面（≈14.8cm）上的照片不需要 6000px 原图 —— 人眼在阅读距离无法分辨 3000px vs 6000px 的差异
- JPEG quality 0.85 在印刷/屏幕显示中视觉无损，但文件体积减少 60-80%

**从"能导出"到"适合阅读"**

- v1（当前）：原图 embed → PDF 体积巨大，下载慢，不适合分享
- 目标：优化后的导出 → PDF 体积合理，适合邮件发送、在线分享、归档
- 渐进优化：不追求极致压缩率，保留足够的视觉质量余量

**与现有系统的关系**

- 不修改原始照片文件
- 不修改上传流程
- 导出优化是纯读取转换层，原始数据不受影响
- 未来可按 renderer 需求调整优化参数（PDF 用 3000px / Web 用 2000px）

### PDF Page Layout Bug（两次迭代）

**Bug #1 — caption 跨页**

竖构图照片 caption 被推到下一页，横构图照片占比过满挤到页码下方。

- **根因**：`Image` 组件使用 `height: "100%"`，imageContainer 使用 `flex: 1` → 图片区域占满整个 Page 内容盒，caption 无布局空间
- **修复**：显式划分 `contentColumn` → `imageArea` (flex: 1) + `captionArea` (height: 48px)

**Bug #2 — width/height 100% 导致的图片拉伸 + 页码覆盖（修复 Bug #1 引入的缺陷）**

修复 Bug #1 后出现新问题：竖构图照片变横构图（test2 最后一张）、所有照片覆盖页码（test1）、部分 caption 仍在第二页。

- **根因**：`Image` 同时设置 `width: "100%"` 和 `height: "100%"`。在 react-pdf 中，显式设置两个维度会强制 Image 元素匹配父容器宽高比，`objectFit: "contain"` 无法正确介入 —— 图片被拉伸变形，竖构图变横构图。同时图片溢出 imageArea，覆盖了 `position: absolute` 的页码。
- **修复**：`photoImage` 不再使用 `width` / `height`，改为 `maxWidth: "100%" maxHeight: "100%" objectFit: "contain"`。Image 使用其固有尺寸（来自 sharp 优化后的像素尺寸），受 maxWidth/maxHeight 约束，`objectFit: "contain"` 在此约束盒内缩放内容。与浏览器不同，react-pdf 中 percentage maxHeight 在 flex 容器有解析高度时可以正确计算。

**Bug #3 — JPEG SOF 解析方向检测失败（同时引入、同时移除）**

`getImageOrientation()` 扫描 JPEG 字节流查找 SOF marker 以判断 portrait/landscape。

- **根因**：JPEG 文件可能包含嵌入的 EXIF 缩略图（同样有 SOF marker）。逐字节扫描首先命中的可能是缩略图（如 160×120），而非主图。缩略图的方向与主图无关，导致误判并应用错误的 padding。
- **修复**：直接移除 `getImageOrientation()` 和方向特定 padding。`objectFit: "contain"` 本身就能正确处理两种方向 —— portrait 照片自然会在宽容器中留出左右空白，landscape 照片自然会在高容器中留出上下空白。不需要手动调整 padding。

**最终稳定布局：**

```
Page
├── contentColumn (flex:1, column)
│   ├── imageArea (flex:1, overflow:hidden)
│   │   └── Image (maxWidth:100% maxHeight:100% objectFit:contain)
│   └── captionArea (height:48px)
└── pageNumber (position:absolute, bottom:18)
```

**关键教训：**

- react-pdf 的 `Image` 组件不要同时设置 `width` 和 `height` 为 100% —— 用 `maxWidth`/`maxHeight` 代替
- `objectFit` 在 max 约束下工作正确，在显式 width+height 下可能失效
- JPEG 字节扫描不可靠（缩略图干扰），不要在 renderer 中检测图片方向
- `objectFit: "contain"` 天然适配 portrait/landscape 混合排版，纯 CSS 方案优于手动方向判断
- react-pdf 中 `overflow: "hidden"` 的裁剪行为与浏览器不完全一致，不应作为主要约束手段

### Photography Layout Notes

摄影书 PDF 不是响应式网页。每个页面有固定尺寸（420pt 基准），布局必须在渲染前确定。

**页面布局原则**

- **显式空间分配**：先决定 image 和 caption 各占多少空间，再填充内容。用 flex + 固定高度，不让引擎"自动算"
- **caption 不可跨页**：照片和它的说明文字必须在同一页。固定 `captionArea` 高度（48px）确保分页系统始终为其预留空间
- **留白来自 objectFit**：`objectFit: "contain"` 自动为 portrait/landscape 照片创建不同的留白节奏 —— 不需要手动检测方向
- **页码不参与布局流**：`position: absolute` 固定在页面底部 18pt 处，不受 image/caption 内容影响

**与 Web 布局的差异**

| 概念 | Web (CSS) | PDF (react-pdf) |
|------|-----------|-----------------|
| 页面 | 无限滚动 | 固定尺寸 Page |
| 溢出 | scroll / hidden | 自动分页到下一页 |
| flex 高度解析 | 视口高度 | Page 固定高度 |
| 位置 | 相对视口 | 相对当前 Page |
| Image sizing | width/height 100% + objectFit 正常 | 应使用 maxWidth/maxHeight + objectFit |

**布局检查清单**（新增页面类型时）

- [ ] 所有内容在 Page 固定高度内吗？
- [ ] caption 和 photo 在同一页吗？
- [ ] Image 使用的是 `maxWidth`/`maxHeight` 而非 `width`/`height` 吗？
- [ ] 没有 JPEG 字节解析或图片方向检测逻辑吗？
- [ ] 固定高度元素（caption、页码）在 flex 容器外吗？

## Photo Sorting

瀑布流支持按拍摄时间排序。时间排序不是数据库功能，而是摄影叙事的一部分。

### 排序模式

| 模式 | 参数 | SQL | 含义 |
|------|------|------|------|
| 最新优先 | `?sort=newest`（默认） | `ORDER BY COALESCE(date_taken, created_at) DESC` | 最近拍摄在上 |
| 最早优先 | `?sort=oldest` | `ORDER BY COALESCE(date_taken, created_at) ASC` | 最早拍摄在上 |

### 时间数据来源

同 StatsPanel 的时间系统：`getPhotoDate()` — 优先 `date_taken`（EXIF），fallback `created_at`（上传时间）。使用 `COALESCE(date_taken, created_at)` 确保无 EXIF 照片也能参与排序。

### 排序在服务端完成

`getUnarchivedPhotos(sort)` 接受排序参数，SQL 层 `ORDER BY`，不在前端对大数组排序。

### UI

FilterBar 右侧 pill 按钮：[最新] [最早]，当前选中黑底白字。切换即时触发 `fetch(/api/photos?unarchived=1&sort=...)` 刷新瀑布流，无页面 reload。

## PhotoCard Visual Language

瀑布流 PhotoCard 遵循"照片优先"原则，操作和信息不抢占照片注意力。

### 照片展示

- **直角照片**：`rounded-none`，模拟相纸 / contact sheet / 摄影书页面感
- **容器微圆角**：卡片容器保留 `rounded-xl`，作为照片的展示框

### 信息层级

| 层级 | 元素 | 可见条件 |
|------|------|----------|
| 默认 | 照片本身 | 始终可见 |
| hover | metadata overlay（相机 · 焦段 · 光圈） | 鼠标悬停，底部渐变浮现 |
| hover | 操作图标（导入 + / 删除） | 鼠标悬停，右上角浮现 |
| 始终 | 编辑控件（排序 / 封面） | 仅摄影集编辑模式显示 |

### 操作按钮

- **默认隐藏**：导入（+）和删除（垃圾桶图标）仅在 hover 时显示
- **半透明背景**：`bg-black/40` 圆形图标按钮，不抢照片注意力
- **hover 增强**：`bg-black/60` 或 `bg-red-500`（删除）
- 导入展开后独立于 hover 显示（带边框分隔线）

### hover 动画

仅允许三种效果：`opacity`（overlay 淡入）、`shadow`（shadow-sm → shadow-lg）、`translateY`（-0.5 上浮）。不使用 scale、bounce、spring。

### 间距

PhotoGrid 列间距 `gap-8`，卡片底部间距 `mb-8`，照片之间呼吸感。

### 设计意图

目标气质：摄影 contact sheet / 艺术档案 / 摄影师工作台。不是：SaaS dashboard / 后台管理系统。

---

## Homepage Layout Philosophy

首页布局遵循"瀑布流是主角"原则。上传区、统计、筛选都是辅助工具，不应抢占视觉中心。

### 视觉节奏

三层垂直节奏，每层之间保持呼吸感（`gap-10`）：

| 层 | 内容 | 角色 |
|------|------|------|
| 第一层 | 上传工具栏（左）+ 摄影档案统计（右） | 工具区，左右分栏 |
| 第二层 | 筛选栏 | 辅助筛选 |
| 第三层 | 照片瀑布流 | **主视觉焦点** |

### 设计原则

- **上传区是工具，不是英雄**：紧凑的 `h-20` 拖拽区，单行文案"导入照片 — 拖拽到此处"，无大虚线框
- **统计是档案摘要，不是数据库面板**：侧栏布局，icon + 大数字 + 小标签。展示最常用相机/镜头/焦距/光圈/ISO，而非全量 Top 5 列表
- **瀑布流出现位置**：首屏可见，不被上传区和统计挤到页面下半部
- **模块间距**：`gap-10`（40px）以上，不紧贴

### 不应出现的设计

- ❌ 巨大 dashed upload box 占据视觉中心
- ❌ 全宽横向滚动统计卡片
- ❌ 大量文字字段堆叠
- ❌ 所有 section 紧贴无间距

---

## Modal Viewing Experience

PhotoModal 的目标是"摄影灯箱"，不是"App 卡片"。用户点击照片后应感到正在查看照片本身，而非一个 UI 弹窗。

### 沉浸感规则

| 规则 | 说明 |
|------|------|
| 照片直角 | `rounded-none`，无任何圆角裁切 |
| 无父容器裁切 | 不得有 `overflow-hidden` 在 img 的父级链上 |
| 暗色背景 | `bg-black/92`，照片浮在黑暗上 |
| 信息面板侧置 | 右侧 320px 白色面板，轻量边框，低存在感 |
| 动画克制 | 仅 opacity 淡入（0.2s ease-out），无 scale/bounce/spring |

### 与 PhotoCard 的视觉分离

- **PhotoCard**（瀑布流）：卡片容器 `rounded-xl`，照片直角，hover 时显示 metadata overlay
- **PhotoModal**（灯箱）：全屏暗色背景，无卡片容器包裹照片，照片直接浮在暗色背景上

### 设计意图

目标气质：摄影灯箱 / 桌面看片 / 摄影书预览。不是：UI 卡片弹窗 / 后台管理详情。

---

## StatsPanel Visual Philosophy

StatsPanel 是摄影档案可视化，不是后台数据分析仪表盘。

### 设计定位

| 是 | 不是 |
|------|------|
| 摄影档案摘要 | SaaS Analytics Dashboard |
| 一眼看懂拍摄习惯 | 数据表格阅读器 |
| 安静、克制、摄影感 | 彩色饼图 / 折线图 / 科技感图表 |

### 可视化元素

| 元素 | 形式 | 目的 |
|------|------|------|
| 每日活跃度 | 365 天热力图（GitHub contribution 风格） | 一眼看到创作节奏 |
| 相机占比 | 横向灰度占比条 + 百分比 | 了解主力设备 |
| 焦段分布 | 横向占比条（Top 5） | 摄影语言倾向 |
| 最近拍摄 | 最近一次日期 + 30 天计数 | 活跃状态感知 |

### 颜色系统

仅允许黑白灰 + 极少量 amber：

- 文字：`gray-800`（主）、`gray-400/500`（辅）
- 柱状图填充：`#9ca3af`（gray-400），空：`#e5e7eb`（gray-200）
- 占比条填充：`gray-400`，背景：`gray-100`
- 无蓝绿红紫等仪表盘色彩

### Icon 系统

极简细线 SVG（lucide 风格），`strokeWidth=1.5`，`text-gray-300`，`w-3.5 h-3.5`。用于：相机、镜头、焦段、ISO、日历。

### 信息层级

- 大数字（`text-2xl font-light`）：照片总数
- 热力图（365 个 `w-3 h-3` 格子）：每日活跃度，一眼看懂无需阅读
- 占比条 + 百分比：相机/焦段分布
- 小标签（`text-[10px]`）：区段标题

用户应一眼看懂，而非阅读数据库。

---

## Activity Heatmap System

拍摄活跃度以 GitHub contribution 风格热力图展示。每个格子代表一天，颜色深浅代表当天拍摄数量。

### 布局

- **横向**：53 周列（从周日开始对齐）
- **纵向**：7 行（Sun – Sat）
- **格子尺寸**：`w-3 h-3`，`gap-[2px]`，`rounded-sm`
- **月份标签**：顶部浮动显示 Jan/Feb/Mar…
- **星期标签**：左侧仅显示 Mon、Wed、Fri

### 颜色映射（全灰度）

| 拍摄数量 | 颜色 |
|------|------|
| 0 张 | `bg-gray-100` |
| 1–2 张 | `bg-gray-300` |
| 3–5 张 | `bg-gray-500` |
| 6+ 张 | `bg-gray-800` |

### Hover

hover 格子显示 tooltip：`2026-05-14 · 12 张`。深色底白字，`text-[10px]`，`fixed` 定位跟随鼠标。

### 目标气质

摄影创作日历。不是：dashboard chart / BI 图 / 彩色 analytics。

---

## Stats Data Source Notes

月度活跃度、最近拍摄日期等时间相关统计的数据来源和容错策略。

### 日期来源优先级

1. `photos.date_taken`（EXIF DateTimeOriginal）—— 真实的拍摄时间
2. `photos.created_at`（SQLite 自动生成的上传时间）—— fallback

### EXIF 日期格式

ExifReader 返回的 DateTimeOriginal 可能是：

- `"YYYY:MM:DD HH:mm:ss"`（EXIF 原始格式）
- exif.ts 内的 `getDateTaken()` 已做正则转换 → ISO 8601 `"YYYY-MM-DDTHH:mm:ss"`

### SQLite datetime 格式

`created_at` 使用 SQLite 默认格式：`"YYYY-MM-DD HH:mm:ss"`（空格分隔，非 ISO）。stats.ts 的 `parseDate()` 统一处理两种格式：检测是否含 `T`，不含则将空格替换为 `T` 再交给 `new Date()`。

### month key 统一规则

所有月度聚合使用 `YYYY-MM` 格式（如 `"2026-04"`），月份始终 2 位（`padStart(2, "0")`）。严禁出现 `"2026-4"` 这种非统一 key。

### 柱状图渲染

不使用 CSS 百分比高度（在 flex child 上下文中不可靠）。使用像素高度，`maxBarPx = 40`，按 `(count / max) * maxBarPx` 计算每个柱的 px 高度，最少 2px 保证零值月份也有微弱可见的柱。

### 已踩过的坑

- **柱状图全空**：CSS `height: 2%` 在 flex 容器中解析为 0px。根因：flex child 的百分比高度不继承父容器显式高度。修复：改用 JavaScript 计算 px 值。
- **month key 不匹配**：`getMonth()` 返回 0-11，需 +1 并 `padStart(2, "0")`。疏漏会导致 `"2026-4"` 不匹配 `"2026-04"` 而数据丢失。

---

## Heatmap Data Logic

热力图的数据聚合和渲染规则，与柱状图时期有本质区别。

### 数据结构

`dailyActivity: DailyCount[]` — 最近 365 天，每天一条记录：

```typescript
interface DailyCount {
  date: string; // "2026-05-26"（YYYY-MM-DD 格式）
  count: number;
}
```

### 日期来源

使用 `parseDate()` + `formatDayKey()`：
1. `photos.date_taken`（EXIF DateTimeOriginal）
2. fallback `photos.created_at`（SQLite 上传时间）
3. 生成 `YYYY-MM-DD` 格式 key

### Week/Grid 构建

- 365 天数组按时间顺序排列
- 补齐开头到 Sunday（用 `null` 填充），使第一列从周日开始
- 每 7 天一组切成 53 个 week
- 补齐后的 `null` 项渲染为 `bg-transparent`（不可见）

### 灰度映射规则

| count | CSS class |
|------|------|
| `null`（补齐空白） | `bg-transparent` |
| `0` | `bg-gray-100` |
| `1–2` | `bg-gray-300` |
| `3–5` | `bg-gray-500` |
| `6+` | `bg-gray-800` |

### 与旧柱状图的区别

| | 旧（monthlyCounts） | 新（dailyActivity） |
|------|------|------|
| 粒度 | 月 | 日 |
| 时间范围 | 12 个月 | 365 天 |
| 视觉 | 柱状高度 | 格子颜色深浅 |
| 渲染 | CSS 百分比高度（不可靠） | 纯颜色 class（可靠） |

### 已踩过的坑

- **monthlyCounts 反向依赖**：曾用 `monthlyCounts` 字段名，热力图需要 `dailyActivity`。修改 Stats 接口时需同步更新组件端的 `StatsData` 接口，否则类型不匹配。
- **补齐逻辑**：如果不补齐开头到 Sunday，网格的第一列可能从周三开始，破坏 GitHub contribution 风格的对齐。必须 `Array(startDay).fill(null)` 补齐。

---

## Hidden Metadata Strategy

首页 UI 只展示摄影语言相关的筛选维度（相机、镜头），但数据库和统计层完整保留所有 EXIF 字段。

### 当前 UI 展示

- **相机**（FilterBar + StatsPanel）
- **镜头**（FilterBar）
- **焦段**（StatsPanel 占比条）
- **月度活跃度**（StatsPanel 迷你图）

### UI 不展示但保留能力

| 字段 | 保留原因 |
|------|------|
| `iso` | 未来 AI 分析：高 ISO 夜拍趋势 |
| `aperture` | 未来 AI 分析：大光圈人像倾向 |
| `shutter_speed` | 未来 AI 分析：慢门 / 手持习惯 |

### 设计原则

- 首页筛选是"摄影语言"，不是"EXIF 数据库"
- 数据层不做减法：`Filters` 接口仍含 4 个字段，`getStats()` 仍返回 6 个维度
- UI 层做收敛：FilterBar 只暴露相机和镜头两个 `<select>`
- 未来打开新维度只需在 FilterBar 加回下拉，无需改数据库或统计逻辑

---

## Debug Lessons

以下是开发过程中的真实 bug 和诊断经验。

### 1. Draft scatter 算法"看起来没变化"

**现象**：反复调整 rotate / translate / top / left 参数，散落效果始终是规整堆叠。

**真实原因**：数据库中所有 Collection 都是 `ready` 或 `published`，没有 `draft` 状态。`CollectionCard` 的 draft 分支从未被执行。调整的是 draft 分支的参数，但浏览器渲染的一直是 ready 分支的规整堆叠。

**教训**：
- 调 UI 之前，先确认当前数据库状态是否触达目标 render 分支
- 用极端视觉标记（彩色边框 + DEBUG 标签）验证分支是否执行
- 不要假设"代码写了就一定会跑到"

### 2. Published toolbar 按钮被遮挡

**现象**：published 全屏阅读模式顶部只能看到返回链接和状态标签，看不到"重新编辑"和"取消发布"按钮。

**真实原因**：layout.tsx 导航栏 `z-50`，全屏容器 `z-40`。导航栏遮挡了 toolbar 右侧按钮。

**诊断过程**：最初花大量时间分析 flex / shrink / overflow 和 JSX 结构。用 TEST BUTTON（红色大按钮 `bg-red-500 text-4xl`）才确认按钮确实渲染了，只是被导航栏盖住。

**教训**：
- z-index 层级问题不要从 flex/overflow 开始排查
- 用极端视觉标记验证 DOM 渲染状态
- 全屏容器 z-index 必须 > 导航栏 z-index（当前规则：全屏 `z-[60]`）

### 3. 两张照片排序对调失败

**现象**：`movePhotoInCollection` 交换相邻照片的 sort_order，第二次调用后恢复到原顺序。

**真实原因**：normalization 循环只更新数据库，忘记更新内存中的 `sort_order` 值。第二次 move 读到的是旧内存值。

**教训**：排序操作涉及数据库 + 内存双状态时，必须同步两边。

### 4. UploadZone 上传目标选择器始终用初始值

**现象**：切换到"已有摄影集"后上传，照片仍然到了首页。

**真实原因**：`useCallback` 依赖数组为空 `[]`，闭包捕获了初始的 `targetType` / `newTitle` / `selectedCollectionId`。

**教训**：useCallback 依赖数组不能随意留空，尤其是依赖用户交互状态的函数。

---

## UI Debug Lessons

UI 视觉 bug 的排查经验。与非 UI bug 不同，视觉问题需要检查 CSS 层级链而非仅目标元素。

### PhotoCard 圆角裁切 bug

**问题**：虽然 `<img>` 已设置 `rounded-none`，但照片仍显示圆角。

**真实原因**：PhotoCard 父容器 `rounded-xl overflow-hidden`，`overflow-hidden` 裁切了 img 的锐利直角。

**教训**：UI 圆角不等于内容圆角。摄影作品应保持直角，panel/button/modal 可以圆角，但照片 img 不能被 `overflow-hidden` 裁切。

**规则**：
- 允许：panel rounded、button rounded、modal rounded
- 禁止：照片 img 被 `overflow-hidden` 裁切

**排查清单**：视觉问题不仅要检查目标元素，还要检查：
- 父容器
- `overflow` 属性
- `mask`
- wrapper 元素
- `z-index`
- `absolute` / `fixed` 层级

> 父容器样式会影响子元素视觉。不要只修改目标元素的 className。

### 图片 aspect-ratio 容器内百分比高度失效 bug

**问题**：published 摄影集浏览（BookViewer）和导出 PDF 中，竖构图照片显示异常——浏览时被放大裁切（宽度与横构图一致，上下溢出），PDF 中被压缩变形。

**真实原因**：照片容器使用 CSS `aspect-ratio` 确定高度，`img` / `Image` 使用 `max-height: 100%` 限制尺寸。但 CSS 规范中，`height: 100%` / `max-height: 100%` 需要父容器有**显式 height 值**才能解析百分比。`aspect-ratio` 不影响百分比高度解析——子元素的 `100%` 无法计算，img 保持其固有尺寸。竖构图照片固有高度大于容器 → 溢出/裁切。

**修复方案**：

- **BookViewer**：img 使用 `absolute inset-0 w-full h-full object-contain`。`absolute` 定位使 img 脱离 normal flow，然后 `inset-0 w-full h-full` 通过绝对定位几何而非百分比解析来确定尺寸，`object-contain` 可靠地缩放内容。
- **PDF (react-pdf)**：Image 使用 `width: "100%" height: "100%" objectFit: "contain"`。react-pdf 的 Image 组件需要显式 `width`/`height`（而非 `maxWidth`/`maxHeight`）来定义渲染盒，`objectFit` 在此之上生效。

**教训**：CSS `aspect-ratio` 创建的容器高度不满足子元素百分比高度解析条件。`max-height: 100%` + `object-fit: contain` 看起来合理但实际不可靠。

**规则**：
- `aspect-ratio` 容器内的图片统一使用 `absolute inset-0 w-full h-full` + `object-fit: contain`
- react-pdf Image 使用 `width`/`height`（不是 `maxWidth`/`maxHeight`）+ `objectFit`
- 不要依赖 `max-height: 100%` 在 aspect-ratio 容器中约束图片

**排查清单**：当图片在 aspect-ratio 容器中溢出/变形时：
- 检查子元素是否依赖百分比高度（`h-full`、`max-h-full`）
- 验证父容器是否有显式 `height`（`aspect-ratio` 不算）
- react-pdf：检查是否使用了 `maxWidth`/`maxHeight` 而非 `width`/`height`

---

## AI Collaboration Rules

以下规则供未来 AI Agent 在本项目中协作时参考。

### 改动策略

1. **最小增量优先**：优先单文件修改，避免跨层重构。只在确有必要时才新增文件
2. **复用现有模式**：新功能复制现有代码风格，不引入新范式
3. **不要重构**：除非 bug 根因是架构问题，否则不重新组织代码结构
4. **不要提前设计**：不为"未来可能需要"的需求预留抽象，需要时再加
5. **不新增依赖**：优先原生 `<select>`、`window.confirm`、CSS 动画，不引入第三方 UI 库

### 调试策略

1. **先验证运行路径**：确认目标代码分支是否真正被执行（数据驱动渲染时必须查数据库状态）
2. **极端视觉标记 + 浏览器验证**：怀疑布局问题时，用硬编码位置 + 彩色边框 + DEBUG 标签确认 DOM
3. **不要从 CSS 属性猜**：flex / overflow / z-index 问题不要用代码分析替代浏览器验证
4. **分层验证**：先确认数据（API 返回），再确认分支（render path），最后调样式

### UI 语言

1. **用户可见 UI**：统一中文
2. **技术标识符**：统一英文（函数名、变量名、字段名、API path）
3. **注释**：中文，简洁，不说废话
4. **风格**：Apple Photos 极简风格，Tailwind 优先，不写自定义 CSS

### 安全与正确性

1. **API 层 + UI 层双重校验**：重要约束不能只靠 UI 隐藏（如 published 锁定）
2. **乐观更新 + API 兜底**：UI 先更新，API 异步持久化，失败用 console.error 记录
3. **SQLite 同步 API**：`better-sqlite3` 是同步的，不需要 async/await 在 DB 层

### 不需要的操作

- 不要写多行 JSDoc 或注释块（一行足够）
- 不要创建 planning / decision / analysis 文档（工作从对话上下文来）
- 不要添加错误处理、fallback、validation 来处理"不可能发生"的场景
- 不要 feature flag、不要 backward-compatibility shim

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传照片（FormData，支持多文件；可选 `collectionId` 或 `newCollectionTitle`） |
| `GET` | `/api/photos` | 获取照片列表；`?unarchived=1` 只返回未归档照片；`?collectionId=X` 返回指定摄影集照片 |
| `GET` | `/api/photos/[id]/file` | 获取照片原始文件（图片二进制） |
| `PATCH` | `/api/photos/[id]/note` | 更新照片备注（Body: `{ "note": "备注内容" }`） |
| `PATCH` | `/api/photos/[id]/move` | 在摄影集内移动照片位置（Body: `{ "collectionId", "direction": "up"\|"down" }`） |
| `PATCH` | `/api/photos/[id]` | 更新照片字段（当前支持 `collection_id` 导入摄影集） |
| `DELETE` | `/api/photos/[id]` | 删除照片（copied 模式同时删除文件，自动清理封面 + 重整排序） |
| `GET` | `/api/stats` | 获取 EXIF 参数统计（6 维度分布数据） |
| `GET` | `/api/collections` | 获取所有摄影集列表（含前 3 张预览照片）；`?editable=1` 仅返回 draft + ready |
| `POST` | `/api/collections` | 创建新摄影集（Body: `{ "title": "..." }`） |
| `GET` | `/api/collections/[id]` | 获取单个摄影集详情（含照片列表） |
| `PATCH` | `/api/collections/[id]` | 更新摄影集（title/description/status/cover_photo_id） |
| `GET` | `/api/collections/[id]/export` | 导出摄影书 PDF（根据 book_ratio 生成相应尺寸） |

## 数据库表结构

### `photos` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER (PK) | 自增主键 |
| `filename` | TEXT | 存储在 uploads/ 下的文件名（UUID） |
| `original_name` | TEXT | 用户上传的原始文件名 |
| `camera_model` | TEXT | 相机型号，如 "SONY ILCE-7M4" |
| `lens_model` | TEXT | 镜头型号，如 "FE 24-70mm F2.8 GM II" |
| `focal_length` | TEXT | 焦距，如 "70mm" |
| `iso` | INTEGER | ISO 值，如 3200 |
| `aperture` | TEXT | 光圈，如 "f/2.8" |
| `shutter_speed` | TEXT | 快门速度，如 "1/250" |
| `note` | TEXT | 用户备注，默认空字符串 |
| `storage_mode` | TEXT | 存储模式：`copied`（Web 上传复制）或 `referenced`（原文件引用） |
| `collection_id` | INTEGER | 所属摄影集 ID，NULL 表示未归档 |
| `sort_order` | INTEGER | 在摄影集内的排序位置，NULL 表示未排序 |
| `date_taken` | TEXT | 拍摄时间（ISO 8601 格式） |
| `file_size` | INTEGER | 文件大小（字节） |
| `created_at` | TEXT | 记录创建时间，默认当前时间 |

### `collections` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER (PK) | 自增主键 |
| `title` | TEXT | 摄影集标题 |
| `description` | TEXT | 摄影集描述 |
| `status` | TEXT | 状态：`draft`（待整理）、`ready`（可发布）、`published`（已发布） |
| `cover_photo_id` | INTEGER | 封面照片 ID，可为空 |
| `sort_order` | TEXT | 照片排序 JSON 数组 `[photoId, ...]` |
| `version` | INTEGER | 发布版本号，默认 1，每次发布 +1 |
| `book_ratio` | TEXT | 摄影书比例，默认 `4:5`，可选 `1:1` `3:2` `2:3` |
| `created_at` | TEXT | 创建时间，默认当前时间 |

## 开始使用

需要 Node.js v20 或以上版本。

```bash
npm install
npm run dev
```

启动后打开 http://localhost:3000，拖入照片即可使用。访问 http://localhost:3000/collections 查看摄影集。

## 注意事项

- 无 EXIF 信息的照片（如截图、网图）上传后部分字段会显示为空或 "—"
- 语音输入依赖 Web Speech API，仅支持 Chrome/Edge 浏览器，且需要 HTTPS 或 localhost 环境下才能使用
- 仅支持 JPG/JPEG/PNG 格式的图片文件上传
