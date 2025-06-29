import type { AriaNode, VElement } from "../types";
import { getAccessibleName } from "../nav/aria";

export type NavigationType = 
  | "global"      // グローバルナビゲーション（メインメニュー）
  | "local"       // ローカルナビゲーション（サブメニュー）
  | "breadcrumb"  // パンくずリスト
  | "pagination"  // ページネーション
  | "toc"         // 目次（Table of Contents）
  | "social"      // ソーシャルリンク
  | "footer"      // フッターナビゲーション
  | "utility";    // ユーティリティナビゲーション（ログイン、言語切替等）

export type NavigationLocation = "header" | "sidebar" | "footer" | "inline";
export type NavigationStructure = "flat" | "nested" | "dropdown" | "tabs";

export interface NavigationInfo {
  element: AriaNode;
  type: NavigationType;
  location: NavigationLocation;
  items: NavigationItem[];
  structure: NavigationStructure;
  label?: string;
}

export interface NavigationItem {
  label: string;
  href?: string;
  level: number;
  children?: NavigationItem[];
  isCurrent?: boolean;
  isActive?: boolean;
  icon?: string;
}

/**
 * ナビゲーション要素を検出して分類する
 */
export function detectNavigations(root: AriaNode): NavigationInfo[] {
  const navigations: NavigationInfo[] = [];
  
  // 再帰的にナビゲーション要素を探索
  function traverse(node: AriaNode, ancestors: AriaNode[] = []) {
    if (isNavigationElement(node)) {
      const navInfo = analyzeNavigation(node, ancestors);
      if (navInfo) {
        navigations.push(navInfo);
      }
    }
    
    // 子要素を探索
    if (node.children) {
      for (const child of node.children) {
        traverse(child, [...ancestors, node]);
      }
    }
  }
  
  traverse(root);
  
  return navigations;
}

/**
 * ナビゲーション要素を分析
 */
function analyzeNavigation(node: AriaNode, ancestors: AriaNode[]): NavigationInfo | null {
  const items = extractNavigationItems(node);
  
  // アイテムがない場合はナビゲーションとして扱わない
  if (items.length === 0) {
    return null;
  }
  
  const type = classifyNavigationType(node, items, ancestors);
  const location = determineLocation(node, ancestors);
  const structure = analyzeStructure(node, items);
  const label = getNavigationLabel(node);
  
  return {
    element: node,
    type,
    location,
    items,
    structure,
    label,
  };
}

/**
 * ナビゲーションのタイプを分類
 */
function classifyNavigationType(
  node: AriaNode, 
  items: NavigationItem[], 
  ancestors: AriaNode[]
): NavigationType {
  const originalElement = node.originalElement?.deref();
  const className = originalElement?.className || "";
  const ariaLabel = originalElement?.attributes?.["aria-label"] || "";
  const itemTexts = items.map(item => item.label.toLowerCase());
  
  // パンくずリスト
  if (
    ariaLabel.toLowerCase().includes("breadcrumb") ||
    className.includes("breadcrumb") ||
    hasBreadcrumbStructure(items)
  ) {
    return "breadcrumb";
  }
  
  // ページネーション
  if (
    className.includes("pagination") ||
    className.includes("pager") ||
    hasPaginationPattern(items)
  ) {
    return "pagination";
  }
  
  // 目次
  if (
    className.includes("toc") ||
    className.includes("table-of-contents") ||
    ariaLabel.toLowerCase().includes("contents") ||
    hasTOCPattern(items)
  ) {
    return "toc";
  }
  
  // ソーシャルリンク
  if (
    className.includes("social") ||
    hasSocialLinks(items)
  ) {
    return "social";
  }
  
  // フッターナビゲーション
  if (isInFooter(ancestors)) {
    return "footer";
  }
  
  // ヘッダー内の大きなナビゲーションはグローバル（優先度を上げる）
  const inHeader = isInHeader(ancestors);
  if (inHeader && items.length >= 3) {
    // ユーティリティパターンがあっても、メインナビゲーションと思われる場合はグローバルとする
    const utilityCount = items.filter(item => hasUtilityKeyword(item.label)).length;
    if (utilityCount < items.length * 0.5) {
      return "global";
    }
  }
  
  // ユーティリティナビゲーション
  if (hasUtilityPattern(items)) {
    return "utility";
  }
  
  // デフォルトはローカル
  return "local";
}

/**
 * ナビゲーションの位置を判定
 */
function determineLocation(node: AriaNode, ancestors: AriaNode[]): NavigationLocation {
  // ヘッダー内
  if (isInHeader(ancestors)) {
    return "header";
  }
  
  // フッター内
  if (isInFooter(ancestors)) {
    return "footer";
  }
  
  // サイドバー内（aside要素やsidebarクラス）
  if (isInSidebar(ancestors)) {
    return "sidebar";
  }
  
  // その他はインライン
  return "inline";
}

/**
 * ナビゲーション構造を分析
 */
