import type { AriaNode } from "../types";
import { parseHTML } from "../parsers/parser";
import { buildAriaTree } from "../nav/readableAria";
import { analyzePageStructure, type PageStructure, type AnalyzeOptions } from "./index";
import type { NavigationInfo } from "./navigation";
import { extractTextFromAriaNode } from "../aria/utils";

/**
 * ドキュメントサイトの構造情報
 */
export interface DocumentStructure extends PageStructure {
  /**
   * サイドバーナビゲーション（存在する場合）
   */
  sidebarNavigation?: NavigationInfo;

  /**
   * ページ内の章・セクション構造
   */
  sections?: SectionInfo[];

  /**
   * 前後のページへのリンク
   */
  pagination?: {
    prev?: { label: string; href: string };
    next?: { label: string; href: string };
  };
}

export interface SectionInfo {
  /**
   * セクションのID（アンカーリンク用）
   */
  id?: string;

  /**
   * セクションのタイトル
   */
  title: string;

  /**
   * セクションのレベル（h1=1, h2=2, ...）
   */
  level: number;

  /**
   * セクション内のコンテンツ（要約やプレビュー）
   */
  preview?: string;

  /**
   * 子セクション
   */
  children?: SectionInfo[];
}

/**
 * ドキュメントサイト用の構造解析
 */
export function analyzeDocumentStructure(
  html: string,
  options: AnalyzeOptions = {}
): DocumentStructure {
  // ドキュメントモードを有効にして基本構造を解析
  const baseStructure = analyzePageStructure(html, {
    ...options,
    documentMode: true,
  });

  // サイドバー内のナビゲーションを特定
  const sidebarNavigation = baseStructure.navigations.find((nav) => nav.location === "sidebar");

  // セクション構造を解析
  const sections = extractSections(html);

  // ページネーションを検出
  const pagination = extractPagination(baseStructure);

  return {
    ...baseStructure,
    sidebarNavigation,
    sections,
    pagination,
  };
}

/**
 * ページ内のセクション構造を抽出
 */
function extractSections(html: string): SectionInfo[] {
  const doc = parseHTML(html);
  const ariaTree = buildAriaTree(doc, { compress: false });

  const sections: SectionInfo[] = [];
  const stack: { section: SectionInfo; level: number }[] = [];

  function traverse(node: AriaNode) {
    const element = node.originalElement?.deref();
    if (element && /^h[1-6]$/.test(element.tagName)) {
      const level = parseInt(element.tagName.substring(1));
      const title = node.name || "";
      const id = element.id || element.attributes?.id;

      // 新しいセクションを作成
      const newSection: SectionInfo = {
        title,
        level,
        ...(id && { id }),
        children: [],
      };

      // スタックを適切なレベルまで巻き戻す
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // 親セクションがある場合は子として追加、なければルートに追加
      if (stack.length > 0) {
        const parent = stack[stack.length - 1].section;
        if (!parent.children) parent.children = [];
        parent.children.push(newSection);
      } else {
        sections.push(newSection);
      }

      // スタックに追加
      stack.push({ section: newSection, level });
    }

    // 子要素を再帰的に処理
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ariaTree.root);
  return sections;
}

/**
 * ページネーションリンクを抽出
 */
function extractPagination(structure: PageStructure): DocumentStructure["pagination"] {
  const paginationNav = structure.navigations.find((nav) => nav.type === "pagination");
  if (!paginationNav) return undefined;

  const pagination: DocumentStructure["pagination"] = {};

  // 前後のリンクを探す
  for (const item of paginationNav.items) {
    const label = item.label.toLowerCase();
    if (label.includes("prev") || label.includes("前") || label === "←") {
      pagination.prev = {
        label: item.label,
        href: item.href || "",
      };
    } else if (label.includes("next") || label.includes("次") || label === "→") {
      pagination.next = {
        label: item.label,
        href: item.href || "",
      };
    }
  }

  return Object.keys(pagination).length > 0 ? pagination : undefined;
}

/**
 * ドキュメントサイトのコンテンツとナビゲーションを統合して取得
 */
export interface DocumentContent {
  /**
   * メインコンテンツのテキスト
   */
  content: string;

  /**
   * サイドバーナビゲーションのマークダウン表現
   */
  sidebarNav?: string;

  /**
   * 目次（TOC）のマークダウン表現
   */
  toc?: string;

  /**
   * パンくずリストのテキスト表現
   */
  breadcrumb?: string;

  /**
   * セクション構造のマークダウン表現
   */
  outline?: string;
}

/**
 * ドキュメントサイトから構造化されたコンテンツを抽出
 */
export function extractDocumentContent(html: string): DocumentContent {
  const structure = analyzeDocumentStructure(html);
  const result: DocumentContent = {
    content: "",
  };

  // メインコンテンツを抽出
  if (structure.mainContent) {
    result.content = extractTextFromAriaNode(structure.mainContent, true);
  }

  // サイドバーナビゲーションを整形
  if (structure.sidebarNavigation) {
    result.sidebarNav = formatNavigationAsMarkdown(structure.sidebarNavigation);
  }

  // TOCを整形
  if (structure.toc) {
    result.toc = formatNavigationAsMarkdown(structure.toc);
  }

  // パンくずリストを整形
  if (structure.breadcrumb) {
    result.breadcrumb = structure.breadcrumb.items.map((item) => item.label).join(" > ");
  }

  // セクション構造をアウトラインとして整形
  if (structure.sections && structure.sections.length > 0) {
    result.outline = formatSectionsAsMarkdown(structure.sections);
  }

  return result;
}

/**
 * AriaNodeからテキストを抽出
 */
// extractTextFromAriaNode is now imported from aria/utils

/**
 * ナビゲーションをマークダウン形式に整形
 */
function formatNavigationAsMarkdown(nav: NavigationInfo, indent: number = 0): string {
  let markdown = "";

  for (const item of nav.items) {
    const prefix = "  ".repeat(indent) + "- ";
    markdown += prefix + item.label;
    if (item.href) {
      markdown += ` (${item.href})`;
    }
    if (item.isCurrent) {
      markdown += " **[Current]**";
    }
    markdown += "\n";

    if (item.children && item.children.length > 0) {
      markdown += formatNavigationItemsAsMarkdown(item.children, indent + 1);
    }
  }

  return markdown;
}

/**
 * ナビゲーションアイテムの配列をマークダウン形式に整形
 */
function formatNavigationItemsAsMarkdown(items: NavigationInfo["items"], indent: number): string {
  let markdown = "";

  for (const item of items) {
    const prefix = "  ".repeat(indent) + "- ";
    markdown += prefix + item.label;
    if (item.href) {
      markdown += ` (${item.href})`;
    }
    markdown += "\n";

    if (item.children && item.children.length > 0) {
      markdown += formatNavigationItemsAsMarkdown(item.children, indent + 1);
    }
  }

  return markdown;
}

/**
 * セクション構造をマークダウン形式に整形
 */
function formatSectionsAsMarkdown(sections: SectionInfo[], baseLevel: number = 0): string {
  let markdown = "";

  for (const section of sections) {
    const prefix = "#".repeat(section.level + baseLevel) + " ";
    markdown += prefix + section.title;
    if (section.id) {
      markdown += ` {#${section.id}}`;
    }
    markdown += "\n\n";

    if (section.preview) {
      markdown += section.preview + "\n\n";
    }

    if (section.children && section.children.length > 0) {
      markdown += formatSectionsAsMarkdown(section.children, baseLevel);
    }
  }

  return markdown;
}
