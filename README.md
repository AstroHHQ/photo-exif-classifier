# Photo Manager

摄影照片管理工具 MVP。上传照片自动读取 EXIF 信息，按镜头、焦距、相机分类浏览。

## 技术栈

- **前端**：Next.js + Tailwind CSS + TypeScript
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

## 项目结构

```
├── app/
│   ├── api/upload/route.ts    # 上传 API — 接收文件 → 读 EXIF → 写入 SQLite
│   ├── api/photos/route.ts    # 照片列表 API
│   ├── layout.tsx             # 根布局
│   ├── page.tsx               # 首页
│   └── globals.css            # 全局样式
├── components/
│   └── UploadZone.tsx          # 拖拽上传组件
├── lib/
│   ├── db.ts                   # 数据库初始化和操作
│   └── exif.ts                 # ExifReader 封装
├── uploads/                    # 照片存储目录
└── photos.db                   # SQLite 数据库文件（运行后生成）
```
