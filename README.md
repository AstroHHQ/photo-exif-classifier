# Photo Manager MVP

本地摄影照片管理工具 — 上传、EXIF 解析、瀑布流浏览、摄影集管理、摄影书 PDF 导出。

> 面向人类开发者的项目文档。AI Agent 开发规则请参阅 [CLAUDE.md](CLAUDE.md)。

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
├── analytics/
│   └── page.tsx                          # 统计分析页面（/analytics）- 完整 Dashboard
├── collections/
│   └── page.tsx                          # 摄影集列表页面（/collections）
├── components/                           # React 组件
│   ├── UploadZone.tsx                    # 拖拽上传组件（拖拽 + 点击，支持多文件 + 上传目标选择）
│   ├── HeroInsights.tsx                  # 首页摄影摘要（自然语言，无图表）
│   ├── DashboardOverview.tsx             # 首页 Dashboard 概览（精简版）
│   ├── PhotoContainer.tsx                # 照片管理容器（状态管理、筛选、弹窗控制）
│   ├── PhotoGrid.tsx                     # 瀑布流布局（CSS columns 响应式）
│   ├── PhotoCard.tsx                     # 单张照片卡片（缩略图 + EXIF 摘要 + 备注预览）
│   ├── PhotoModal.tsx                    # 照片详情弹窗（大图 + EXIF + 备注编辑 + 语音输入）
│   ├── CollectionCard.tsx                # 摄影集卡片（draft 散落 / ready 堆叠 / published 封面）
│   ├── BookViewer.tsx                    # 摄影集阅读模式（全屏单页翻页 + fade/slide 动画）
│   ├── StatsPanel.tsx                    # 完整统计面板（5 段 Dashboard，用于 /analytics）
│   ├── PhotographyInsights.tsx           # 摄影习惯分析卡片（规则引擎，用于 /analytics）
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

## Photography Insights

摄影习惯分析卡片，用规则引擎从 EXIF 统计数据中生成观察结果。位于首页 UploadZone 下方。

**定位**：数据驱动的事实观察，不是 AI 生成内容。每一条洞察都有具体数据和百分比支撑。

### 数据来源

复用现有 `/api/stats` 接口（`lib/stats.ts` → `getStats()`），不新增数据库查询。Stats 接口扩展了 `timeOfDay` 字段记录时段分布（上午/下午/傍晚/夜晚）。

### 规则引擎

5 条独立规则，每条规则根据阈值判断是否触发。当前最多展示 5 条洞察。

| 规则 | 触发条件 | 输出示例 |
|------|---------|---------|
| 主力焦段 | 最高频焦段占比 > 25% | "你最近更常使用 35mm 进行创作。" |
| 光圈习惯 | f/2.8 及更大光圈占比 > 60% | "你长期依赖大光圈营造氛围感。" |
| 拍摄时段 | 时段分布最高项 | "你最常在傍晚进行拍摄。" |
| 主力设备 | 最高频相机占比 > 40% | "X100VI 已成为你的主要创作设备。" |
| 拍摄节奏 | 最近 30 天有拍摄活动 | "最近 30 天你保持高频率拍摄，创作状态活跃。" |

### 实现

- **组件**：`components/PhotographyInsights.tsx`（Client Component，独立 fetch `/api/stats`）
- **规则引擎**：纯函数，输入 Stats → 输出 Insight[]，无副作用
- **展示风格**：border + bg-white + rounded-xl，与 StatsPanel 视觉一致

### 未来 AI 扩展方向

规则引擎预留了扩展点。每条规则是独立的 `(stats: Stats) => Insight | null` 函数，将来可替换为：

- **本地小模型**（如 ONNX）：在客户端运行摄影风格分类，无需联网
- **LLM API**（可选）：用户授权后，调用云服务生成更深度的创作分析
- **扩展维度**：色彩偏好、构图习惯、拍摄地点聚类

