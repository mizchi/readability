/**
 * Readability v3 - HTMLパーサー
 * 
 * HTMLを解析して仮想DOM構造を作成する
 */

import { Parser } from 'htmlparser2';
import { createElement, createTextNode } from './dom.ts';
import type { VDocument, VElement, VTextNode } from './types.ts';

/**
 * HTMLを解析して仮想DOM構造を作成する
 * 
 * @param html HTML文字列
 * @param baseURI ベースURI（相対URLの解決に使用）
 * @returns 仮想DOMドキュメント
 */
export function parseHTML(html: string, baseURI: string = 'about:blank'): VDocument {
  // ドキュメント構造の初期化
  const document: VDocument = {
    documentElement: createElement('html'),
    body: createElement('body'),
    baseURI,
    documentURI: baseURI
  };
  
  // ドキュメント構造のセットアップ
  document.documentElement.children = [document.body];
  document.body.parent = document.documentElement;
  
  // 現在処理中の要素
  let currentElement: VElement = document.body;
  
  const parser = new Parser({
    onopentag(name, attributes) {
      const element: VElement = {
        nodeType: 'element',
        tagName: name.toUpperCase(),
        attributes: {},
        children: [],
        parent: currentElement
      };
      
      // 属性の設定
      for (const [key, value] of Object.entries(attributes)) {
        element.attributes[key] = value;
      }
      
      // 特別なプロパティの設定
      if (attributes.id) element.id = attributes.id;
      if (attributes.class) element.className = attributes.class;
      
      // 親要素に追加
      currentElement.children.push(element);
      
      // 現在の要素を更新
      currentElement = element;
    },
    ontext(text) {
      // テキストノードを作成
      const textNode: VTextNode = {
        nodeType: 'text',
        textContent: text,
        parent: currentElement
      };
      
      // 親要素に追加
      currentElement.children.push(textNode);
    },
    onclosetag() {
      // 親要素に戻る
      if (currentElement.parent) {
        currentElement = currentElement.parent;
      }
    }
  });
  
  parser.write(html);
  parser.end();
  
  return document;
}

/**
 * 仮想DOM要素をHTML文字列にシリアライズする
 * 
 * @param element シリアライズする要素
 * @returns HTML文字列
 */
export function serializeToHTML(element: VElement | VTextNode): string {
  if (element.nodeType === 'text') {
    return element.textContent;
  }
  
  const tagName = element.tagName.toLowerCase();
  
  // 自己終了タグのリスト
  const selfClosingTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);
  
  // 属性文字列の作成
  const attributes = Object.entries(element.attributes)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '&quot;')}"`)
    .join(' ');
  
  const attributeString = attributes ? ` ${attributes}` : '';
  
  // 自己終了タグの場合
  if (selfClosingTags.has(tagName) && element.children.length === 0) {
    return `<${tagName}${attributeString}/>`;
  }
  
  // 子要素を含むタグの場合
  const childrenHTML = element.children
    .map(child => serializeToHTML(child))
    .join('');
  
  return `<${tagName}${attributeString}>${childrenHTML}</${tagName}>`;
}
