# Photo Manager MVP

本地摄影照片管理工具，支持上传照片、自动读取 EXIF 信息、瀑布流展示、参数统计、备注，以及摄影集管理。

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
│       └── collections/[id]/route.ts     # GET/PATCH — 摄影集详情 & 更新
├── collections/
│   └── page.tsx                          # 摄影集列表页面（/collections）
├── components/                           # React 组件
│   ├── UploadZone.tsx                    # 拖拽上传组件（拖拽 + 点击，支持多文件 + 上传目标选择）
│   ├── PhotoContainer.tsx                # 照片管理容器（状态管理、筛选、弹窗控制）
│   ├── PhotoGrid.tsx                     # 瀑布流布局（CSS columns 响应式）
│   ├── PhotoCard.tsx                     # 单张照片卡片（缩略图 + EXIF 摘要 + 备注预览）
│   ├── PhotoModal.tsx                    # 照片详情弹窗（大图 + EXIF + 备注编辑 + 语音输入）
│   ├── CollectionCard.tsx                # 摄影集卡片（draft 堆叠 / published 封面 + 进度条）
│   ├── BookViewer.tsx                    # 摄影集阅读模式（全屏单页翻页 + fade/slide 动画）
│   ├── StatsPanel.tsx                    # EXIF 统计面板（6 维度横向滚动卡片，Top 5）
│   └── FilterBar.tsx                     # 筛选栏（相机 / 镜头 / 光圈 / ISO 下拉选择）
├── lib/                                  # 服务端工具库
│   ├── db.ts                             # SQLite 数据库（建表、增删改查、备注更新、摄影集操作）
│   ├── exif.ts                           # ExifReader 封装（提取 7 个拍摄参数）
│   ├── file.ts                           # 文件访问抽象层（copied / referenced 模式）
│   └── stats.ts                          # 统计聚合（6 维度分组计数 + 筛选逻辑）
├── uploads/                              # 上传照片存储目录（UUID 命名）
├── photos.db                             # SQLite 数据库文件
├── package.json                          # 项目依赖
├── tsconfig.json                         # TypeScript 配置
├── next.config.ts                        # Next.js 配置
└── postcss.config.mjs                    # PostCSS 配置（Tailwind）
```

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
PhotoContainer → GET /api/photos
  → getAllPhotos() 从 SQLite 查询
  → PhotoGrid 渲染瀑布流
  → PhotoCard 通过 GET /api/photos/[id]/file 加载缩略图
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
  → CollectionCard 渲染（draft 堆叠 / published 封面 + 进度条）

/collections/[id] 详情页（draft / ready）→ GET /api/collections/[id]
  → PhotoGrid 瀑布流 + 排序 / 备注 / 设为封面
  → 状态流转：draft → ready → published

/collections/[id] 详情页（published）→ BookViewer 阅读模式
  → 全屏单页翻页，按 sort_order 顺序浏览
  → 键盘 ← → / 按钮翻页，Esc 返回列表
  → 淡入 + 微滑动入场动画

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

### 未锁定（本次未实现，后续扩展）

published 状态下尚未锁定的操作：
- 删除照片
- 修改排序
- 编辑备注

这些操作后续版本将逐步锁定，统一遵循"先回退再修改"的规则。

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
