/**
 * Readability v3 - Type Definitions
 *
 * Type definitions for DOM-independent implementation
 */

// Basic node type
export type VNodeType = "element" | "text";

// Basic node interface
export interface VNodeBase {
  // nodeType: VNodeType;
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

// Readability result
export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  root: VElement | null;
  nodeCount: number;
}

// Readability options
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
}
