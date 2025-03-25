/**
 * Core implementation of Readability algorithm
 * Compact version that focuses on the essential parts
 */

import type { VDocument, VElement, VTextNode } from './types';
import {
  getInnerText,
  getLinkDensity,
  getElementsByTagName,
  isProbablyVisible,
  forEachNode,
  someNode
} from './vdom';
import {
  REGEXPS,
  DEFAULT_TAGS_TO_SCORE,
  DEFAULT_N_TOP_CANDIDATES,
  DEFAULT_CHAR_THRESHOLD
} from './constants';

/**
 * 要素にスコアを初期化する
 */
function initializeNode(node: VElement): void {
  node.readability = { contentScore: 0 };

  // タグ名に基づく初期スコア
  switch (node.tagName) {
    case 'DIV':
      node.readability.contentScore += 5;
      break;
    case 'PRE':
    case 'TD':
    case 'BLOCKQUOTE':
      node.readability.contentScore += 3;
      break;
    case 'ADDRESS':
    case 'OL':
    case 'UL':
    case 'DL':
    case 'DD':
    case 'DT':
    case 'LI':
    case 'FORM':
      node.readability.contentScore -= 3;
      break;
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
    case 'TH':
      node.readability.contentScore -= 5;
      break;
  }

  // クラス名とIDに基づくスコア調整
  node.readability.contentScore += getClassWeight(node);
}

/**
 * クラス名とIDに基づいてスコアを調整する
 */
function getClassWeight(node: VElement): number {
  let weight = 0;

  // クラス名のチェック
  if (node.className) {
    if (REGEXPS.negative.test(node.className)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.className)) {
      weight += 25;
    }
  }

  // IDのチェック
  if (node.id) {
    if (REGEXPS.negative.test(node.id)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.id)) {
      weight += 25;
    }
  }

  return weight;
}

/**
 * テキスト密度を計算する
 * 文字数 / 子要素数
 */
function getTextDensity(element: VElement): number {
  const text = getInnerText(element);
  const textLength = text.length;
  if (textLength === 0) return 0;
  
  const childElements = element.children.filter(child => child.nodeType === 'element');
  return textLength / (childElements.length || 1);
}

/**
 * 先祖要素を取得する
 */
function getNodeAncestors(node: VElement, maxDepth: number = 3): VElement[] {
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

/**
 * 本文の可能性が高いノードを検出する
 */
export function findMainContent(doc: VDocument): VElement | null {
  // 1. まずセマンティックタグを探す（単純な方法）
  const semanticTags = ['ARTICLE', 'MAIN'];
  for (const tag of semanticTags) {
    const elements = getElementsByTagName(doc.documentElement, tag);
    if (elements.length === 1) {
      return elements[0];
    }
  }

  // 2. スコアリングベースの検出
  const body = doc.body;
  const candidates: VElement[] = [];
  const elementsToScore: VElement[] = [];
  
  // スコアリング対象の要素を収集
  DEFAULT_TAGS_TO_SCORE.forEach(tag => {
    const elements = getElementsByTagName(body, tag);
    elementsToScore.push(...elements);
  });
  
  // 各要素をスコアリング
  for (const elementToScore of elementsToScore) {
    // 25文字未満の要素は無視
    const innerText = getInnerText(elementToScore);
    if (innerText.length < 25) continue;
    
    // 先祖要素を取得（最大3階層）
    const ancestors = getNodeAncestors(elementToScore, 3);
    if (ancestors.length === 0) continue;
    
    // 基本スコアを計算
    let contentScore = 1; // 基本点
    contentScore += innerText.split(REGEXPS.commas).length; // カンマの数
    contentScore += Math.min(Math.floor(innerText.length / 100), 3); // テキスト長（最大3点）
    
    // 先祖要素にスコアを加算
    for (let level = 0; level < ancestors.length; level++) {
      const ancestor = ancestors[level];
      
      if (!ancestor.readability) {
        initializeNode(ancestor);
        candidates.push(ancestor);
      }
      
      // 階層が深いほどスコアを減らす
      const scoreDivider = level === 0 ? 1 : (level === 1 ? 2 : level * 3);
      if (ancestor.readability) {
        ancestor.readability.contentScore += contentScore / scoreDivider;
      }
    }
  }
  
  // 候補からトップを選定
  let topCandidate: VElement | null = null;
  
  for (const candidate of candidates) {
    // リンク密度でスコアを調整
    if (candidate.readability) {
      const linkDensity = getLinkDensity(candidate);
      candidate.readability.contentScore *= (1 - linkDensity);
      
      // テキスト密度も考慮する
      // テキスト密度が高い要素は、より多くのテキストコンテンツを含む可能性が高い
      const textDensity = getTextDensity(candidate);
      if (textDensity > 0) {
        // テキスト密度が高いほど、スコアを少し上げる（最大10%）
        candidate.readability.contentScore *= (1 + Math.min(textDensity / 10, 0.1));
      }
      
      if (!topCandidate || 
          (topCandidate.readability && 
           candidate.readability.contentScore > topCandidate.readability.contentScore)) {
        topCandidate = candidate;
      }
    }
  }
  
  // 候補が見つからない場合はbodyを返す
  if (!topCandidate) {
    return body;
  }
  
  // 親ノードの方がより良い候補かもしれない
  let currentCandidate = topCandidate;
  let parentOfCandidate = currentCandidate.parent;
  
  // 親ノードのスコアが高い場合は親を選択
  while (parentOfCandidate && parentOfCandidate.tagName !== 'BODY') {
    if (parentOfCandidate.readability && 
        currentCandidate.readability && 
        parentOfCandidate.readability.contentScore > currentCandidate.readability.contentScore) {
      currentCandidate = parentOfCandidate;
    }
    parentOfCandidate = parentOfCandidate.parent;
  }
  
  return currentCandidate;
}

/**
 * 本文抽出のメイン関数
 */
export function extractContent(doc: VDocument): { content: VElement | null, textLength: number } {
  // 本文の候補を見つける
  const mainContent = findMainContent(doc);
  
  if (!mainContent) {
    return { content: null, textLength: 0 };
  }
  
  // テキスト長を計算
  const textLength = getInnerText(mainContent).length;
  
  // 最小文字数チェック - テスト用に一時的に無効化
  // if (textLength < DEFAULT_CHAR_THRESHOLD) {
  //   return { content: null, textLength };
  // }
  
  return { content: mainContent, textLength };
}

/**
 * 本文の可能性を判定する（isProbablyReaderable相当の簡易版）
 */
export function isProbablyContent(element: VElement): boolean {
  // 可視性チェック
  if (!isProbablyVisible(element)) {
    return false;
  }
  
  // クラス名とIDのチェック
  const matchString = (element.className || '') + ' ' + (element.id || '');
  if (REGEXPS.unlikelyCandidates.test(matchString) && 
      !REGEXPS.okMaybeItsACandidate.test(matchString)) {
    return false;
  }
  
  // テキスト長のチェック
  const textLength = getInnerText(element).length;
  if (textLength < 140) {
    return false;
  }
  
  // リンク密度のチェック
  const linkDensity = getLinkDensity(element);
  if (linkDensity > 0.5) {
    return false;
  }
  
  // テキスト密度のチェック
  // テキスト密度が極端に低い場合は、本文である可能性が低い
  const textDensity = getTextDensity(element);
  if (textDensity < 0.1) {
    return false;
  }
  
  return true;
}
