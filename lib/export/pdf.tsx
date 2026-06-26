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
    /* ---- 内容列（imageArea + captionArea）---- */
    contentColumn: {
      flex: 1,
      flexDirection: "column",
    },
    /* ---- 图片区域 ---- */
    imageArea: {
      flex: 1,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 24,
      paddingRight: 36,
      paddingBottom: 12,
      paddingLeft: 36,
    },
    photoImage: {
      objectFit: "contain",
      maxWidth: "100%",
      maxHeight: "100%",
    },
    /* ---- caption 区域（固定高度，不可跨页）---- */
    captionArea: {
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingRight: 36,
      paddingLeft: 36,
    },
    caption: {
      fontFamily: "SongtiSC",
      fontSize: TYPOGRAPHY.captionSize,
      color: TYPOGRAPHY.captionColor,
      textAlign: "center",
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
      <View style={styles.contentColumn}>
        {/* 图片区域：flex: 1 填充 caption 之外的所有空间，overflow hidden 防止溢出 */}
        <View style={styles.imageArea}>
          {page.imageFilename && (
            <Image src={page.imageFilename} style={styles.photoImage} />
          )}
        </View>
        {/* caption 区域：固定 48px，不会跨页 */}
        {page.caption && (
          <View style={styles.captionArea}>
            <Text style={styles.caption}>{page.caption}</Text>
          </View>
        )}
        {!page.caption && <View style={{ height: 8 }} />}
      </View>
      {/* 页码（不占用布局空间） */}
      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}

/* ---- 章节标题页 ---- */

function ChapterPage({ page, ratio }: { page: import("./types").Page; ratio: string }) {
  const styles = buildStyles(ratio);

  return (
    <Page size={pageDimensions(ratio)} style={styles.page}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={styles.coverTitle}>{page.title || ""}</Text>
      </View>
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
  const ratio = doc.ratio || "4:5";

  return (
    <Document title={doc.title} author="" creator="Photo Manager">
      {doc.pages.map((page, i) => {
        switch (page.type) {
          case "cover":
            return <CoverPage key={i} page={page} ratio={ratio} />;
          case "chapter":
            return <ChapterPage key={i} page={page} ratio={ratio} />;
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
