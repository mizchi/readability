import type { AriaNode } from "../types";
import { parseHTML } from "../parsers/parser";
import { buildAriaTree } from "../nav/readableAria";
import { detectHeaders, type HeaderInfo } from "./header";
import { detectNavigations, type NavigationInfo } from "./navigation";

export interface PageStructure {
  headers: HeaderInfo[];
  navigations: NavigationInfo[];
  mainHeader?: HeaderInfo;
  mainNavigation?: NavigationInfo;
  breadcrumb?: NavigationInfo;
  toc?: NavigationInfo;
  mainContent?: AriaNode;
  sidebar?: AriaNode;
  footer?: AriaNode;
}

export interface AnalyzeOptions {
  /**
   * 本文も抽出するかどうか
   */
  extractContent?: boolean;

  /**
   * 最大ナビゲーション数（パフォーマンス対策）
   */
  maxNavigations?: number;

  /**
   * ヘッダー内のナビゲーションのみを対象とするか
   */
  headerNavigationOnly?: boolean;

  /**
   * ドキュメントサイトモード（サイドバーナビゲーションを優先）
   */
  documentMode?: boolean;
}

/**
 * ページ構造を総合的に解析する
 */
export function analyzePageStructure(html: string, options: AnalyzeOptions = {}): PageStructure {
  const { 
    extractContent = false, 
    maxNavigations = 10, 
    headerNavigationOnly = false,
    documentMode = false 
  } = options;

  // HTMLを直接パースしてARIAツリーを構築
  // ナビゲーション・ヘッダー検出のため、圧縮しないARIAツリーを使用
  const doc = parseHTML(html);
  const ariaTree = buildAriaTree(doc, { compress: false });

  // ヘッダーを検出
  const headers = detectHeaders(ariaTree.root);

  // ナビゲーションを検出
  let navigations = detectNavigations(ariaTree.root);

  // オプションに基づいてフィルタリング
  if (headerNavigationOnly) {
    navigations = navigations.filter((nav) => nav.location === "header");
  }

  // ドキュメントモードの場合、サイドバーナビゲーションを優先
  let effectiveMaxNavigations = maxNavigations;
  if (documentMode) {
    // サイドバー内のナビゲーションを検出
    const sidebar = findSidebar(ariaTree.root);
    if (sidebar) {
      const sidebarNavigations = detectNavigations(sidebar);
      // サイドバーナビゲーションを優先的に追加
      navigations = [...sidebarNavigations, ...navigations];
    }
    // ドキュメントモードではより多くのナビゲーションを保持
    effectiveMaxNavigations = maxNavigations * 2;
  }

  // 最大数で制限
  if (navigations.length > effectiveMaxNavigations) {
    navigations = prioritizeNavigations(navigations, documentMode).slice(0, effectiveMaxNavigations);
  }

  // 特定の要素を抽出
  const mainHeader = headers.find((h) => h.type === "main");
  const mainNavigation = navigations.find((n) => n.type === "global");
  const breadcrumb = navigations.find((n) => n.type === "breadcrumb");
  const toc = navigations.find((n) => n.type === "toc");

  // ページ構造要素を検出
  const mainContent = findMainContent(ariaTree.root);
  const sidebar = findSidebar(ariaTree.root);
  const footer = findFooter(ariaTree.root);

  return {
    headers,
    navigations,
    mainHeader,
    mainNavigation,
    breadcrumb,
    toc,
    mainContent,
    sidebar,
    footer,
  };
}

/**
 * ナビゲーションの優先順位付け
 */
function prioritizeNavigations(navigations: NavigationInfo[], documentMode: boolean = false): NavigationInfo[] {
  // 優先順位マップ
  const priorityMap = documentMode ? {
    // ドキュメントモードではTOCとローカルナビゲーションを優先
    toc: 10,
    local: 9,
    global: 8,
    breadcrumb: 7,
    utility: 6,
    pagination: 5,
    footer: 4,
    social: 3,
  } : {
    // 通常モード
    global: 10,
    breadcrumb: 9,
    toc: 8,
    local: 7,
    utility: 6,
    pagination: 5,
    footer: 4,
    social: 3,
  };

  return navigations.sort((a, b) => {
    const priorityA = priorityMap[a.type] || 0;
    const priorityB = priorityMap[b.type] || 0;

    // ドキュメントモードでは、サイドバー内のナビゲーションを優先
    if (documentMode) {
      const aInSidebar = a.location === "sidebar";
      const bInSidebar = b.location === "sidebar";
      if (aInSidebar && !bInSidebar) return -1;
      if (!aInSidebar && bInSidebar) return 1;
    }

    // 優先順位が同じ場合は、アイテム数で判定
    if (priorityA === priorityB) {
      return b.items.length - a.items.length;
    }

    return priorityB - priorityA;
  });
}

/**
 * メインコンテンツ要素を検出
 */
function findMainContent(root: AriaNode): AriaNode | undefined {
  // main要素を探す
  function findMain(node: AriaNode): AriaNode | null {
    const element = node.originalElement?.deref();
    if (element && (element.tagName === "main" || element.attributes?.role === "main")) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const main = findMain(child);
        if (main) return main;
      }
    }

    return null;
  }

  const main = findMain(root);
  if (main) return main;

  // article要素を探す（フォールバック）
  function findArticle(node: AriaNode): AriaNode | null {
    const element = node.originalElement?.deref();
    if (element && element.tagName === "article") {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const article = findArticle(child);
        if (article) return article;
      }
    }

    return null;
  }

  const article = findArticle(root);
  return article || undefined;
}

/**
 * サイドバー要素を検出
 */
function findSidebar(root: AriaNode): AriaNode | undefined {
  function find(node: AriaNode): AriaNode | null {
    const element = node.originalElement?.deref();
    if (
      element &&
      (element.tagName === "aside" ||
        element.attributes?.role === "complementary" ||
        /\b(sidebar|aside)\b/i.test(element.className || ""))
    ) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const sidebar = find(child);
        if (sidebar) return sidebar;
      }
    }

    return null;
  }

  const sidebar = find(root);
  return sidebar || undefined;
}

/**
 * フッター要素を検出
 */
function findFooter(root: AriaNode): AriaNode | undefined {
  function find(node: AriaNode, depth: number = 0): AriaNode | null {
    const element = node.originalElement?.deref();
    if (element && (element.tagName === "footer" || element.attributes?.role === "contentinfo")) {
      return node;
    }

    // トップレベルに近いfooterクラスも検出
    if (depth <= 2 && element && /\bfooter\b/i.test(element.className || "")) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const footer = find(child, depth + 1);
        if (footer) return footer;
      }
    }

    return null;
  }

  const footer = find(root);
  return footer || undefined;
}

// Re-export types
export type { HeaderInfo, LogoInfo, SiteTitleInfo } from "./header";
export type {
  NavigationInfo,
  NavigationItem,
  NavigationType,
  NavigationLocation,
  NavigationStructure,
} from "./navigation";
