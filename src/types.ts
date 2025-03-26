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
}

// Readability options
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
  parser?: Parser; // Optional custom HTML parser
}

// Enum for classifying article types
export enum PageType {
  ARTICLE = "article", // Represents a standard article page
  OTHER = "other", // Represents any page that is not a standard article (e.g., index, list, error)
  // Future types like INDEX, LIST, ERROR can be added here
}
