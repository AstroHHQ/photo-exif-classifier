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
│   ├── CollectionCard.tsx                # 摄影集卡片（draft 堆叠 / curated 封面）
│   ├── StatsPanel.tsx                    # EXIF 统计面板（6 维度横向滚动卡片，Top 5）
│   └── FilterBar.tsx                     # 筛选栏（相机 / 镜头 / 光圈 / ISO 下拉选择）
├── lib/                                  # 服务端工具库
│   ├── db.ts                             # SQLite 数据库（建表、增删改查、备注更新、摄影集操作）
│   ├── exif.ts                           # ExifReader 封装（提取 7 个拍摄参数）
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
- **摄影集管理**：支持创建摄影集，将照片归入摄影集。draft（待整理）和 curated（已整理）两种状态，不同视觉呈现
- **上传目标选择**：上传时可选择上传到首页（未归档）、新建摄影集或已有摄影集，灵活组织照片归属

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
  → getAllCollections() + getCollectionPhotos() 预览
  → CollectionCard 渲染（draft 堆叠 / curated 封面）

上传到摄影集 → POST /api/upload + collectionId/newCollectionTitle
  → 照片带上 collection_id，不出现在首页瀑布流
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传照片（FormData，支持多文件；可选 `collectionId` 或 `newCollectionTitle`） |
| `GET` | `/api/photos` | 获取照片列表；`?unarchived=1` 只返回未归档照片；`?collectionId=X` 返回指定摄影集照片 |
| `GET` | `/api/photos/[id]/file` | 获取照片原始文件（图片二进制） |
| `PATCH` | `/api/photos/[id]/note` | 更新照片备注（Body: `{ "note": "备注内容" }`） |
| `GET` | `/api/stats` | 获取 EXIF 参数统计（6 维度分布数据） |
| `GET` | `/api/collections` | 获取所有摄影集列表（含前 3 张预览照片） |
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
| `collection_id` | INTEGER | 所属摄影集 ID，NULL 表示未归档 |
| `date_taken` | TEXT | 拍摄时间（ISO 8601 格式） |
| `file_size` | INTEGER | 文件大小（字节） |
| `created_at` | TEXT | 记录创建时间，默认当前时间 |

### `collections` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER (PK) | 自增主键 |
| `title` | TEXT | 摄影集标题 |
| `description` | TEXT | 摄影集描述 |
| `status` | TEXT | 状态：`draft`（待整理）或 `curated`（已整理） |
| `cover_photo_id` | INTEGER | 封面照片 ID，可为空 |
| `sort_order` | TEXT | 照片排序 JSON 数组 `[photoId, ...]` |
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
