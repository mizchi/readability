/**
 * Readability v3 - DOM操作ユーティリティ
 * 
 * 仮想DOM構造を操作するためのユーティリティ関数
 */

import type { VElement, VNode, VTextNode } from "./types.ts";
import { DIV_TO_P_ELEMS, PHRASING_ELEMS, REGEXPS } from "./constants.ts";

// ノードの作成ヘルパー関数
export function createElement(tagName: string): VElement {
  return {
    nodeType: 'element',
    tagName: tagName.toUpperCase(),
    attributes: {},
    children: []
  };
}

export function createTextNode(content: string): VTextNode {
  return {
    nodeType: 'text',
    textContent: content
  };
}

// 属性の取得
export function getAttribute(element: VElement, name: string): string | null {
  return element.attributes[name] || null;
}

// 要素の取得（タグ名で）
export function getElementsByTagName(element: VElement, tagName: string | string[]): VElement[] {
  const tagNames = Array.isArray(tagName) ? tagName : [tagName];
  const upperTagNames = tagNames.map(tag => tag.toUpperCase());
  const result: VElement[] = [];
  
  // この要素が一致するか確認
  if (upperTagNames.includes('*') || upperTagNames.includes(element.tagName)) {
    result.push(element);
  }
  
  // 子要素を再帰的に確認
  for (const child of element.children) {
    if (child.nodeType === 'element') {
      result.push(...getElementsByTagName(child, tagName));
    }
  }
  
  return result;
}

// 次のノードを取得（深さ優先探索）
export function getNextNode(node: VElement | VTextNode, ignoreSelfAndKids?: boolean): VElement | VTextNode | null {
  if (node.nodeType === 'element' && !ignoreSelfAndKids && node.children.length > 0) {
    return node.children[0];
  }
  
  // 兄弟ノードを探す
  const siblings = node.parent?.children || [];
  const index = siblings.indexOf(node);
  if (index !== -1 && index < siblings.length - 1) {
    return siblings[index + 1];
  }
  
  // 親の兄弟を探す
  if (node.parent) {
    return getNextNode(node.parent, true);
  }
  
  return null;
}

// 可視性の確認
export function isProbablyVisible(node: VElement): boolean {
  const style = node.attributes.style || '';
  const hidden = node.attributes.hidden !== undefined;
  const ariaHidden = node.attributes['aria-hidden'] === 'true';
  
  return !style.includes('display: none') && 
         !style.includes('visibility: hidden') && 
         !hidden && 
         !ariaHidden;
}

// ノードの反復処理
export function forEachNode<T extends VElement | VTextNode>(
  nodeList: T[], 
  fn: (node: T, index: number, list: T[]) => void
): void {
  nodeList.forEach(fn);
}

// いずれかのノードが条件を満たすか確認
export function someNode<T extends VElement | VTextNode>(
  nodeList: T[], 
  fn: (node: T, index: number, list: T[]) => boolean
): boolean {
  return nodeList.some(fn);
}

// すべてのノードが条件を満たすか確認
export function everyNode<T extends VElement | VTextNode>(
  nodeList: T[], 
  fn: (node: T, index: number, list: T[]) => boolean
): boolean {
  return nodeList.every(fn);
}

// 先祖要素のチェック
export function hasAncestorTag(
  node: VElement | VTextNode, 
  tagName: string, 
  maxDepth: number = -1
): boolean {
  tagName = tagName.toUpperCase();
  let depth = 0;
  let currentNode = node.parent;
  
  while (currentNode) {
    if (maxDepth > 0 && depth > maxDepth) {
      return false;
    }
    
    if (currentNode.tagName === tagName) {
      return true;
    }
    
    currentNode = currentNode.parent;
    depth++;
  }
  
  return false;
}

// 子ブロック要素の確認
export function hasChildBlockElement(element: VElement): boolean {
  return someNode(element.children, child => {
    if (child.nodeType !== 'element') {
      return false;
    }
    
    return DIV_TO_P_ELEMS.has(child.tagName) || hasChildBlockElement(child);
  });
}

// フレージングコンテンツの確認
export function isPhrasingContent(node: VNode): boolean {
  if (node.nodeType === 'text') {
    return true;
  }
  
  if (node.nodeType === 'element') {
    const element = node as VElement;
    
    if (PHRASING_ELEMS.includes(element.tagName)) {
      return true;
    }
    
    if (
      element.tagName === "A" ||
      element.tagName === "DEL" ||
      element.tagName === "INS"
    ) {
      return everyNode(element.children, isPhrasingContent);
    }
  }
  
  return false;
}

// 内部テキストの取得
export function getInnerText(element: VElement | VTextNode, normalizeSpaces: boolean = true): string {
  let text = '';
  
  if (element.nodeType === 'text') {
    text = element.textContent;
  } else {
    for (const child of element.children) {
      if (child.nodeType === 'text') {
        text += child.textContent;
      } else {
        text += getInnerText(child, false);
      }
    }
  }
  
  text = text.trim();
  
  if (normalizeSpaces) {
    return text.replace(REGEXPS.normalize, ' ');
  }
  
  return text;
}

// リンク密度の取得
export function getLinkDensity(element: VElement): number {
  const textLength = getInnerText(element).length;
  if (textLength === 0) {
    return 0;
  }
  
  let linkLength = 0;
  const links = getElementsByTagName(element, 'a');
  
  forEachNode(links, link => {
    const href = getAttribute(link, 'href');
    const coefficient = href && href.startsWith('#') ? 0.3 : 1;
    linkLength += getInnerText(link).length * coefficient;
  });
  
  return linkLength / textLength;
}

// テキスト密度の取得
export function getTextDensity(element: VElement): number {
  const text = getInnerText(element);
  const textLength = text.length;
  if (textLength === 0) return 0;
  
  const childElements = element.children.filter(child => child.nodeType === 'element');
  return textLength / (childElements.length || 1);
}

// 先祖要素の取得
export function getNodeAncestors(node: VElement, maxDepth: number = 3): VElement[] {
  const ancestors: VElement[] = [];
  let currentNode = node.parent;
  let depth = 0;
  
  while (currentNode && (maxDepth <= 0 || depth < maxDepth)) {
    ancestors.push(currentNode);
    currentNode = currentNode.parent;
    depth++;
  }
  
  return ancestors;
}