当前规则引擎不需要任何 AI 依赖，保持零成本、完全离线。

## Statistics Data Source

**核心设计决策：Statistics ≠ Current Waterfall**

| 范围 | 数据源 | SQL | 用途 |
|------|--------|-----|------|
| 瀑布流 | `getUnarchivedPhotos()` | `WHERE collection_id IS NULL` | 首页照片展示 |
| Statistics | `getAllPhotos()` | `SELECT * FROM photos` | StatsPanel、Photography Insights |
| 摄影集 | `getCollectionPhotos(id)` | `WHERE collection_id = ?` | 摄影集详情页 |

**影响组件：**
- `StatsPanel` → `/api/stats` → `getStats()` → `getAllPhotos()` → 全库统计
- `PhotographyInsights` → `/api/stats` → `getStats()` → `getAllPhotos()` → 全库分析
- `PhotoContainer` → `/api/photos?unarchived=1` → `getUnarchivedPhotos()` → 仅未归档照片

**设计意图：** 统计数据反映整个摄影库的真实面貌，不受照片归档操作影响。照片导入摄影集后，相机/镜头/焦段/光圈/时段等统计维度保持不变。瀑布流继续仅展示未归档照片，两者数据源独立。

## Equivalent Focal Length Policy

**核心问题：不同画幅系统拍摄的照片，原始焦段数据不可直接比较。**

一张 FUJIFILM X100V 用 23mm 拍摄的照片，和一张 Sony A7M4 用 24mm 拍摄的照片，虽然原始数字接近（23mm vs 24mm），但实际视角完全不同——前者是 APS-C 画幅的 35mm 等效，后者是全画幅的 24mm。

### 三级换算策略

| 优先级 | 方法 | 说明 |
|--------|------|------|
| Tier 1 | EXIF `FocalLengthIn35mmFilm` 标签 | 相机写入的 35mm 等效值，最准确 |
| Tier 2 | Crop Factor 检测 | 从相机型号识别画幅，按 crop factor 计算等效值 |
| Tier 3 | 退回原始值 | 无法识别时使用 raw focal_length |

### Crop Factor 检测

从相机型号字符串自动识别画幅：

| 品牌 | 识别模式 | Crop Factor |
|------|---------|-------------|
| Sony ILCE-7/9/1 系列 | 全画幅 | 1.0 |
| Sony ILCE-6xxx / NEX | APS-C | 1.5 |
| Canon EOS R5/R6/R3/R1 | 全画幅 | 1.0 |
| Canon EOS R7/R10/R50 | APS-C | 1.6 |
| Nikon Z5/6/7/8/9/Zf | 全画幅 | 1.0 |
| Nikon Z50/Z30/Zfc | APS-C | 1.5 |
| Fujifilm（非 GFX） | APS-C | 1.5 |
| Fujifilm GFX | 中画幅 | 0.79 |
| Leica M/Q/SL | 全画幅 | 1.0 |
| RICOH GR | APS-C | 1.5 |
| 未知 | 默认全画幅 | 1.0 |

**设计意图：** zoom 镜头拍摄的照片，原始焦段会产生大量碎片化数据（23mm 1 张、35mm 2 张、36mm 1 张、70mm 1 张）。转换为 35mm 等效后，这些碎片统一落入摄影语言范围，统计数据才有分析价值。

## Photography Language Distribution

**将 35mm 等效焦段映射到摄影师熟悉的"摄影语言"分类。**

### 六类焦段范围

| 摄影语言 | 等效焦段 | 视觉特征 |
|----------|---------|---------|
| 超广角 | ≤20mm | 强烈透视、空间张力、前景主导 |
| 广角 | 21-35mm | 环境叙事、空间关系、街拍常用 |
| 标准焦段 | 36-70mm | 人眼视角、构图优先、无镜头感 |
| 中长焦 | 71-105mm | 空间压缩、主体突出、人像常用 |
| 长焦 | 106-200mm | 远距离捕捉、极致压缩、细节隔离 |
| 超长焦 | 200mm+ | 野生/体育、极致拉近 |

