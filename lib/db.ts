/**
 * 数据库模块 —— 初始化 SQLite，提供照片表的基本操作。
 *
 * 为什么用 better-sqlite3？
 * - 同步 API，代码直观，适合初学者
 * - 无需额外部署，一个文件就是数据库
 * - 读取极快，本地管理几十万张照片毫无压力
 */

import Database from "better-sqlite3";
import path from "path";

// 数据库文件存放在项目根目录
const DB_PATH = path.join(process.cwd(), "photos.db");

// 单例 —— 整个应用复用同一个数据库连接
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // 开启 WAL 模式，读写并发性能更好
    db.pragma("journal_mode = WAL");
    initTables(db);
  }
  return db;
}

/**
 * 创建 photos 表（如果不存在）。
 * 每张上传的照片对应一行记录。
 */
function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL,          -- 存储在 uploads/ 下的文件名 (UUID)
      original_name TEXT NOT NULL,          -- 用户上传时的原始文件名
      camera_model  TEXT,                   -- 相机型号，如 "SONY ILCE-7M4"
      lens_model    TEXT,                   -- 镜头型号，如 "FE 24-70mm F2.8 GM II"
      focal_length  TEXT,                   -- 焦距，如 "70mm"
      iso           INTEGER,                -- ISO 值，如 3200
      aperture      TEXT,                   -- 光圈，如 "f/2.8"
      shutter_speed TEXT,                   -- 快门速度，如 "1/250"
      note          TEXT DEFAULT '',        -- 用户备注
      storage_mode  TEXT NOT NULL DEFAULT 'copied',  -- copied | referenced
      date_taken    TEXT,                   -- 拍摄时间，ISO 8601 格式
      file_size     INTEGER NOT NULL,       -- 文件大小（字节）
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // 兼容旧数据库：如果 note 列不存在则添加
  try {
    db.exec(`ALTER TABLE photos ADD COLUMN note TEXT DEFAULT ''`);
  } catch { /* 列已存在，忽略 */ }
  // 兼容旧数据库：如果 collection_id 列不存在则添加
  try {
    db.exec(`ALTER TABLE photos ADD COLUMN collection_id INTEGER`);
  } catch { /* 列已存在，忽略 */ }
  // 兼容旧数据库：如果 sort_order 列不存在则添加
  try {
    db.exec(`ALTER TABLE photos ADD COLUMN sort_order INTEGER DEFAULT 0`);
  } catch { /* 列已存在，忽略 */ }
  // 迁移：将所有 sort_order=0 的照片改为 NULL（表示未排序）
  db.exec(`UPDATE photos SET sort_order = NULL WHERE sort_order = 0`);

  // 摄影集表
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL DEFAULT '',
      description     TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'draft',
      cover_photo_id  INTEGER,
      sort_order      TEXT DEFAULT '[]',
      version         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL
    );
  `);
  // 兼容旧数据库：如果 version 列不存在则添加
  try {
    db.exec(`ALTER TABLE collections ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  } catch { /* 列已存在，忽略 */ }
  // 兼容旧数据库：如果 storage_mode 列不存在则添加
  try {
    db.exec(`ALTER TABLE photos ADD COLUMN storage_mode TEXT NOT NULL DEFAULT 'copied'`);
  } catch { /* 列已存在，忽略 */ }
}

/** 照片记录的类型定义 */
export interface Photo {
  id: number;
  filename: string;
  original_name: string;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  iso: number | null;
  aperture: string | null;
  shutter_speed: string | null;
  note: string;
  storage_mode: "copied" | "referenced";
  collection_id: number | null;
  sort_order: number | null;
  date_taken: string | null;
  file_size: number;
  created_at: string;
}

/** 摄影集记录的类型定义 */
export interface Collection {
  id: number;
  title: string;
  description: string;
  status: "draft" | "ready" | "published";
  cover_photo_id: number | null;
  sort_order: string; // JSON 数组 [photoId, ...]
  version: number;
  created_at: string;
}

/**
 * 插入一条照片记录，返回自增 id。
 */
