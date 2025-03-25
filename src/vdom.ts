/*
 * Virtual DOM structure for DOM-independent readability implementation
 */

import type { VElement, VNode, VTextNode } from "./types.ts";

// 型ガード関数
export function isVElement(node: VNode): node is VElement {
  return node.nodeType === 'element';
}

export function isVTextNode(node: VNode): node is VTextNode {
  return node.nodeType === 'text';
}

// ノードの作成ヘルパー関数
export function createVElement(tagName: string): VElement {
  return {
    nodeType: 'element',
    tagName: tagName.toUpperCase(),
    attributes: {},
    children: []
  };
}

export function createVTextNode(content: string): VTextNode {
  return {
    nodeType: 'text',
    textContent: content
  };
}

// ユーティリティ関数

// テキストコンテンツの取得
export function getTextContent(node: VElement | VTextNode): string {
  if (node.nodeType === 'text') {
    return node.textContent;
  }
  
  return node.children
    .map(child => getTextContent(child))
    .join('');
}

// 属性の取得
export function getAttribute(element: VElement, name: string): string | null {
  return element.attributes[name] || null;
}

// 属性の設定
export function setAttribute(element: VElement, name: string, value: string): void {
  element.attributes[name] = value;
  
  // 特別な属性の処理
  if (name === 'id') {
    element.id = value;
  } else if (name === 'class') {
    element.className = value;
  }
}

// 属性の削除
export function removeAttribute(element: VElement, name: string): void {
  delete element.attributes[name];
  
  // 特別な属性の処理
  if (name === 'id') {
    delete element.id;
  } else if (name === 'class') {
    delete element.className;
  }
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

// ノードの削除と次のノードの取得
export function removeAndGetNext(node: VElement | VTextNode): VElement | VTextNode | null {
  const next = getNextNode(node, true);
  
  if (node.parent) {
    const siblings = node.parent.children;
    const index = siblings.indexOf(node);
    if (index !== -1) {
      siblings.splice(index, 1);
    }
  }
  
  return next;
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
  maxDepth: number = -1, 
  filterFn?: (node: VElement) => boolean
): boolean {
  tagName = tagName.toUpperCase();
  let depth = 0;
  let currentNode = node.parent;
  
  while (currentNode) {
    if (maxDepth > 0 && depth > maxDepth) {
      return false;
    }
    
    if (
      currentNode.tagName === tagName &&
      (!filterFn || filterFn(currentNode))
    ) {
      return true;
    }
    
    currentNode = currentNode.parent;
    depth++;
  }
  
  return false;
}

// 子ブロック要素の確認
export function hasChildBlockElement(element: VElement): boolean {
  const DIV_TO_P_ELEMS = new Set([
    "BLOCKQUOTE",
    "DL",
    "DIV",
    "IMG",
    "OL",
    "P",
    "PRE",
    "TABLE",
    "UL",
  ]);
  
  return someNode(element.children, child => {
    if (child.nodeType !== 'element') {
      return false;
    }
    
    return DIV_TO_P_ELEMS.has(child.tagName) || hasChildBlockElement(child);
  });
}

// フレージングコンテンツの確認
export function isPhrasingContent(node: VNode): boolean {
  const PHRASING_ELEMS = [
    "ABBR",
    "AUDIO",
    "B",
    "BDO",
    "BR",
    "BUTTON",
    "CITE",
    "CODE",
    "DATA",
    "DATALIST",
    "DFN",
    "EM",
    "EMBED",
    "I",
    "IMG",
    "INPUT",
    "KBD",
    "LABEL",
    "MARK",
    "MATH",
    "METER",
    "NOSCRIPT",
    "OBJECT",
    "OUTPUT",
    "PROGRESS",
    "Q",
    "RUBY",
    "SAMP",
    "SCRIPT",
    "SELECT",
    "SMALL",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "TEXTAREA",
    "TIME",
    "VAR",
    "WBR",
  ];
  
  if (isVTextNode(node)) {
    return true;
  }
  
  if (isVElement(node)) {
    if (PHRASING_ELEMS.includes(node.tagName)) {
      return true;
    }
    
    if (
      node.tagName === "A" ||
      node.tagName === "DEL" ||
      node.tagName === "INS"
    ) {
      return everyNode(node.children, isPhrasingContent);
    }
  }
  
  return false;
}

// 空白の確認
export function isWhitespace(node: VElement | VTextNode): boolean {
  if (node.nodeType === 'text') {
    return node.textContent.trim() === '';
  }
  
  return node.tagName === "BR";
}

// 内部テキストの取得
export function getInnerText(element: VElement | VTextNode, normalizeSpaces: boolean = true): string {
  const text = getTextContent(element).trim();
  
  if (normalizeSpaces) {
    return text.replace(/\s{2,}/g, ' ');
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