function analyzeStructure(node: AriaNode, items: NavigationItem[]): NavigationStructure {
  // ネストされたアイテムがあるか
  const hasNested = items.some(item => item.children && item.children.length > 0);
  
  const originalElement = node.originalElement?.deref();
  
  if (hasNested) {
    // ドロップダウンメニューのパターン
    if (originalElement && hasDropdownPattern(originalElement)) {
      return "dropdown";
    }
    return "nested";
  }
  
  // タブパターン
  if (originalElement && hasTabPattern(originalElement)) {
    return "tabs";
  }
  
  return "flat";
}

/**
 * ナビゲーションアイテムを抽出
 */
function extractNavigationItems(node: AriaNode): NavigationItem[] {
  const items: NavigationItem[] = [];
  
  // リスト構造（ul/ol）からの抽出
  const lists = findListElements(node);
  for (const list of lists) {
    items.push(...extractItemsFromList(list, 0));
  }
  
  // リスト構造がない場合は直接リンクを探す
  if (items.length === 0) {
    items.push(...extractDirectLinks(node, 0));
  }
  
  return items;
}

/**
 * リスト要素からアイテムを抽出
 */
function extractItemsFromList(list: AriaNode, level: number): NavigationItem[] {
  const items: NavigationItem[] = [];
  
  if (list.children) {
    for (const child of list.children) {
      const childElement = child.originalElement?.deref();
      if (childElement && childElement.tagName === "li") {
        const item = extractItemFromListItem(child, level);
        if (item) {
          items.push(item);
        }
      }
    }
  }
  
  return items;
}

/**
 * リストアイテムから情報を抽出
 */
function extractItemFromListItem(li: AriaNode, level: number): NavigationItem | null {
  // リンクを探す
  const link = findFirstLink(li);
  
  if (link) {
    // リンクがある場合
    const linkElement = link.originalElement?.deref();
    if (!linkElement) return null;
    
    const label = getAccessibleName(linkElement);
    if (!label) return null;
    
    const item: NavigationItem = {
      label,
      href: linkElement.attributes?.href,
      level,
      isCurrent: hasCurrent(li, link),
      isActive: hasActive(li, link),
    };
    
    // 子リストがあるか確認
    const childList = findChildList(li);
    if (childList) {
      item.children = extractItemsFromList(childList, level + 1);
    }
    
    return item;
  } else {
    // リンクがない場合（ブレッドクラムの現在位置など）
    const liElement = li.originalElement?.deref();
    if (!liElement) return null;
    
    const label = getAccessibleName(liElement);
    if (!label || label.trim() === '') {
      // テキストコンテンツを直接取得してみる
      const textContent = getTextFromNode(li);
      if (textContent && textContent.trim() !== '') {
        return {
          label: textContent.trim(),
          level,
          isCurrent: true,
          isActive: true,
        };
      }
      return null;
    }
    
    return {
      label,
      level,
      isCurrent: true,
      isActive: true,
    };
  }
}

/**
 * 直接的なリンクを抽出
 */
function extractDirectLinks(node: AriaNode, level: number): NavigationItem[] {
  const items: NavigationItem[] = [];
  const links = findAllLinks(node);
  
  for (const link of links) {
    const linkElement = link.originalElement?.deref();
    if (linkElement) {
      const label = getAccessibleName(linkElement);
      if (label) {
        items.push({
          label,
          href: linkElement.attributes?.href,
          level,
          isCurrent: hasCurrent(link, link),
          isActive: hasActive(link, link),
        });
      }
    }
  }
  
  return items;
}

// ============= ヘルパー関数 =============

/**
 * AriaNodeからテキストコンテンツを取得
 */
function getTextFromNode(node: AriaNode): string {
  let text = '';
  
  // AriaNodeはnameプロパティを持つ
  if (node.name) {
    text += node.name;
  }
  
  if (node.children) {
    for (const child of node.children) {
      text += getTextFromNode(child);
    }
  }
  
  return text;
}

function isNavigationElement(node: AriaNode): boolean {
  // AriaNodeのtypeをチェック
  if (node.type === "navigation") return true;
  
  // originalElementが存在する場合、元の要素の情報をチェック
  const originalElement = node.originalElement?.deref();
  if (originalElement) {
    if (originalElement.tagName === "nav") return true;
    if (originalElement.attributes?.role === "navigation") return true;
    
    const className = originalElement.className || "";
    return /\b(nav|menu|navigation)\b/i.test(className);
  }
  
  return false;
}

function getNavigationLabel(node: AriaNode): string | undefined {
  const originalElement = node.originalElement?.deref();
  if (originalElement) {
    return originalElement.attributes?.["aria-label"] || 
           originalElement.attributes?.["aria-labelledby"] ||
           undefined;
  }
  return undefined;
}

function isInHeader(ancestors: AriaNode[]): boolean {
  return ancestors.some(a => {
    const originalElement = a.originalElement?.deref();
    return originalElement && (
      originalElement.tagName === "header" || 
      originalElement.attributes?.role === "banner" ||
      /\bheader\b/i.test(originalElement.className || "")
    );
  });
}