export function insertPhoto(photo: Omit<Photo, "id" | "created_at">): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO photos (filename, original_name, camera_model, lens_model,
      focal_length, iso, aperture, shutter_speed, note, storage_mode, collection_id, sort_order, date_taken, file_size)
    VALUES (@filename, @original_name, @camera_model, @lens_model,
      @focal_length, @iso, @aperture, @shutter_speed, @note, @storage_mode, @collection_id, @sort_order, @date_taken, @file_size)
  `);
  const result = stmt.run(photo);
  return Number(result.lastInsertRowid);
}

/**
 * 查询所有照片，按拍摄时间倒序。
 */
export function getAllPhotos(): Photo[] {
  const d = getDb();
  return d.prepare("SELECT * FROM photos ORDER BY date_taken DESC, id DESC").all() as Photo[];
}

/**
 * 按 id 查询单张照片。
 */
export function getPhotoById(id: number): Photo | undefined {
  const d = getDb();
  return d.prepare("SELECT * FROM photos WHERE id = ?").get(id) as Photo | undefined;
}

/**
 * 更新照片备注。
 */
export function updatePhotoNote(id: number, note: string): void {
  const d = getDb();
  d.prepare("UPDATE photos SET note = ? WHERE id = ?").run(note, id);
}

// ---- Collection（摄影集）操作 ----

/**
 * 创建摄影集。
 */
export function createCollection(data: {
  title: string;
  description?: string;
  status?: "draft" | "ready" | "published";
}): Collection {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO collections (title, description, status)
    VALUES (@title, @description, @status)
  `);
  const result = stmt.run({
    title: data.title,
    description: data.description || "",
    status: data.status || "draft",
  });
  return getCollectionById(Number(result.lastInsertRowid))!;
}

/**
 * 获取所有摄影集，按创建时间倒序。
 */
export function getAllCollections(): Collection[] {
  const d = getDb();
  return d.prepare(
    "SELECT * FROM collections ORDER BY created_at DESC"
  ).all() as Collection[];
}

/**
 * 按 id 获取单个摄影集。
 */
export function getCollectionById(id: number): Collection | undefined {
  const d = getDb();
  return d.prepare("SELECT * FROM collections WHERE id = ?").get(id) as
    | Collection
    | undefined;
}

/**
 * 获取摄影集下的照片列表。
 */
export function getCollectionPhotos(collectionId: number): Photo[] {
  const d = getDb();
  return d
    .prepare("SELECT * FROM photos WHERE collection_id = ? ORDER BY sort_order IS NULL ASC, sort_order ASC, id ASC")
    .all(collectionId) as Photo[];
}

/**
 * 更新摄影集信息。
 */
export function updateCollection(
  id: number,
  data: {
    title?: string;
    description?: string;
    status?: "draft" | "ready" | "published";
    cover_photo_id?: number | null;
    sort_order?: string;
    version?: number;
  }
): Collection | undefined {
  const d = getDb();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (data.title !== undefined) {
    fields.push("title = @title");
    values.title = data.title;
  }
  if (data.description !== undefined) {
    fields.push("description = @description");
    values.description = data.description;
  }
  if (data.status !== undefined) {
    fields.push("status = @status");
    values.status = data.status;
  }
  if (data.cover_photo_id !== undefined) {
    fields.push("cover_photo_id = @cover_photo_id");
    values.cover_photo_id = data.cover_photo_id;
  }
  if (data.sort_order !== undefined) {
    fields.push("sort_order = @sort_order");
    values.sort_order = data.sort_order;
  }
  if (data.version !== undefined) {
    fields.push("version = @version");
    values.version = data.version;
  }

  if (fields.length === 0) return getCollectionById(id);

  d.prepare(`UPDATE collections SET ${fields.join(", ")} WHERE id = @id`).run(
    values
  );
  return getCollectionById(id);
}

/**
 * 获取未归档照片（collection_id IS NULL）。
 */
export function getUnarchivedPhotos(): Photo[] {
  const d = getDb();
  return d
    .prepare(
      "SELECT * FROM photos WHERE collection_id IS NULL ORDER BY date_taken DESC, id DESC"
    )
    .all() as Photo[];
}

