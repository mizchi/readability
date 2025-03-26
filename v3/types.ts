/**
 * Readability v3 - Type Definitions
 *
 * Type definitions for DOM-independent implementation
 */

// Basic node type
export type VNodeType = 'element' | 'text';

// Basic node interface
export interface VNode {
  nodeType: VNodeType;
  parent?: VElement;
  // Properties used by the readability algorithm
  readability?: {
    contentScore: number;
  };
}

// Text node
export interface VTextNode extends VNode {
  nodeType: 'text';
  textContent: string;
}

// Element node
export interface VElement extends VNode {
  nodeType: 'element';
  tagName: string;
  attributes: Record<string, string>;
  children: Array<VElement | VTextNode>;
  // Convenient accessors
  id?: string;
  className?: string;
}

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