function isInFooter(ancestors: AriaNode[]): boolean {
  return ancestors.some(a => {
    const originalElement = a.originalElement?.deref();
    return originalElement && (
      originalElement.tagName === "footer" || 
      originalElement.attributes?.role === "contentinfo" ||
      /\bfooter\b/i.test(originalElement.className || "")
    );
  });
}

function isInSidebar(ancestors: AriaNode[]): boolean {
  return ancestors.some(a => {
    const originalElement = a.originalElement?.deref();
    return originalElement && (
      originalElement.tagName === "aside" || 
      originalElement.attributes?.role === "complementary" ||
      /\b(sidebar|aside)\b/i.test(originalElement.className || "")
    );
  });
}

function hasBreadcrumbStructure(items: NavigationItem[]): boolean {
  // パンくずは通常3つ以上のアイテムで、セパレーターを含むことが多い
  return items.length >= 3 && items.some(item => 
    item.label === ">" || item.label === "/" || item.label === "»"
  );
}

function hasPaginationPattern(items: NavigationItem[]): boolean {
  const labels = items.map(item => item.label.toLowerCase());
  const paginationKeywords = ["previous", "prev", "next", "first", "last"];
  
  // 数字のみのラベルがあるか
  const hasNumbers = labels.some(label => /^\d+$/.test(label));
  
  // ページネーションキーワードがあるか
  const hasKeywords = labels.some(label => 
    paginationKeywords.some(keyword => label.includes(keyword))
  );
  
  return hasNumbers || hasKeywords;
}

function hasTOCPattern(items: NavigationItem[]): boolean {
  // アンカーリンク（#で始まる）が多い
  const anchorLinks = items.filter(item => 
    item.href && item.href.startsWith("#")
  );
  
  return anchorLinks.length > items.length * 0.7;
}

function hasSocialLinks(items: NavigationItem[]): boolean {
  const socialPatterns = [
    /facebook/i, /twitter/i, /linkedin/i, /instagram/i, 
    /youtube/i, /github/i, /pinterest/i, /tiktok/i
  ];
  
  const socialCount = items.filter(item => 
    socialPatterns.some(pattern => 
      pattern.test(item.label) || 
      (item.href && pattern.test(item.href))
    )
  ).length;
  
  return socialCount > items.length * 0.5;
}

function hasUtilityKeyword(label: string): boolean {
  const utilityKeywords = [
    "login", "logout", "sign in", "sign out", "register",
    "account", "profile", "settings", "help", "contact"
  ];
  
  const lowerLabel = label.toLowerCase();
  return utilityKeywords.some(keyword => lowerLabel.includes(keyword));
}

function hasUtilityPattern(items: NavigationItem[]): boolean {
  const labels = items.map(item => item.label.toLowerCase());
  return labels.some(label => hasUtilityKeyword(label));
}

function hasDropdownPattern(element: VElement): boolean {
  const className = element.className || "";
  return /\b(dropdown|submenu|mega-?menu)\b/i.test(className);
}

function hasTabPattern(element: VElement): boolean {
  return element.attributes?.role === "tablist" ||
         /\b(tabs?|tab-?list)\b/i.test(element.className || "");
}

function findListElements(node: AriaNode): AriaNode[] {
  const lists: AriaNode[] = [];
  
  function traverse(n: AriaNode) {
    const originalElement = n.originalElement?.deref();
    if (originalElement && (originalElement.tagName === "ul" || originalElement.tagName === "ol")) {
      lists.push(n);
    }
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return lists;
}

function findFirstLink(node: AriaNode): AriaNode | null {
  const originalElement = node.originalElement?.deref();
  if (originalElement && originalElement.tagName === "a") return node;
  
  if (node.children) {
    for (const child of node.children) {
      const link = findFirstLink(child);
      if (link) return link;
    }
  }
  
  return null;
}

function findAllLinks(node: AriaNode): AriaNode[] {
  const links: AriaNode[] = [];
  
  function traverse(n: AriaNode) {
    const originalElement = n.originalElement?.deref();
    if (originalElement && originalElement.tagName === "a") {
      links.push(n);
    }
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return links;
}

function findChildList(node: AriaNode): AriaNode | null {
  if (node.children) {
    for (const child of node.children) {
      const originalElement = child.originalElement?.deref();
      if (originalElement && (originalElement.tagName === "ul" || originalElement.tagName === "ol")) {
        return child;
      }
    }
  }
  return null;
}

function hasCurrent(container: AriaNode, link: AriaNode): boolean {
  const containerElement = container.originalElement?.deref();
  const linkElement = link.originalElement?.deref();
  
  return (containerElement?.attributes?.["aria-current"] === "page") ||
         (linkElement?.attributes?.["aria-current"] === "page") ||
         /\b(current|active)\b/i.test(containerElement?.className || "");
}

function hasActive(container: AriaNode, link: AriaNode): boolean {
  const containerElement = container.originalElement?.deref();
  const linkElement = link.originalElement?.deref();
  
  return /\bactive\b/i.test(containerElement?.className || "") ||
         /\bactive\b/i.test(linkElement?.className || "");
}