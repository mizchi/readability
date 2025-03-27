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
export { parseHTML, serializeToHTML } from "./parsers/parser.ts";

export {
  extract,
  extractContent,
  extractAriaTree, // extractAriaTree 関数をエクスポート
  findMainCandidates,
  createExtractor,
  classifyPageType, // classifyPageType 関数をエクスポート
} from "./main/extract.ts";

export { preprocessDocument } from "./main/preprocess.ts";

export {
  toHTML,
  stringify,
  formatDocument,
  extractTextContent,
  countNodes,
} from "./format/format.ts";

export { toMarkdown } from "./format/markdown.ts";

// AriaSnapshot関連の関数をエクスポート
export { buildAriaTree, ariaTreeToString } from "./nav/aria.ts";

// ページタイプ分類関連の関数をエクスポート
export { classify } from "./classify/classify.ts";
