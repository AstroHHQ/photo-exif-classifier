# Photo Manager MVP

摄影照片管理工具，支持上传照片、自动读取 EXIF 信息、瀑布流展示、参数统计和备注。

## 技术栈
- Next.js + TypeScript
- Tailwind CSS
- SQLite (better-sqlite3)
- ExifReader
- Web Speech API（语音输入备注）

## 功能
- 拖拽上传照片（JPG/PNG）
- 自动读取 EXIF（相机、镜头、焦距、ISO、光圈、快门、拍摄时间）
- 照片瀑布流展示
- EXIF 参数统计面板
- 按相机 / 镜头 / 光圈 / ISO 筛选
- 点击照片查看大图及完整 EXIF 信息
- 照片备注（手动输入 + 语音输入）
- 键盘翻页浏览（← → Esc）

## 开始使用
```bash
npm install
npm run dev
```
