/**
 * 根布局 —— 所有页面的外层框架。
 * Apple Photos 风格：顶部导航栏 + 内容区。
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Manager",
  description: "摄影照片管理工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-gray-900">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Photo Manager</h1>
            <span className="text-xs text-gray-400">MVP</span>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="max-w-7xl mx-auto px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
