/*
 * HTML Parser using htmlparser2 to create a virtual DOM structure
 */

import { Parser } from 'htmlparser2';
import {
  VDocument,
  VElement,
  VTextNode,
  createVElement,
  createVTextNode
} from './vdom';

/**
 * Parse HTML string into a virtual DOM structure
 * 
 * @param html HTML string to parse
 * @param baseURI Optional base URI for resolving relative URLs
 * @return Virtual DOM document
 */
export function parseHTML(html: string, baseURI: string = 'about:blank'): VDocument {
  // ドキュメント構造の初期化
  const document: VDocument = {
    documentElement: createVElement('html'),
    body: createVElement('body'),
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
      // 空白のみのテキストノードも保持する（DOM互換性のため）
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
 * Serialize a virtual DOM element to HTML string
 * 
 * @param element Element to serialize
 * @return HTML string
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