### 统计表现

- **StatsPanel**：焦段区域为六段垂直柱状图（纯 CSS），每柱顶部显示百分比，灰度色阶从浅（超广角）到深（超长焦）
- **PhotographyInsights**：自动识别最高占比范围，生成摄影语言倾向描述
- **Photography Evolution**：12 个月堆叠柱状图时间轴，追踪摄影语言变化趋势

**设计意图：** 原始焦段统计对摄影师没有实际意义——"35mm 拍了 50 张"远不如"标准焦段占 42%，你习惯用接近人眼的视角拍摄"有洞察价值。

## Photography Dashboard

StatsPanel 已升级为完整的摄影档案 Dashboard，五个部分（详见 `/analytics` 页面）：

| 部分 | 内容 | 说明 |
|------|------|------|
| Photography Activity | 计数卡片（30天/90天/本年/总计）+ GitHub 热力图 | 拍摄活跃度概览 |
| Camera Usage | Top 3 相机 + 占比条 | 主力设备一目了然 |
| Lens Usage | Top 5 镜头 + 占比条 | 镜头使用偏好 |
| Photography Language Distribution | 六段垂直柱状图 | 35mm 等效焦段分类 |
| Photography Evolution | 12 个月堆叠柱状图时间轴 | 摄影语言变化趋势 |

首页只显示精简版 `DashboardOverview`（总数 + 近 30 天 + 热力图），完整 Dashboard 在 `/analytics`。

## Photography Evolution

**统计过去 12 个月每月的摄影语言分布，用于分析拍摄风格是否发生变化。**

### 数据来源

- `monthlyFocalDistribution` — `getStats()` 中按月分组，对每个月内的所有照片计算等效焦段分布
- 数据源：`getAllPhotos()`（全库），包含瀑布流 + 摄影集 + 已发布摄影书的所有照片

### UI 表现

- **EvolutionTimeline**：横向滚动 12 列堆叠柱状图，每列代表一个月份
- 柱体高度 = 该月该摄影语言的占比（百分比堆叠）
- 六段灰度色阶（浅→深：超广角→超长焦）
- 底部图例标注六个摄影语言范围
- 空月份（无照片）柱体为空

### PhotographyInsights 联动

- `ruleFocalEvolution`：比较最近 3 个月 vs 整体分布，检测摄影语言偏移
- 当某范围占比变化 ≥10pp 时生成洞察
- 示例："你的摄影语言正从广角叙事逐渐转向纪实观察。"

**设计意图：** 摄影师的风格演变是缓慢的——单次拍摄看不出变化，但 3-6 个月的趋势有意义。月度分布 + 整体对比让演变可视化。

## Homepage Information Architecture V2

**核心设计决策：首页以照片为中心，统计模块迁移到独立页面。**

### 视觉层级

```
导航栏
  ↓
Hero 区域（双栏）
  ├── 左侧 35%：UploadZone + HeroInsights
  └── 右侧 65%：DashboardOverview
  ↓
FilterBar
  ↓
PhotoGrid（瀑布流 — 主视觉焦点）
```

### 设计原则：照片 > 洞察 > 数据

| 层级 | 内容 | 占比 |
|------|------|------|
| 照片（主视觉） | 瀑布流 PhotoGrid | 页面主体，占据最大面积 |
| 洞察（摘要） | HeroInsights 自然语言 | 左侧 35%，紧凑文字 |
| 数据（概览） | DashboardOverview | 右侧 65%，核心数字 + 热力图 |

### 与 V1 的差异

