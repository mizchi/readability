// src/readable.ts

// Import necessary types and functions
import type {
  AriaTree as InternalAriaTree,
  ExtractedSnapshot as InternalExtractedSnapshot,
  VDocument as InternalVDocument,
  ReadabilityOptions as InternalReadabilityOptions,
  VElement as InternalVElement,
  CandidateInfo as InternalCandidateInfo,
  PageMetadata, // Import PageMetadata
  LinkInfo, // Import LinkInfo
  IReadable, // Import IReadable interface
  GetAriaTreeOptions, // Import GetAriaTreeOptions
} from "./types.ts";
import { PageType, isVElement } from "./types.ts"; // Import PageType enum and isVElement guard
import { parseHTML as internalParseHTML } from "./parsers/parser.ts";
import { preprocessDocument as internalPreprocessDocument } from "./extract/preprocess.ts";
import {
  classifyPageType as internalClassifyPageType,
  findMainCandidates as internalFindMainCandidates,
  isProbablyContent as internalIsProbablyContent,
  getArticleTitle as internalGetArticleTitle,
  getArticleLang as internalGetArticleLang,
  getArticleSiteName as internalGetArticleSiteName,
  extractLinks as internalExtractLinks,
} from "./extract/extract.ts";
import { toMarkdown as internalToMarkdown } from "./format/markdown.ts";
import { countNodes as internalCountNodes } from "./format/format.ts";
import { buildAriaTree as internalBuildAriaTree } from "./nav/readableAria.ts";
import {
  serialize as internalSerialize,
  deserialize as internalDeserialize,
} from "./serializer.ts"; // Import serializer functions

/** Options for the Readable class */
export interface ReadableOptions
  extends Omit<InternalReadabilityOptions, "generateAriaTree"> {
  // Omit generateAriaTree
  // pageType?: PageType; // pageType is determined internally or loaded
  baseURI?: string; // Add baseURI to options for context when parsing fragments
  url?: string; // Add url from types.ts
}

// Interface for the loaded snapshot structure within Readable
// This might not be needed if deserialize returns InternalExtractedSnapshot directly
// interface LoadedSnapshot
//   extends Omit<
//     InternalExtractedSnapshot,
//     "mainCandidates" | "links" | "metadata"
//   > {
//   mainCandidates: { score: number; elementId: number }[]; // Use IDs from serialized data
//   links: LinkInfo[]; // Use LinkInfo
//   metadata: PageMetadata; // Use PageMetadata
// }

/**
 * Represents readable content extracted from HTML.
 * Provides methods for accessing different formats and serialization.
 */
export class Readable implements IReadable {
  // Implement IReadable
  public readonly snapshot: InternalExtractedSnapshot;
  public readonly pageType: PageType;
  private readonly options: ReadableOptions;
  // Store the processed document internally if needed for methods like AriaTree regeneration
  // private readonly processedDoc: InternalVDocument; // Consider if storing the doc is necessary/feasible

  /**
   * Private constructor to initialize Readable instance.
   * Use Readable.fromHTML() or Readable.load() to create instances.
   */
  private constructor(
    snapshot: InternalExtractedSnapshot,
    pageType: PageType,
    options: ReadableOptions = {}
    // processedDoc?: InternalVDocument // Pass the processed doc optionally
  ) {
    this.snapshot = snapshot;
    this.pageType = pageType;
    this.options = options;
    // if (processedDoc) this.processedDoc = processedDoc; // Store the doc if provided

    // Removed AriaTree regeneration check based on options.generateAriaTree
    // AriaTree is now always generated during fromHTML if possible.
    // Regeneration on load might still be complex.
  }

