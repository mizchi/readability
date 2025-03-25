/**
 * Readability v3 - プリプロセス
 * 
 * HTML解析前の前処理を行う
 */

import type { VDocument, VElement } from './types.ts';
import { getElementsByTagName } from './dom.ts';

// 除去するセマンティックタグのリスト
const TAGS_TO_REMOVE = [
  'ASIDE',      // サイドバーなど、メインコンテンツに直接関係ない補足情報
  'NAV',        // ナビゲーションメニュー
  'HEADER',     // ページヘッダー
  'FOOTER',     // ページフッター
  'SCRIPT',     // JavaScript
  'STYLE',      // CSS
  'NOSCRIPT',   // JavaScript無効時の代替コンテンツ
  'IFRAME',     // 埋め込みフレーム（広告やSNSウィジェットなど）
  'FORM',       // フォーム要素（ログインフォームなど）
  'BUTTON',     // ボタン要素
  'OBJECT',     // 埋め込みオブジェクト
  'EMBED',      // 埋め込みコンテンツ
  'APPLET',     // 古い埋め込みJavaアプレット
  'MAP',        // 画像マップ
  'DIALOG',     // ダイアログボックス
  // 'AUDIO',      // 音声プレーヤー
  // 'VIDEO',      // 動画プレーヤー
  // 以下は本文に必要な場合があるため除外
  // 'FIGURE',  // 図表（キャプション付き）
  // 'CANVAS',  // Canvas要素
  // 'DETAILS', // 折りたたみ可能な詳細情報
];

// 広告を示す可能性が高いクラス名やID名のパターン
const AD_PATTERNS = [
  /ad-/i, /^ad$/i, /^ads$/i, /advert/i, /banner/i, /sponsor/i, /promo/i,
  /google-ad/i, /adsense/i, /doubleclick/i, /amazon/i, /affiliate/i,
  /commercial/i, /paid/i, /shopping/i, /recommendation/i
];

/**
 * ドキュメントからノイズとなる要素を除去する
 * 
 * @param doc 処理するドキュメント
 * @returns 処理されたドキュメント
 */
export function preprocessDocument(doc: VDocument): VDocument {
  // 1. セマンティックタグと不要なタグを除去
  removeUnwantedTags(doc);
  
  // 2. 広告要素を除去
  removeAds(doc);
  
  return doc;
}

/**
 * 不要なタグを除去する
 */
function removeUnwantedTags(doc: VDocument): void {
  for (const tagName of TAGS_TO_REMOVE) {
    const elements = getElementsByTagName(doc.documentElement, tagName);
    
    // 要素を親から削除
    for (const element of elements) {
      if (element.parent) {
        const index = element.parent.children.indexOf(element);
        if (index !== -1) {
          element.parent.children.splice(index, 1);
        }
      }
    }
  }
}

/**
 * 広告要素を除去する
 */
function removeAds(doc: VDocument): void {
  // body以下のすべての要素を取得
  const allElements = getElementsByTagName(doc.body, '*');
  
  // 広告と思われる要素を除去
  for (const element of allElements) {
    if (isLikelyAd(element) && element.parent) {
      const index = element.parent.children.indexOf(element);
      if (index !== -1) {
        element.parent.children.splice(index, 1);
      }
    }
  }
}

/**
 * 要素が広告である可能性を判定する
 */
function isLikelyAd(element: VElement): boolean {
  // クラス名とIDをチェック
  const className = element.className || '';
  const id = element.id || '';
  const combinedString = `${className} ${id}`;
  
  // 広告パターンに一致するか確認
  for (const pattern of AD_PATTERNS) {
    if (pattern.test(combinedString)) {
      return true;
    }
  }
  
  // 広告関連の属性をチェック
  if (element.attributes.role === 'advertisement' ||
      element.attributes['data-ad'] !== undefined ||
      element.attributes['data-ad-client'] !== undefined ||
      element.attributes['data-ad-slot'] !== undefined) {
    return true;
  }
  
  return false;
}

/**
 * 要素が可視かどうかを判定する
 */
function isVisible(element: VElement): boolean {
  // style属性をチェック
  const style = element.attributes.style || '';
  if (style.includes('display: none') || 
      style.includes('visibility: hidden') || 
      style.includes('opacity: 0')) {
    return false;
  }
  
  // hidden属性をチェック
  if (element.attributes.hidden !== undefined) {
    return false;
  }
  
  // aria-hidden属性をチェック
  if (element.attributes['aria-hidden'] === 'true') {
    return false;
  }
  
  return true;
}
