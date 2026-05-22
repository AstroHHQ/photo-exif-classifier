# Photo Manager

摄影照片管理工具 MVP。上传照片自动读取 EXIF 信息，瀑布流浏览。

## 功能

- **拖拽上传** — 支持一次拖入多张 JPG/PNG 照片
- **自动提取 EXIF** — 相机型号、镜头型号、焦距、光圈、快门、ISO、拍摄时间
- **瀑布流展示** — CSS columns 响应式布局，移动端 1 列到桌面端 4 列
- **悬停卡片** — 显示相机型号和焦距·光圈，悬停时阴影加深

## 技术栈

- **前端**：Next.js 15 + Tailwind CSS 4 + TypeScript
- **后端**：Next.js API Routes
- **数据库**：SQLite（better-sqlite3）
- **EXIF 读取**：ExifReader

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000，拖拽照片到上传区域即可。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传照片，自动读 EXIF 写入数据库 |
| `/api/photos` | GET | 获取所有照片列表 |
| `/api/photos/[id]/file` | GET | 获取照片原文件 |

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── upload/route.ts           # 上传 API
│   │   └── photos/
│   │       ├── route.ts              # 照片列表 API
│   │       └── [id]/file/route.ts    # 照片文件 API
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # 首页
│   └── globals.css                   # 全局样式
├── components/
│   ├── UploadZone.tsx                 # 拖拽上传组件
│   ├── PhotoGrid.tsx                  # 瀑布流布局
│   └── PhotoCard.tsx                  # 照片卡片
├── lib/
│   ├── db.ts                          # 数据库初始化与操作
│   └── exif.ts                        # ExifReader 封装
├── uploads/                           # 照片存储目录
└── photos.db                          # SQLite 数据库（运行后生成）
```
