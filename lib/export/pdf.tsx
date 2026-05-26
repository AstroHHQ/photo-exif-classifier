/**
 * PDF Renderer —— 基于 @react-pdf/renderer。
 *
 * 将 BookDocument 渲染为摄影书 PDF。
 * 布局规则来自 layout.ts，不在此文件重复定义。
 */

import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { BookDocument } from "./types";
import { pageDimensions, pageMargins, TYPOGRAPHY, contentArea } from "./layout";

/** 注册中文字体 —— 思源宋体（Songti SC），支持中文 caption / 标题渲染 */
Font.register({
  family: "SongtiSC",
  src: path.join(process.cwd(), "public/fonts/SongtiSC-Regular.ttf"),
});

/** 构建 react-pdf stylesheet */
function buildStyles(ratio: string) {
  const [width, height] = pageDimensions(ratio);

  return StyleSheet.create({
    page: {
      width,
      height,
      backgroundColor: "#ffffff",
    },
    /* ---- 封面 ---- */
    coverContainer: {
      width,
      height,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fafafa",
    },
    coverImage: {
      width,
      height,
      objectFit: "cover",
    },
    coverTitle: {
      fontFamily: "SongtiSC",
      fontSize: TYPOGRAPHY.coverTitleSize,
      color: "#333333",
      letterSpacing: 1,
    },
    coverVersion: {
      fontFamily: "SongtiSC",
      fontSize: TYPOGRAPHY.versionSize,
      color: "#999999",
      marginTop: 8,
    },
    /* ---- 照片 + caption ---- */
    imageContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 36,
      paddingRight: 36,
      paddingBottom: 12,
      paddingLeft: 36,
    },
    photoImage: {
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
    },
    caption: {
      fontFamily: "SongtiSC",
      fontSize: TYPOGRAPHY.captionSize,
      color: TYPOGRAPHY.captionColor,
      textAlign: "center",
      paddingTop: 8,
      paddingRight: 36,
      paddingBottom: 36,
      paddingLeft: 36,
    },
    /* ---- 页码 ---- */
    pageNumber: {
      position: "absolute",
      bottom: 18,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: "SongtiSC",
      fontSize: TYPOGRAPHY.pageNumberSize,
      color: TYPOGRAPHY.pageNumberColor,
    },
  });
}

/* ---- 封面页 ---- */

function CoverPage({ page, ratio }: { page: import("./types").Page; ratio: string }) {
  const styles = buildStyles(ratio);

  return (
    <Page size={pageDimensions(ratio)} style={styles.page}>
      {page.imageFilename ? (
        <View style={styles.coverContainer}>
          <Image src={page.imageFilename} style={styles.coverImage} />
        </View>
      ) : (
        <View style={styles.coverContainer}>
          <Text style={styles.coverTitle}>{page.title || ""}</Text>
          {page.caption && <Text style={styles.coverVersion}>{page.caption}</Text>}
        </View>
      )}
    </Page>
  );
}

/* ---- 照片 + caption 页 ---- */

function ImageWithCaptionPage({ page, ratio }: { page: import("./types").Page; ratio: string }) {
  const styles = buildStyles(ratio);

  return (
    <Page size={pageDimensions(ratio)} style={styles.page}>
      <View style={styles.imageContainer}>
        {page.imageFilename && (
          <Image src={page.imageFilename} style={styles.photoImage} />
        )}
      </View>
      {page.caption && (
        <Text style={styles.caption}>{page.caption}</Text>
      )}
      {/* 页码（封面不显示，从第 2 页开始显示） */}
      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}

/* ---- Full-bleed 页（无 caption，照片铺满） ---- */

function FullBleedPage({ page, ratio }: { page: import("./types").Page; ratio: string }) {
  const styles = buildStyles(ratio);

  return (
    <Page size={pageDimensions(ratio)} style={styles.page}>
      {page.imageFilename && (
        <Image src={page.imageFilename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </Page>
  );
}

/* ---- 文档组件 ---- */

interface PhotoBookProps {
  document: BookDocument;
}

export function PhotoBook({ document: doc }: PhotoBookProps) {
  // react-pdf 要求 styles 在顶层调用，不能按页面动态创建
  // 用 ratio 统一设置
  const ratio = doc.ratio || "4:5";

  return (
    <Document title={doc.title} author="" creator="Photo Manager">
      {doc.pages.map((page, i) => {
        switch (page.type) {
          case "cover":
            return <CoverPage key={i} page={page} ratio={ratio} />;
          case "full-bleed":
            return <FullBleedPage key={i} page={page} ratio={ratio} />;
          case "image-with-caption":
          default:
            return <ImageWithCaptionPage key={i} page={page} ratio={ratio} />;
        }
      })}
    </Document>
  );
}
