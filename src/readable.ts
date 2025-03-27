// src/readable.ts

// Import necessary types and functions from other modules within src/
import type {
  // PageType, // Removed from type-only import
  AriaTree as InternalAriaTree,
  ExtractedSnapshot as InternalExtractedSnapshot,
  VDocument as InternalVDocument,
  ReadabilityOptions as InternalReadabilityOptions,
  VElement as InternalVElement, // Keep VElement type import
  CandidateInfo as InternalCandidateInfo, // Keep CandidateInfo type import
} from "./types.ts";
import { PageType } from "./types.ts"; // Import PageType enum as value
import { parseHTML as internalParseHTML } from "./parsers/parser.ts";
import { preprocessDocument as internalPreprocessDocument } from "./main/preprocess.ts";
import {
  classifyPageType as internalClassifyPageType,
  findMainCandidates as internalFindMainCandidates,
  isProbablyContent as internalIsProbablyContent,
  getArticleTitle as internalGetArticleTitle,
  getArticleLang as internalGetArticleLang,
  getArticleSiteName as internalGetArticleSiteName,
  extractLinks as internalExtractLinks,
} from "./main/extract.ts";
import { toMarkdown as internalToMarkdown } from "./format/markdown.ts";
import { countNodes as internalCountNodes } from "./format/format.ts";
import { buildAriaTree as internalBuildAriaTree } from "./nav/readableAria.ts";

/** Options for the readable function */
export interface ReadableOptions extends InternalReadabilityOptions {
  pageType?: PageType; // Use PageType directly
}

/** Result of the readable function */
export interface ReadableResult {
  snapshot: InternalExtractedSnapshot;
  markdown: string;
  ariaTree?: InternalAriaTree; // Make ariaTree optional
  pageType: PageType; // Use PageType directly
}

/**
 * Extracts content, classifies page type, converts to Markdown, and builds ARIA tree.
 * @param content HTML content string
 * @param options Options for extraction and classification
 */
export function readable(
  content: string,
  options: ReadableOptions = {}
): ReadableResult {
  // 1. Parse and preprocess the document
  const doc: InternalVDocument = internalParseHTML(content);
  internalPreprocessDocument(doc);

  // 2. Find main candidates
  const nbTopCandidates = options.nbTopCandidates ?? undefined; // Use undefined for default in findMainCandidates
  const candidates = internalFindMainCandidates(doc, nbTopCandidates);

  // 3. Determine pageType
  const charThreshold = options.charThreshold ?? undefined; // Use undefined for default in classifyPageType
  const determinedPageType =
    options.pageType ??
    internalClassifyPageType(doc, candidates, charThreshold);

  // 4. Extract content based on determined pageType
  let rootElement: InternalVElement | null = null;
  if (
    determinedPageType === PageType.ARTICLE && // Use PageType directly
    candidates.length > 0
  ) {
    const topCandidateElement = candidates[0];
    if (internalIsProbablyContent(topCandidateElement)) {
      rootElement = topCandidateElement;
    }
  }
  // If not article or top candidate is not content, root remains null

  // 5. Build ExtractedSnapshot manually (simplified version)
  const metadata = {
    title: internalGetArticleTitle(doc) || "",
    lang: internalGetArticleLang(doc) || undefined,
    siteName: internalGetArticleSiteName(doc) || undefined,
    url: doc.documentURI || "",
  };
  const links = internalExtractLinks(doc);
  const nodeCount = rootElement ? internalCountNodes(rootElement) : 0;
  const mainCandidatesInfo: InternalCandidateInfo[] = candidates.map((el) => ({
    element: el,
    score: el.readability?.contentScore || 0,
  }));

  // 6. Build AriaTree
  const ariaTree = internalBuildAriaTree(doc); // Build from the preprocessed doc

  const snapshot: InternalExtractedSnapshot = {
    root: rootElement,
    nodeCount: nodeCount,
    mainCandidates: mainCandidatesInfo,
    links: links,
    ariaTree: ariaTree, // Use the generated AriaTree
    metadata: metadata,
  };

  // 7. Convert extracted content (rootElement) to Markdown
  const markdown = internalToMarkdown(snapshot.root);

  // 8. Return the combined result
  return {
    snapshot,
    markdown,
    ariaTree: snapshot.ariaTree, // Use the AriaTree from the snapshot (now optional)
    pageType: determinedPageType,
  };
}
