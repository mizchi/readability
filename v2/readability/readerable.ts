/*
 * DOM-independent implementation of isProbablyReaderable
 */

import { REGEXPS } from "../constants.ts";
import type { VDocument, VElement } from "../types.ts";
import { getTextContent, isProbablyVisible } from "../vdom.ts";

/**
 * isProbablyReaderable用のオプション
 */
export interface IsProbablyReaderableOptions {
  minScore?: number;
  minContentLength?: number;
  visibilityChecker?: (node: VElement) => boolean;
}

/**
 * ドキュメントが読み取り可能かどうかを解析せずに判断します。
 * 
 * @param doc 判断するドキュメント
 * @param options 設定オプション
 * @returns ドキュメントが読み取り可能かどうか
 */
export function isProbablyReaderable(
  doc: VDocument,
  options: IsProbablyReaderableOptions | ((node: VElement) => boolean) = {}
): boolean {
  // 後方互換性のため、optionsは設定オブジェクトまたはvisibilityChecker関数のいずれかになります
  if (typeof options === "function") {
    options = { visibilityChecker: options };
  }

  const defaultOptions = {
    minScore: 20,
    minContentLength: 140,
    visibilityChecker: isProbablyVisible,
  };
  
  options = { ...defaultOptions, ...options };

  // p, pre, article要素を取得
  const pElements = getAllElementsByTagName(doc.documentElement, "P");
  const preElements = getAllElementsByTagName(doc.documentElement, "PRE");
  const articleElements = getAllElementsByTagName(doc.documentElement, "ARTICLE");
  
  // 基本的なノードリスト
  let nodes = [...pElements, ...preElements, ...articleElements];

  // <br>を含む<div>ノードを取得して追加
  const brNodes = getAllElementsWithBr(doc.documentElement);
  if (brNodes.length) {
    // 重複を排除
    const nodeSet = new Set(nodes);
    brNodes.forEach(node => {
      nodeSet.add(node.parent as VElement);
    });
    nodes = Array.from(nodeSet);
  }

  let score = 0;
  // スコアを累積して判断
  return nodes.some(node => {
    if (!options.visibilityChecker!(node)) {
      return false;
    }

    const matchString = (node.className || "") + " " + (node.id || "");
    if (
      REGEXPS.unlikelyCandidates.test(matchString) &&
      !REGEXPS.okMaybeItsACandidate.test(matchString)
    ) {
      return false;
    }

    // li p のパターンをチェック
    if (node.parent && 
        node.parent.tagName === "LI" && 
        node.tagName === "P") {
      return false;
    }

    const textContentLength = getTextContent(node).trim().length;
    if (textContentLength < options.minContentLength!) {
      return false;
    }

    score += Math.sqrt(textContentLength - options.minContentLength!);

    if (score > options.minScore!) {
      return true;
    }
    return false;
  });
}

/**
 * 指定されたタグ名を持つすべての要素を取得
 */
function getAllElementsByTagName(element: VElement, tagName: string): VElement[] {
  const upperTagName = tagName.toUpperCase();
  const result: VElement[] = [];
  
  function traverse(node: VElement) {
    if (node.tagName === upperTagName) {
      result.push(node);
    }
    
    for (const child of node.children) {
      if (child.nodeType === 'element') {
        traverse(child);
      }
    }
  }
  
  traverse(element);
  return result;
}

/**
 * <br>要素を含むすべての要素を取得
 */
function getAllElementsWithBr(element: VElement): VElement[] {
  const result: VElement[] = [];
  
  function traverse(node: VElement) {
    let hasBr = false;
    
    for (const child of node.children) {
      if (child.nodeType === 'element') {
        if (child.tagName === 'BR') {
          hasBr = true;
        }
        traverse(child);
      }
    }
    
    if (hasBr) {
      result.push(node);
    }
  }
  
  traverse(element);
  return result;
}