/**
 * 删除照片记录。
 * 同时清理封面引用 + 重新规范化 sort_order。
 * 返回被删除的照片信息（供调用方清理文件）。
 */
export function deletePhoto(id: number): Photo | undefined {
  const d = getDb();
  const photo = getPhotoById(id);
  if (!photo) return undefined;

  // 如果该照片是某摄影集的封面，清除引用
  d.prepare(
    "UPDATE collections SET cover_photo_id = NULL WHERE cover_photo_id = ?"
  ).run(id);

  // 记录 collection_id 用于 sort_order 整理
  const collectionId = photo.collection_id;

  // 删除记录
  d.prepare("DELETE FROM photos WHERE id = ?").run(id);

  // 重新规范化 sort_order（消除空位）
  if (collectionId != null) {
    const remaining = d
      .prepare(
        "SELECT id FROM photos WHERE collection_id = ? AND sort_order IS NOT NULL ORDER BY sort_order ASC"
      )
      .all(collectionId) as { id: number }[];
    remaining.forEach((p, i) => {
      d.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(i, p.id);
    });
  }

  return photo;
}

/**
 * 在摄影集内移动照片位置（上移/下移）。
 * 交换目标照片与相邻照片的 sort_order 值。
 */
export function movePhotoInCollection(
  photoId: number,
  collectionId: number,
  direction: "up" | "down"
): Photo[] {
  const d = getDb();
  const photos = getCollectionPhotos(collectionId);
  const idx = photos.findIndex((p) => p.id === photoId);
  if (idx === -1) return photos;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= photos.length) return photos;

  const a = photos[idx];
  const b = photos[targetIdx];

  // 若 sort_order 为 NULL（从未排序），先用当前位置赋值
  if (a.sort_order == null) {
    d.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(idx, a.id);
    a.sort_order = idx;
  }
  if (b.sort_order == null) {
    d.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(targetIdx, b.id);
    b.sort_order = targetIdx;
  }

  // 交换 sort_order
  d.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(
    b.sort_order,
    a.id
  );
  d.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(
    a.sort_order,
    b.id
  );

  return getCollectionPhotos(collectionId);
}

/**
 * 将照片导入摄影集。
 * - 设置 collection_id
 * - sort_order 自动追加到末尾
 * - 若摄影集无封面，自动设为封面
 */
export function updatePhotoCollectionId(
  photoId: number,
  collectionId: number
): Photo | undefined {
  const d = getDb();
  const photo = getPhotoById(photoId);
  if (!photo) return undefined;

  // 获取目标摄影集当前最大 sort_order
  const maxSort = d
    .prepare(
      "SELECT MAX(sort_order) as max_sort FROM photos WHERE collection_id = ?"
    )
    .get(collectionId) as { max_sort: number | null };

  const newSortOrder = (maxSort.max_sort ?? -1) + 1;

  d.prepare(
    "UPDATE photos SET collection_id = ?, sort_order = ? WHERE id = ?"
  ).run(collectionId, newSortOrder, photoId);

  // 自动封面：若摄影集还没有封面，用第一张导入照片
  const collection = getCollectionById(collectionId);
  if (collection && collection.cover_photo_id == null) {
    d.prepare("UPDATE collections SET cover_photo_id = ? WHERE id = ?").run(
      photoId,
      collectionId
    );
  }

  return getPhotoById(photoId);
}

/**
 * 获取摄影集编辑进度。
 * 进度 = (已备注数 + 已排序数) / (总照片数 × 2)
 * 已排序 = sort_order IS NOT NULL 的照片数量。
 */
export function getCollectionProgress(collectionId: number): {
  total: number;
  noted: number;
  sorted: number;
  progress: number;
} {
  const d = getDb();
  const row = d
    .prepare(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN note IS NOT NULL AND note != '' THEN 1 END) AS noted,
        COUNT(sort_order) AS sorted
      FROM photos
      WHERE collection_id = ?`
    )
    .get(collectionId) as { total: number; noted: number; sorted: number };

  const { total, noted, sorted } = row;
  const progress = total > 0 ? (noted + sorted) / (total * 2) : 0;

  return { total, noted, sorted, progress };
}
