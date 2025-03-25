
export interface ReadabilityOptions {
  debug?: boolean;
  maxElemsToParse?: number;
  nbTopCandidates?: number;
  charThreshold?: number;
  classesToPreserve?: string[];
  keepClasses?: boolean;
  serializer?: (element: VElement) => string;
  disableJSONLD?: boolean;
  allowedVideoRegex?: RegExp;
  linkDensityModifier?: number;
}

export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  dir: string | null;
  lang: string | null;
  content: string;
  textContent: string;
  length: number;
  excerpt: string | null;
  siteName: string | null;
  publishedTime: string | null;
}

export interface ReadabilityNodeScore {
  contentScore: number;
}

// Extend Element to include readability property
declare global {
  interface Element {
    readability?: ReadabilityNodeScore;
    _readabilityDataTable?: boolean;
    _isLiveNodeList?: boolean;
  }
}

export interface ReadabilityAttempt {
  articleContent: VElement;
  textLength: number;
}

export interface ReadabilityMetadata {
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  datePublished?: string;
  publishedTime?: string;
  author?: string;
}


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
  _readabilityDataTable?: boolean;
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
