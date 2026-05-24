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

  // 摄影集表
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL DEFAULT '',
      description     TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'draft',
      cover_photo_id  INTEGER,
      sort_order      TEXT DEFAULT '[]',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL
    );
  `);
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
  collection_id: number | null;
  date_taken: string | null;
  file_size: number;
  created_at: string;
}

/** 摄影集记录的类型定义 */
export interface Collection {
  id: number;
  title: string;
  description: string;
  status: "draft" | "curated";
  cover_photo_id: number | null;
  sort_order: string; // JSON 数组 [photoId, ...]
  created_at: string;
}

/**
 * 插入一条照片记录，返回自增 id。
 */
export function insertPhoto(photo: Omit<Photo, "id" | "created_at">): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO photos (filename, original_name, camera_model, lens_model,
      focal_length, iso, aperture, shutter_speed, note, collection_id, date_taken, file_size)
    VALUES (@filename, @original_name, @camera_model, @lens_model,
      @focal_length, @iso, @aperture, @shutter_speed, @note, @collection_id, @date_taken, @file_size)
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
  status?: "draft" | "curated";
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
    .prepare("SELECT * FROM photos WHERE collection_id = ? ORDER BY date_taken DESC, id DESC")
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
    status?: "draft" | "curated";
    cover_photo_id?: number | null;
    sort_order?: string;
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