| 维度 | V1（旧） | V2（新） |
|------|----------|----------|
| 统计面板 | StatsPanel 在首页占据右栏全宽 | 移至 `/analytics` 独立页面 |
| 摄影洞察 | PhotographyInsights 带图表百分比 | HeroInsights 纯自然语言摘要 |
| 上传区 | 功能模块占满左栏 | 工具入口，紧凑 160-220px |
| 首页主题 | 数据分析后台 | 摄影档案馆 |
| 首次视觉焦点 | 统计面板 | 照片瀑布流 |

### 组件迁移

| 组件 | V1 位置 | V2 位置 |
|------|---------|---------|
| StatsPanel (完整) | 首页 | `/analytics` |
| PhotographyInsights (完整) | 首页 | `/analytics` |
| DashboardOverview (精简) | — | 首页（新） |
| HeroInsights (自然语言) | — | 首页（新） |
| UploadZone | 首页左栏 | 首页左栏（紧凑） |
| PhotoContainer | 首页 | 首页 |

## Analytics Page

**`/analytics` — 完整的摄影档案 Dashboard，所有复杂统计集中于此。**

### 页面结构

```
← 返回首页
统计分析
全库摄影档案 · 数据来源：所有照片（含摄影集）

StatsPanel（完整五段 Dashboard）
├── Photography Activity — 计数卡片 + GitHub 热力图
├── Camera Usage — Top 3 相机 + 占比条
├── Lens Usage — Top 5 镜头 + 占比条
├── Photography Language Distribution — 垂直柱状图
└── Photography Evolution — 12 个月演变时间轴

PhotographyInsights（完整规则引擎）
├── 摄影语言倾向
├── 光圈习惯
├── 拍摄时段
├── 主力设备
├── 拍摄节奏
└── 摄影语言演变
```

### 导航

- 导航栏新增「统计分析」链接
- 首页 → 统计分析：查看完整数据
- 统计分析 → 首页：返回照片浏览

## Dashboard Philosophy

**为什么统计模块迁移到独立页面？**

摄影工具的核心体验是照片浏览，不是数据监控。

| 问题 | 解决方案 |
|------|----------|
| 统计面板占据首页视觉重心 | 迁移到 `/analytics` |
| 照片变成配角 | 瀑布流回到页面焦点位置 |
| 首页信息过载 | Hero 双栏：工具 + 摘要 + 概览 |
| 首次打开感觉像后台 | 打开首页第一眼是照片 |

**目标感受：** 打开首页像进入摄影档案馆，不是进入数据分析后台。

**参考设计：** Apple Photos（照片优先）、Lightroom Library（网格主体）、Capture One Catalog（目录感）、Notion Dashboard（信息密度控制）

## Photo Library Filtering Philosophy

**三个页面，三种职责：**

| 页面 | 职责 | 筛选维度 |
|------|------|----------|
| 首页 | 找照片 | 相机 · 镜头 · 时间 · 焦段 · 备注 · 关键词 |
| 摄影集 | 组织照片 | 集合内排序 · 封面 · 移出 |
| 统计分析 | 理解照片 | 全库 EXIF 分布 · 使用习惯 · 趋势 |

**首页不分析，Analytics 不找照片，摄影集不统计。**

### 筛选架构

所有筛选在客户端完成（`filteredPhotos` useMemo）。排序变化时重新从 API 获取（服务端 SQL ORDER BY），筛选在内存中过滤。

```
API（排序）→ allPhotos → filteredPhotos（筛选）→ PhotoGrid
```

### 筛选维度

| 维度 | 控件 | 说明 |
|------|------|------|
| 相机 | 下拉 | 从现有照片中提取去重列表 |
| 镜头 | 下拉 | 从现有照片中提取去重列表 |
| 时间 | 快捷 Pills | 全部 / 今天 / 7天 / 30天 / 90天 / 本年 / 年份 / 自定义 |
| 焦段 | 下拉 | 6 类摄影语言（35mm 等效），复用 `lib/focalRanges.ts` |
| 备注 | Pills | 全部备注 / 有备注 / 无备注 |
| 搜索 | 输入框 | 模糊匹配文件名 + 备注 |

