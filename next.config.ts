import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许上传最大 50MB 的照片
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
