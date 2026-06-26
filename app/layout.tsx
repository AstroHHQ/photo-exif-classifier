/**
 * 根布局 —— 所有页面的外层框架。
 * Apple Photos 风格：顶部导航栏 + 内容区。
 */

import type { Metadata } from "next";
import Link from "next/link";
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
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                首页
              </Link>
              <Link href="/collections" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                摄影集
              </Link>
              <Link href="/analytics" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                统计分析
              </Link>
              <span className="text-xs text-gray-400">MVP</span>
            </nav>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="max-w-7xl mx-auto px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
