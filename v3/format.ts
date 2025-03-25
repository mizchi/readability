/**
 * Readability v3 - フォーマット関数
 * 
 * VElementからHTMLを生成する関数と文字列化する関数を提供
 */

import type { VElement, VTextNode, VNode } from './types';

/**
 * VElementからHTML文字列を生成する
 * 
 * @param element 変換するVElement
 * @returns HTML文字列
 */
export function elementToHTML(element: VElement | null): string {
  if (!element) return '';
  
  const { tagName, attributes, children } = element;
  const tagNameLower = tagName.toLowerCase();
  
  // 自己終了タグのリスト
  const selfClosingTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);
  
  // 属性文字列の生成
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeHTML(value)}"`)
    .join(' ');
  
  // 自己終了タグの場合
  if (selfClosingTags.has(tagNameLower) && children.length === 0) {
    return attrs ? `<${tagNameLower} ${attrs}/>` : `<${tagNameLower}/>`;
  }
  
  // 開始タグ
  const startTag = attrs ? `<${tagNameLower} ${attrs}>` : `<${tagNameLower}>`;
  
  // 子要素の処理
  const childContent = children
    .map(child => {
      if (child.nodeType === 'text') {
        return escapeHTML((child as VTextNode).textContent);
      } else {
        return elementToHTML(child as VElement);
      }
    })
    .join('');
  
  // 終了タグ
  const endTag = `</${tagNameLower}>`;
  
  return `${startTag}${childContent}${endTag}`;
}

/**
 * HTML特殊文字をエスケープする
 * 
 * @param str エスケープする文字列
 * @returns エスケープされた文字列
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ブロック要素のリスト
 */
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'dd', 
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 
  'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'
]);

/**
 * VElementを読みやすい文字列形式に変換する
 * タグを除去しつつ、ブロック要素とインライン要素を考慮して改行を適用
 * すべてのテキストは一番浅いインデントに揃える
 * 連続する改行は1つにまとめる
 * 
 * @param element 変換するVElement
 * @returns 整形された文字列
 */
export function stringify(element: VElement | null): string {
  if (!element) return '';
  
  const { tagName, children } = element;
  const tagNameLower = tagName.toLowerCase();
  const isBlock = BLOCK_ELEMENTS.has(tagNameLower);
  
  // 特殊なタグの処理
  if (tagNameLower === 'br') {
    return '\n';
  }
  
  if (tagNameLower === 'hr') {
    return '\n----------\n';
  }
  
  let result = '';
  
  // ブロック要素の場合は前に改行を挿入
  if (isBlock) {
    result += '\n';
  }
  
  // 子要素の処理
  for (const child of children) {
    if (child.nodeType === 'text') {
      // テキストノードの場合はそのまま追加
      const text = (child as VTextNode).textContent.trim();
      if (text) {
        result += text + ' ';
      }
    } else {
      // 要素ノードの場合は再帰的に処理
      result += stringify(child as VElement);
    }
  }
  
  // 末尾の余分なスペースを削除
  result = result.replace(/ $/, '');
  
  // ブロック要素の場合は後ろに改行を挿入
  if (isBlock) {
    result += '\n';
  }
  
  // 連続する改行を1つにまとめる
  return result.replace(/\n{2,}/g, '\n');
}

/**
 * 文書全体を整形する
 * 連続する改行を1つにまとめ、先頭と末尾の余分な改行を削除
 * 
 * @param text 整形するテキスト
 * @returns 整形されたテキスト
 */
export function formatDocument(text: string): string {
  return text
    .replace(/\n{2,}/g, '\n')  // 連続する改行を1つにまとめる
    .replace(/^\n+/, '')       // 先頭の改行を削除
    .replace(/\n+$/, '')       // 末尾の改行を削除
    .trim();                   // 先頭と末尾の空白を削除
}

/**
 * VElementからテキストコンテンツを抽出する
 * 
 * @param element 対象のVElement
 * @returns テキストコンテンツ
 */
export function extractTextContent(element: VElement | null): string {
  if (!element) return '';
  
  return element.children
    .map(child => {
      if (child.nodeType === 'text') {
        return (child as VTextNode).textContent;
      } else {
        return extractTextContent(child as VElement);
      }
    })
    .join('');
}

/**
 * VElement内のノード数をカウントする
 * 
 * @param element 対象のVElement
 * @returns ノード数
 */
export function countNodes(element: VElement | null): number {
  if (!element) return 0;
  
  // 自分自身を1としてカウント
  let count = 1;
  
  // 子要素を再帰的にカウント
  for (const child of element.children) {
    if (child.nodeType === 'element') {
      count += countNodes(child as VElement);
    } else {
      // テキストノードも1としてカウント
      count += 1;
    }
  }
  
  return count;
}
