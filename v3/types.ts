/**
 * Readability v3 - 型定義
 * 
 * DOM依存のない実装のための型定義
 */

// ノードの基本型
export type VNodeType = 'element' | 'text';

// 基本ノードインターフェース
export interface VNode {
  nodeType: VNodeType;
  parent?: VElement;
  // readabilityアルゴリズムで使用される特性
  readability?: {
    contentScore: number;
  };
}

// テキストノード
export interface VTextNode extends VNode {
  nodeType: 'text';
  textContent: string;
}

// 要素ノード
export interface VElement extends VNode {
  nodeType: 'element';
  tagName: string;
  attributes: Record<string, string>;
  children: Array<VElement | VTextNode>;
  // 便利なアクセサ
  id?: string;
  className?: string;
}

// ドキュメント構造
export interface VDocument {
  documentElement: VElement;
  body: VElement;
  baseURI?: string;
  documentURI?: string;
}

// Readabilityの結果
export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  content: VElement | null;
  textContent: string;
  length: number;
  excerpt: string | null;
  siteName: string | null;
}

// Readabilityのオプション
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
}
