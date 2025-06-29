import type { AriaNode } from "../types";
import { getAccessibleName } from "../nav/aria";

export interface HeaderInfo {
  element: AriaNode;
  type: "main" | "article" | "section";
  contains: {
    logo?: LogoInfo;
    siteTitle?: SiteTitleInfo;
    navigation?: AriaNode[];
    search?: AriaNode;
  };
  isSticky: boolean;
  depth: number;
}

export interface LogoInfo {
  element: AriaNode;
  src?: string;
  alt?: string;
  text?: string;
}

export interface SiteTitleInfo {
  element: AriaNode;
  text: string;
  level: number; // h1=1, h2=2, etc.
}

/**
 * ヘッダー要素を検出する
 */
export function detectHeaders(root: AriaNode): HeaderInfo[] {
  const headers: HeaderInfo[] = [];

  // 再帰的にヘッダー要素を探索
  function traverse(node: AriaNode, depth: number = 0) {
    // header要素またはbanner roleを持つ要素を検出
    if (isHeaderElement(node)) {
      const headerInfo = analyzeHeader(node, depth);
      headers.push(headerInfo);
    }

    // 子要素を探索
    if (node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(root);

  // メインヘッダーを優先的にソート（深さが浅い = ページ上部に近い）
  headers.sort((a, b) => a.depth - b.depth);

  return headers;
}

/**
 * ヘッダー要素かどうかを判定
 */
function isHeaderElement(node: AriaNode): boolean {
  const element = node.originalElement?.deref();
  if (!element) {
    return false;
  }

  // header要素 (ARIAノードのroleもチェック)
  if (element.tagName === "header" || node.role === "banner") {
    return true;
  }

  // 明示的なbanner roleを持つ要素
  if (element.attributes?.role === "banner") {
    return true;
  }

  // ヒューリスティックな判定：よくあるヘッダークラス名
  const className = element.className || "";
  const headerPatterns = [
    /\bheader\b/i,
    /\bmasthead\b/i,
    /\bpage-header\b/i,
    /\bsite-header\b/i,
    /\btop-bar\b/i,
  ];

  return headerPatterns.some((pattern) => pattern.test(className));
}

/**
 * ヘッダー要素を分析
 */
function analyzeHeader(node: AriaNode, depth: number): HeaderInfo {
  const headerInfo: HeaderInfo = {
    element: node,
    type: determineHeaderType(node, depth),
    contains: {},
    isSticky: isSticky(node),
    depth,
  };

  // ヘッダー内の要素を分析
  if (node.children) {
    for (const child of node.children) {
      analyzeHeaderContent(child, headerInfo);
    }
  }

  return headerInfo;
}

/**
 * ヘッダーのタイプを判定
 */
function determineHeaderType(node: AriaNode, depth: number): HeaderInfo["type"] {
  // ページトップレベル（深さ0-2）なら main header
  if (depth <= 2) {
    return "main";
  }

  // 現在のARIA実装では親参照がないため、深さで判定
  // TODO: 将来的に親参照を追加した場合は、article内かどうかを確認する

  return "section";
}

/**
 * スティッキーヘッダーかどうかを判定
 */
function isSticky(node: AriaNode): boolean {
  const element = node.originalElement?.deref();
  if (!element) return false;

  // CSSクラス名からの推定
  const className = element.className || "";
  const stickyPatterns = [/\bsticky\b/i, /\bfixed\b/i, /\bpinned\b/i];

  return stickyPatterns.some((pattern) => pattern.test(className));
}

/**
 * ヘッダー内のコンテンツを分析
 */
function analyzeHeaderContent(node: AriaNode, headerInfo: HeaderInfo) {
  // ロゴの検出
  const logo = detectLogo(node);
  if (logo && !headerInfo.contains.logo) {
    headerInfo.contains.logo = logo;
  }

  // サイトタイトルの検出
  const siteTitle = detectSiteTitle(node);
  if (siteTitle && !headerInfo.contains.siteTitle) {
    headerInfo.contains.siteTitle = siteTitle;
  }

  // ナビゲーションの検出
  if (isNavigationElement(node)) {
    if (!headerInfo.contains.navigation) {
      headerInfo.contains.navigation = [];
    }
    headerInfo.contains.navigation.push(node);
  }

  // 検索フォームの検出
  if (isSearchElement(node)) {
    headerInfo.contains.search = node;
  }

  // 子要素も再帰的に分析
  if (node.children) {
    for (const child of node.children) {
      analyzeHeaderContent(child, headerInfo);
    }
  }
}

/**
 * ロゴ要素を検出
 */
export function detectLogo(node: AriaNode): LogoInfo | null {
  const element = node.originalElement?.deref();
  if (!element) return null;

  // img要素でロゴっぽいものを検出
  if (element.tagName === "img") {
    const alt = element.attributes?.alt || "";
    const src = element.attributes?.src || "";
    const className = element.className || "";

    const logoPatterns = [/\blogo\b/i, /\bbrand\b/i, /\bsite-?icon\b/i];

    const isLogo = logoPatterns.some(
      (pattern) => pattern.test(alt) || pattern.test(className) || pattern.test(src)
    );

    if (isLogo) {
      return {
        element: node,
        src,
        alt,
      };
    }
  }

  // テキストベースのロゴ（ブランド名など）
  const className = element.className || "";
  const id = element.attributes?.id || "";

  if (/\blogo\b/i.test(className) || /\blogo\b/i.test(id)) {
    const text = getAccessibleName(element);
    if (text) {
      return {
        element: node,
        text,
      };
    }
  }

  return null;
}

/**
 * サイトタイトルを検出
 */
export function detectSiteTitle(node: AriaNode): SiteTitleInfo | null {
  const element = node.originalElement?.deref();
  if (!element) return null;

  // h1-h3要素を探す
  if (element.tagName && /^h[1-3]$/i.test(element.tagName)) {
    const text = getAccessibleName(element);
    if (text) {
      const level = parseInt(element.tagName.substring(1), 10);
      return {
        element: node,
        text,
        level,
      };
    }
  }

  // サイト名っぽいクラス名を持つ要素
  const className = element.className || "";
  const titlePatterns = [/\bsite-?title\b/i, /\bsite-?name\b/i, /\bbrand-?name\b/i];

  if (titlePatterns.some((pattern) => pattern.test(className))) {
    const text = getAccessibleName(element);
    if (text) {
      return {
        element: node,
        text,
        level: 0, // 見出しレベルなし
      };
    }
  }

  return null;
}

/**
 * ナビゲーション要素かどうかを判定
 */
function isNavigationElement(node: AriaNode): boolean {
  const element = node.originalElement?.deref();
  if (!element) return false;

  // nav要素
  if (element.tagName === "nav") {
    return true;
  }

  // navigation roleを持つ要素
  if (element.attributes?.role === "navigation") {
    return true;
  }

  // メニューっぽいクラス名
  const className = element.className || "";
  const navPatterns = [/\bnav\b/i, /\bmenu\b/i, /\bnavigation\b/i];

  return navPatterns.some((pattern) => pattern.test(className));
}

/**
 * 検索要素かどうかを判定
 */
function isSearchElement(node: AriaNode): boolean {
  const element = node.originalElement?.deref();
  if (!element) return false;

  // search roleを持つ要素
  if (element.attributes?.role === "search") {
    return true;
  }

  // form要素で検索っぽいもの
  if (element.tagName === "form") {
    const className = element.className || "";
    const id = element.attributes?.id || "";
    const action = element.attributes?.action || "";

    const searchPatterns = [/\bsearch\b/i, /\bfind\b/i, /\bquery\b/i];

    return searchPatterns.some(
      (pattern) => pattern.test(className) || pattern.test(id) || pattern.test(action)
    );
  }

  // input[type="search"]を含む要素
  if (node.children) {
    return node.children.some((child) => {
      const childElement = child.originalElement?.deref();
      return (
        childElement &&
        childElement.tagName === "input" &&
        childElement.attributes?.type === "search"
      );
    });
  }

  return false;
}
