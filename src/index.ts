/**
 * Readability v3 - Entry Point
 *
 * DOM-independent content extraction library
 */

// Export only public type definitions
export type {
  ExtractedSnapshot,
  ReadabilityOptions, // Keep original name for now, used by extract
  VDocument,
  VElement,
  VText,
  // PageType, // Removed from type-only export
  // AriaSnapshot関連の型をエクスポート
  AriaNode,
  AriaNodeType,
  AriaTree,
  // リンク階層分析関連の型をエクスポート
  LinkInfo,
} from "./types.ts";
// リンク階層分析関連の型をエクスポート
export type { LinkHierarchyAnalysis } from "./nav/hierarchy.ts";
export { PageType } from "./types.ts"; // Export PageType enum as value

// Export only public functions
export { parseHTML, serializeToHTML } from "./parsers/parser.ts";

export {
  extract,
  extractAriaTree, // extractAriaTree 関数をエクスポート
  findMainCandidates,
  createExtractor,
  classifyPageType, // classifyPageType 関数をエクスポート
} from "./extract/extract.ts";

export { preprocessDocument } from "./extract/preprocess.ts";

export {
  toHTML,
  stringify,
  formatDocument,
  extractTextContent,
  countNodes,
} from "./format/format.ts";

export { toMarkdown } from "./format/markdown.ts";

// AriaSnapshot関連の関数をエクスポート
export { toReadableAriaTree, ariaTreeToString } from "./nav/readableAria.ts";

// リンク階層分析関連の関数をエクスポート
export { analyzeLinkHierarchy } from "./nav/hierarchy.ts";

// ページタイプ分類関連の関数をエクスポート
export { classify } from "./classify/classify.ts";

// Export the readable function and related types from the new module
export { readable, type ReadableOptions } from "./readable.ts";

// Export page structure analysis function and related types
export { analyzePageStructure } from "./detect/index.ts";
export type {
  PageStructure,
  AnalyzeOptions,
  HeaderInfo,
  NavigationInfo,
  NavigationItem,
  NavigationType,
  NavigationLocation,
  NavigationStructure,
  LogoInfo,
  SiteTitleInfo,
} from "./detect/index.ts";

// Export document-specific analysis functions and types
export { analyzeDocumentStructure, extractDocumentContent } from "./detect/document.ts";
export type { DocumentStructure, DocumentContent, SectionInfo } from "./detect/document.ts";
