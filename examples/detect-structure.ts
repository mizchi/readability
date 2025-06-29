#!/usr/bin/env -S node --experimental-strip-types
/**
 * ページ構造検出の使用例
 */

import { readFileSync } from "fs";
import { analyzePageStructure } from "../dist/index.js";
import { ariaTreeToString } from "../dist/index.js";

// コマンドライン引数からURLまたはファイルパスを取得
const input = process.argv[2];
if (!input) {
  console.error("Usage: node detect-structure.ts <url or file>");
  process.exit(1);
}

async function main() {
  let html: string;

  // URLかファイルパスかを判定
  if (input.startsWith("http://") || input.startsWith("https://")) {
    console.log(`Fetching: ${input}`);
    const response = await fetch(input);
    html = await response.text();
  } else {
    console.log(`Reading file: ${input}`);
    html = readFileSync(input, "utf-8");
  }

  console.log("\n=== Analyzing Page Structure ===\n");

  // ページ構造を解析
  const structure = analyzePageStructure(html, {
    extractContent: true,
    maxNavigations: 10,
  });

  // ヘッダー情報を表示
  console.log("## Headers Found:", structure.headers.length);
  structure.headers.forEach((header, index) => {
    console.log(`\n### Header ${index + 1} (${header.type})`);
    console.log(`- Depth: ${header.depth}`);
    console.log(`- Sticky: ${header.isSticky ? "Yes" : "No"}`);

    if (header.contains.logo) {
      console.log("- Logo:", header.contains.logo.text || header.contains.logo.alt || "Image");
    }

    if (header.contains.siteTitle) {
      console.log(
        `- Site Title: "${header.contains.siteTitle.text}" (h${header.contains.siteTitle.level})`
      );
    }

    if (header.contains.navigation) {
      console.log(`- Contains ${header.contains.navigation.length} navigation(s)`);
    }

    if (header.contains.search) {
      console.log("- Has search form");
    }
  });

  // メインヘッダーの詳細
  if (structure.mainHeader) {
    console.log("\n## Main Header Details");
    console.log("- Found main header with site branding");
  }

  // ナビゲーション情報を表示
  console.log("\n## Navigations Found:", structure.navigations.length);
  structure.navigations.forEach((nav, index) => {
    console.log(`\n### Navigation ${index + 1}: ${nav.type}`);
    console.log(`- Location: ${nav.location}`);
    console.log(`- Structure: ${nav.structure}`);
    console.log(`- Items: ${nav.items.length}`);

    if (nav.label) {
      console.log(`- Label: "${nav.label}"`);
    }

    // 最初の5アイテムを表示
    console.log("- Sample items:");
    nav.items.slice(0, 5).forEach((item, i) => {
      const prefix = "  ".repeat(item.level) + "  • ";
      const current = item.isCurrent ? " [CURRENT]" : "";
      const children = item.children ? ` (+${item.children.length} sub-items)` : "";
      console.log(`${prefix}${item.label}${current}${children}`);
    });

    if (nav.items.length > 5) {
      console.log(`  ... and ${nav.items.length - 5} more items`);
    }
  });

  // 特定のナビゲーション要素
  if (structure.mainNavigation) {
    console.log("\n## Main Navigation");
    console.log(`- ${structure.mainNavigation.items.length} top-level items`);
    const hasDropdowns = structure.mainNavigation.items.some(
      (item) => item.children && item.children.length > 0
    );
    if (hasDropdowns) {
      console.log("- Has dropdown menus");
    }
  }

  if (structure.breadcrumb) {
    console.log("\n## Breadcrumb Navigation");
    const path = structure.breadcrumb.items.map((item) => item.label).join(" > ");
    console.log(`- Path: ${path}`);
  }

  if (structure.toc) {
    console.log("\n## Table of Contents");
    console.log(`- ${structure.toc.items.length} sections`);
  }

  // ページレイアウト構造
  console.log("\n## Page Layout");
  console.log(`- Main content: ${structure.mainContent ? "Found" : "Not found"}`);
  console.log(`- Sidebar: ${structure.sidebar ? "Found" : "Not found"}`);
  console.log(`- Footer: ${structure.footer ? "Found" : "Not found"}`);

  // デバッグ用：メインコンテンツのARIAツリーを表示
  if (structure.mainContent) {
    console.log("\n## Main Content Structure (first 20 lines)");
    const contentTree = ariaTreeToString({
      root: structure.mainContent,
      nodeCount: 0,
      linkCount: 0,
    });
    const lines = contentTree.split("\n").slice(0, 20);
    console.log(lines.join("\n"));
    if (contentTree.split("\n").length > 20) {
      console.log("... (truncated)");
    }
  }
}

// 実行
main().catch(console.error);
