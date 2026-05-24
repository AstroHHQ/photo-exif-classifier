"use client";

/**
 * 摄影集列表页 —— /collections
 *
 * 展示所有摄影集，draft 显示堆叠效果，curated 显示封面。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CollectionCard from "@/components/CollectionCard";
import type { PhotoData } from "@/components/PhotoCard";

interface CollectionData {
  id: number;
  title: string;
  description: string;
  status: "draft" | "ready" | "published";
  cover_photo_id: number | null;
  previewPhotos: PhotoData[];
  photoCount: number;
  version: number;
  progress?: {
    total: number;
    noted: number;
    sorted: number;
    progress: number;
  };
}

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data: CollectionData[]) => setCollections(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">暂无摄影集</p>
        <p className="text-xs text-gray-300 mt-1">
          在首页上传时选择"新建摄影集"即可创建
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">摄影集</h2>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
        {collections.map((c) => (
          <CollectionCard
            key={c.id}
            id={c.id}
            title={c.title}
            status={c.status}
            coverPhotoId={c.cover_photo_id}
            previewPhotos={c.previewPhotos}
            photoCount={c.photoCount}
            progress={c.progress}
            version={c.version}
            onClick={() => router.push(`/collections/${c.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