  /**
   * Creates a Readable instance from an HTML string.
   * @param content HTML content string
   * @param options Options for extraction and classification
   */
  public static fromHTML(
    content: string,
    options: ReadableOptions = {}
  ): Readable {
    // 1. Parse and ensure we have a VDocument
    const parsedResult = internalParseHTML(content);
    let doc: InternalVDocument; // Ensure doc is always VDocument type

    if (isVElement(parsedResult)) {
      // If parser returns just a root element (fragment)
      console.warn(
        "Parser returned a VElement fragment. Wrapping it in a VDocument."
      );
      // Create a VDocument containing the fragment
      doc = {
        documentElement: parsedResult, // Treat fragment root as documentElement
        body: parsedResult, // And as body
        documentURI: options.baseURI || "", // Use baseURI from options if available
      };
    } else {
      // If parser returns VDocument
      doc = parsedResult;
    }

    // 2. Preprocess the document (always pass VDocument)
    internalPreprocessDocument(doc);

    // 3. Find main candidates (always pass VDocument)
    const nbTopCandidates = options.nbTopCandidates ?? undefined;
    const candidates = internalFindMainCandidates(doc, nbTopCandidates);

    // 4. Determine pageType (always pass VDocument)
    const charThreshold = options.charThreshold ?? undefined;
    const determinedPageType =
      options.forcedPageType ?? // Use forced type first
      internalClassifyPageType(doc, candidates, charThreshold);

    // 5. Extract content based on determined pageType
    let rootElement: InternalVElement | null = null;
    if (determinedPageType === PageType.ARTICLE && candidates.length > 0) {
      const topCandidateElement = candidates[0];
      // isProbablyContent operates on VElement, which is fine
      if (internalIsProbablyContent(topCandidateElement)) {
        rootElement = topCandidateElement;
      }
    }
    // If not article or top candidate is not content, root remains null

    // 6. Build ExtractedSnapshot (pass VDocument for metadata/links)
    const metadata: PageMetadata = {
      title: internalGetArticleTitle(doc) || "",
      lang: internalGetArticleLang(doc) || undefined,
      siteName: internalGetArticleSiteName(doc) || undefined,
      url: doc.documentURI || options.url || "", // Use doc URI or options.url
    };
    const links = internalExtractLinks(doc);
    // countNodes operates on VElement or null, which is fine
    const nodeCount = rootElement ? internalCountNodes(rootElement) : 0;
    const mainCandidatesInfo: InternalCandidateInfo[] = candidates.map(
      (el) => ({
        element: el,
        score: el.readability?.contentScore || 0,
      })
    );

    // 7. Build AriaTree (always build, pass VDocument)
    const ariaTree = internalBuildAriaTree(doc); // Build from the preprocessed doc

    const snapshot: InternalExtractedSnapshot = {
      root: rootElement,
      nodeCount: nodeCount,
      mainCandidates: mainCandidatesInfo,
      links: links,
      ariaTree: ariaTree,
      metadata: metadata,
    };

    // Pass the processed doc to the constructor if needed later
    return new Readable(snapshot, determinedPageType, options /*, doc */);
  }

  /**
   * Loads a Readable instance from a serialized JSON string.
   * @param jsonString The JSON string created by the serialize() method.
   * @param options Options to apply on load (e.g., regenerating AriaTree).
   */
  public static load(
    jsonString: string,
    options: ReadableOptions = {}
  ): Readable {
    // Deserialize returns InternalExtractedSnapshot
    // Deserialize returns both snapshot and pageType
    const { snapshot, pageType: loadedPageType } =
      internalDeserialize(jsonString);

    // Use the loaded pageType directly
    // const loadedPageType =
    //   snapshot.root && (snapshot.mainCandidates?.length ?? 0) > 0
    //     ? PageType.ARTICLE
    //     : PageType.OTHER;

    // We don't have the original VDocument here, so pass undefined or handle differently
    return new Readable(snapshot, loadedPageType, options /*, undefined */);
  }

  /**
   * Converts the extracted content (root element) to Markdown.
   * Returns an empty string if no root element exists.
   */
  public toMarkdown(): string {
    // internalToMarkdown operates on VElement or null, which is fine
    return internalToMarkdown(this.snapshot.root);
  }

  /**
   * Returns the generated ARIA tree, if available.
   * @param options Options for retrieving the tree, e.g., { compact: boolean }. Default is compact: true.
   */
  public getAriaTree(
    options?: GetAriaTreeOptions
  ): InternalAriaTree | undefined {
    // Default to compact: true if options or compact property is undefined
    const compact = options?.compact ?? true;
    const filter = options?.filter;

    // TODO: Implement logic to return compact or non-compact tree based on the compact flag.
    // TODO: Implement filtering logic based on the filter options.
    // Currently, it always returns the stored tree regardless of options.

    if (!compact) {
      console.warn(
        "Non-compact ARIA tree retrieval is not yet implemented. Returning the default (potentially compact) tree."
      );
    }
    if (filter) {
      console.warn(
        "ARIA tree filtering is not yet implemented. Returning the unfiltered tree."
      );
      // Placeholder for filtering logic:
      // let treeToReturn = this.snapshot.ariaTree;
      // if (treeToReturn && filter) {
      //   treeToReturn = applyAriaTreeFilter(treeToReturn, filter); // Need applyAriaTreeFilter function
      // }
      // return treeToReturn;
    }

    return this.snapshot.ariaTree;
  }

  /**
   * Serializes the internal snapshot state to a JSON string.
   */
  public serialize(): string {
    // Pass both snapshot and pageType to internalSerialize
    return internalSerialize(this.snapshot, this.pageType);
  }

  /**
   * Returns the determined page type (ARTICLE or OTHER).
   */
  public inferPageType(): PageType {
    return this.pageType;
  }
}

/**
 * Public function to create a Readable instance from HTML content.
 * This wraps the Readable.fromHTML static method for a simpler API.
 * @param content HTML content string
 * @param options Options for extraction and classification
 * @returns A Readable instance
 */
export function readable(
  content: string,
  options: ReadableOptions = {}
): Readable {
  return Readable.fromHTML(content, options);
}

// Remove the old readable function export comment if it exists
// export function readable(...) { ... }
