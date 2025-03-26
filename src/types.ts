/**
 * Readability - Type Definitions
 * Type definitions for DOM-independent implementation
 */

// Basic node type
export type VNodeType = "element" | "text";

// Basic node interface
export interface VNodeBase {
  parent?: VElement;
  readability?: {
    contentScore: number;
  };
}

// Text node
export interface VText extends VNodeBase {
  nodeType: "text";
  textContent: string;
}

// Element node
export interface VElement extends VNodeBase {
  nodeType: "element";
  tagName: string;
  attributes: Record<string, string>;
  children: Array<VElement | VText>;
  // Convenient accessors
  id?: string;
  className?: string;
}

export type VNode = VElement | VText;

// Document structure
export interface VDocument {
  documentElement: VElement;
  body: VElement;
  baseURI?: string;
  documentURI?: string;
}

// Parser function type
export type Parser = (html: string) => VDocument | VElement; // Can return a full document or just a root element (fragment)

// Type guard to check if a node is a VElement
export function isVElement(
  node: VNode | VDocument | VElement
): node is VElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "nodeType" in node &&
    node.nodeType === "element"
  );
}

// AriaSnapshot関連の型定義
// Playwrightのaria snapshotを参考にした構造

// Ariaノードの種類
export type AriaNodeType =
  | "banner"
  | "complementary"
  | "contentinfo"
  | "form"
  | "main"
  | "navigation"
  | "region"
  | "search"
  | "article"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "dialog"
  | "figure"
  | "grid"
  | "gridcell"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listitem"
  | "menuitem"
  | "option"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "textbox"
  | "text"
  | "generic"; // その他のロール

// Ariaノードの基本構造
export interface AriaNode {
  type: AriaNodeType;
  name?: string; // アクセシブルな名前
  role?: string; // 明示的なARIAロール
  level?: number; // 見出しレベルなど
  checked?: boolean; // チェックボックスの状態
  selected?: boolean; // 選択状態
  expanded?: boolean; // 展開状態
  disabled?: boolean; // 無効状態
  required?: boolean; // 必須項目
  valuemin?: number; // 最小値
  valuemax?: number; // 最大値
  valuetext?: string; // 値のテキスト表現
  children?: AriaNode[]; // 子ノード
  originalElement?: VElement; // 元のDOM要素への参照
}

// Ariaツリー全体の構造
export interface AriaTree {
  root: AriaNode;
  nodeCount: number;
}

// Readability result
export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  root: VElement | null; // メインコンテンツのルート要素 (閾値以上の場合)
  nodeCount: number;
  pageType: PageType;
  // 構造要素 (pageTypeがARTICLEだがrootがnullの場合などに設定される)
  header?: VElement | null;
  footer?: VElement | null;
  otherSignificantNodes?: VElement[];
  // 本文抽出に失敗した場合のフォールバックとしてのAriaツリー
  ariaTree?: AriaTree;
}

// Readability options
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
  parser?: Parser; // Optional custom HTML parser
  generateAriaTree?: boolean; // aria treeを生成するかどうか
}

// Enum for classifying article types
export enum PageType {
  ARTICLE = "article", // Represents a standard article page
  OTHER = "other", // Represents any page that is not a standard article (e.g., index, list, error)
  // Future types like INDEX, LIST, ERROR can be added here
}