### 排序维度

| 排序 | 字段 | 说明 |
|------|------|------|
| 拍摄时间 新→旧 | `COALESCE(date_taken, created_at) DESC` | 默认 |
| 拍摄时间 旧→新 | `COALESCE(date_taken, created_at) ASC` | |
| 导入时间 新→旧 | `created_at DESC` | 最近导入的照片 |
| 导入时间 旧→新 | `created_at ASC` | 最早导入的照片 |

### 不包含的维度

以下维度属于 Analytics 分析范畴，不在首页筛选中出现：
- ISO、光圈、快门速度
- 时段分布（上午/下午/傍晚/夜晚）
- 摄影语言演变趋势
- 拍摄活跃度统计

**设计意图：** 筛选帮助用户找到某张具体照片。统计分析帮助用户理解整体拍摄习惯。两者不混淆。

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

## Storage Architecture V2

两种存储模式控制文件的物理存储和删除行为。默认为 `referenced`（引用模式）。

### `referenced` 模式（默认）

照片文件保存到 `uploads/`，但数据库标记为引用模式。应用将照片视为外部引用资源。

- **上传**：文件保存到 uploads/（Web MVP 限制，Electron 后将零复制）
- **删除**：仅删除数据库记录，文件保留在 uploads/
- **字段**：`storage_mode = "referenced"`，`original_path` 存储上传后文件路径

### `copied` 模式（兼容历史数据）

照片文件复制到 `uploads/`，数据库标记为复制模式。应用拥有文件所有权。

- **上传**：文件复制到 uploads/，UUID 重命名
- **删除**：删除数据库记录 + 删除 uploads/ 文件
- **字段**：`storage_mode = "copied"`，`original_path = NULL`

### 上传模式选择

UploadZone 提供模式切换器（"引用" / "复制"），默认"引用"。引用模式下显示提示"不占用额外磁盘空间"。

### 文件访问抽象层 `lib/file.ts`

所有 UI 组件通过 `getPhotoUrl(photo)` 获取照片 URL，不直接拼接路径。未来 Electron 迁移后 `referenced` 模式将通过 `file://` 协议直接访问原始文件。

### 数据库字段

| 字段 | 说明 |
|------|------|
| `photos.filename` | uploads/ 下的 UUID 文件名 |
| `photos.storage_mode` | `"referenced"`（默认）或 `"copied"`（历史） |
| `photos.original_path` | referenced 模式存储上传后路径，copied 为 NULL |

## Photo Deletion

### 首页瀑布流删除

| 存储模式 | 数据库 | 文件系统 |
|----------|--------|----------|
| `referenced`（默认） | 删除 `photos` 记录 | 不删除文件 |
| `copied`（历史） | 删除 `photos` 记录 | 删除 `uploads/` 文件 |

确认对话框根据模式显示不同文案：
- referenced："移除此照片记录？（引用模式，原始文件不受影响）"
- copied："确认删除这张照片？（复制模式，文件将被永久删除）"

### 摄影集内删除（移出集合）

摄影集内点击删除按钮执行 **移出集合**，不删除照片本身。

```
摄影集 PhotoCard "删除" 按钮
  → 确认："将此照片移出摄影集？照片会重新出现在首页瀑布流中。"
  → PATCH /api/photos/[id] { collection_id: null }
  → photos.collection_id 置 NULL，照片回到首页瀑布流
```

**设计意图**：摄影集只保存引用关系，永远不复制、不删除原始照片。摄影集中的"删除"语义是"不再属于本摄影集"。

### 关联数据处理

- **封面清理**：被删除/移出照片若是某摄影集封面，自动置 NULL
- **排序重排**：被删除照片如有 sort_order，自动重整剩余照片排序

## Photo Archive

首页未归档照片可导入已有摄影集。不是复制照片，只更新 `photos.collection_id`。

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

