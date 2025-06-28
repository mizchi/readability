/**
 * Readability - Type Definitions
 * Type definitions for DOM-independent implementation
 */

// Import LinkHierarchyAnalysis from hierarchy.ts
import type { LinkHierarchyAnalysis } from "./nav/hierarchy.ts";

// Basic node type
export type VNodeType = "element" | "text";

// Basic node interface
export interface VNodeBase {
  parent?: WeakRef<VElement>;
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
export function isVElement(node: VNode | VDocument | VElement): node is VElement {
  return (
    typeof node === "object" && node !== null && "nodeType" in node && node.nodeType === "element"
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
  originalElement?: WeakRef<VElement>; // 元のDOM要素への参照 (WeakRef)
}

// Ariaツリー全体の構造
export interface AriaTree {
  root: AriaNode;
  nodeCount: number;
}

// リンク情報の型定義
export interface LinkInfo {
  element: VElement;
  score: number; // 必要に応じて重み付けスコアを追加
  text: string;
  href: string | null;
}

// 候補情報の型定義
export interface CandidateInfo {
  element: VElement;
  score: number;
}

export type PageMetadata = {
  title: string;
  lang?: string;
  siteName?: string;
  url: string;
};

// Extracted snapshot result
export interface ExtractedSnapshot {
  // title: string | null;
  // byline: string | null;
  // lang: string | null; // メタデータ: 言語
  // siteName: string | null; // メタデータ: サイト名
  root: VElement | null; // Parsed HTML root element (can be null if parsing fails or content is empty)
  nodeCount: number;
  // pageType: PageType;
  // 構造要素 (pageTypeがARTICLEだがrootがnullの場合などに設定される)
  // header?: VElement | null;
  // footer?: VElement | null;
  // otherSignificantNodes?: VElement[];
  // Ariaツリー (オプションで生成・保持)
  ariaTree?: AriaTree; // generateAriaTree オプションに応じて undefined になる可能性がある
  // 抽出されたリンク情報
  links: LinkInfo[];
  metadata: PageMetadata;
  // メイン候補情報
  mainCandidates?: CandidateInfo[];
}

export type ArticleClassified = {
  pageType: PageType.ARTICLE;
  possibility: number;

  title: string;
  byline: string;
  lang: string;
  siteName: string;
  content: VElement;
  header?: VElement;
  footer?: VElement;
};
export type OtherClassified = {
  pageType: PageType.OTHER;
  possibility: number;
  // compacted aria tree
  ariaTree?: AriaTree; // snapshot.ariaTree が undefined の場合があるためオプショナルに
  links: LinkInfo[];
  mainCandidates: CandidateInfo[];
};

export type Classified = ArticleClassified | OtherClassified;

export type Classifier = (snapshot: ExtractedSnapshot) => Array<Classified>; // sorted by possibility;

// 不要になった ArticleContent, OtherContent, getContentByPageType を削除
// Readability options
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
  parser?: Parser; // Optional custom HTML parser
  // generateAriaTree?: boolean; // Removed, Aria tree is always generated internally now
  forcedPageType?: PageType; // 強制的に設定するページタイプ
  url?: string; // Optional URL for context (e.g., link analysis)
}

// --- Readable Class Interface and Options ---

// Filter options for getAriaTree
export interface AriaTreeFilterOptions {
  includeRoles?: AriaNodeType[];
  excludeRoles?: AriaNodeType[];
  includeNames?: (string | RegExp)[];
  excludeNames?: (string | RegExp)[];
  // Add other filter criteria as needed
}

// Options for getAriaTree method
export interface GetAriaTreeOptions {
  compact?: boolean;
  filter?: AriaTreeFilterOptions;
}

// Interface for the Readable class public API
export interface IReadable {
  readonly snapshot: ExtractedSnapshot;
  toMarkdown(): string;
  getAriaTree(options?: GetAriaTreeOptions): AriaTree | undefined; // Use GetAriaTreeOptions
  serialize(): string;
  inferPageType(): PageType;
  getLinkHierarchy(): LinkHierarchyAnalysis; // Add analyzeLinkHierarchy method
}

// Enum for classifying article types
export const enum PageType {
  ARTICLE = "article", // Represents a standard article page
  OTHER = "other", // Represents any page that is not a standard article (e.g., index, list, error)
}
