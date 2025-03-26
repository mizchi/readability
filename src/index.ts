/**
 * Readability v3 - Entry Point
 *
 * DOM-independent content extraction library
 */

// Export only public type definitions
export type {
  ReadabilityArticle,
  ReadabilityOptions,
  VDocument,
  VElement,
  VText as VTextNode,
  PageType as ArticleType, // Export ArticleType enum
  // AriaSnapshot関連の型をエクスポート
  AriaNode,
  AriaNodeType,
  AriaTree,
} from "./types.ts";

// Export only public functions
export { parseHTML, serializeToHTML } from "./parser.ts";

export {
  extract,
  extractContent,
  findMainCandidates,
  createExtractor,
  classifyPageType, // classifyPageType 関数をエクスポート
} from "./core.ts";

export { preprocessDocument } from "./preprocess.ts";

export {
  toHTML,
  stringify,
  formatDocument,
  extractTextContent,
  countNodes,
} from "./format.ts";

export { toMarkdown } from "./markdown.ts";

// AriaSnapshot関連の関数をエクスポート
export { buildAriaTree, ariaTreeToString } from "./aria.ts";