### PDF 字体

使用 Songti SC（宋体-简）Regular，从 macOS 系统字体提取存放于 `public/fonts/`。react-pdf 底层 PDFKit 自动子集化，仅嵌入实际使用的 glyph。

### 图片优化

导出前通过 `lib/export/image.ts` 对照片进行 sharp resize（最长边 3000px）+ JPEG compress（quality 0.85），显著减小 PDF 体积。原始照片不受影响。

### PDF 布局要点

- Image 组件使用 `maxWidth`/`maxHeight`，不要同时设 `width` 和 `height` 为 100%
- `contentColumn → imageArea(flex:1) + captionArea(48px)` 确保 caption 不跨页
- `objectFit: contain` 自动适配 portrait/landscape，无需手动检测方向

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

---

## Batch Upload & Folder Import

支持单张、多选、文件夹三种上传方式。超过 50 张照片自动分批上传。

### 上传入口

- **拖拽**：拖拽文件到上传区域
- **选择文件**：点击"选择文件"按钮，多选照片
- **选择文件夹**：点击"选择文件夹"按钮，递归导入整个文件夹（依赖浏览器 `webkitdirectory` API）

### 分批策略

- 每批 50 张照片（`BATCH_SIZE = 50`）
- 批次之间串行执行，完成一批再进行下一批
- 同一批次内的所有照片共享一个 FormData → POST `/api/upload`
- storage_mode、上传目标（首页/新建摄影集/已有摄影集）在整个上传会话中保持一致

### 进度显示

上传过程中显示：
- 当前批次 / 总批次（如 "第 3/10 批"）
- 进度条（灰度，`bg-gray-600`）
- 已上传数量 / 总数量

### 实现文件

- `components/UploadZone.tsx` — 三种入口 + 分批上传逻辑 + 进度条
- `app/api/upload/route.ts` — 单批处理（支持多文件，不感知分批）

---

## Batch Delete Photos

支持多选照片并批量删除（首页瀑布流）或批量移出（摄影集）。

### 入口

- 首页 FilterBar 点击"选择"按钮进入多选模式
- 摄影集详情页点击"选择照片"按钮进入多选模式
- 每张照片左上角出现 checkbox
- 选中后工具栏显示：已选 N 张 · 全选/取消全选 · 删除选中照片 · 取消选择

### 删除行为

| 上下文 | 操作 | referenced 模式 | copied 模式 |
|--------|------|----------------|-------------|
| 首页瀑布流 | 批量删除 | 仅删数据库记录 | 删文件 + 数据库记录 |
| 摄影集内 | 批量移出 | `collection_id → NULL` | `collection_id → NULL` |

确认对话框根据选中照片的 storage_mode 动态生成提示文案。

### API

`DELETE /api/photos/batch` — Body: `{ photo_ids: number[], context: "library" | "collection" }`

| context | 行为 |
|---------|------|
| `"library"` | 批量删除 → 根据 storage_mode 决定是否删文件 |
| `"collection"` | 批量移出集合 → `collection_id = NULL` |

### 实现文件

- `components/PhotoCard.tsx` — checkbox UI
- `components/PhotoGrid.tsx` — 多选管理 + 批量操作工具栏
- `components/FilterBar.tsx` — "选择" / "完成"切换按钮
- `app/api/photos/batch/route.ts` — 批量删除 API
- `lib/db.ts` — `batchDeletePhotos()`, `batchRemoveFromCollection()`

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
| `DELETE` | `/api/photos/[id]` | 删除单张照片（copied 模式同时删除文件） |
| `DELETE` | `/api/photos/batch` | 批量删除/移出照片（`context: "library"` 删文件+记录；`context: "collection"` 仅移出集合） |
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
| `focal_length_35mm` | INTEGER | 35mm 等效焦距，来自 EXIF FocalLengthIn35mmFilm，可为 NULL |
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
