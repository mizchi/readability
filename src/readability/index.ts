/*
 * Main entry point for the DOM-independent readability implementation
 */

import { type VDocument, type VElement } from '../types.ts';
import { ReadabilityOptions, ReadabilityArticle, ReadabilityAttempt, ReadabilityMetadata } from '../types';
import { 
  FLAG_STRIP_UNLIKELYS,
  FLAG_WEIGHT_CLASSES,
  FLAG_CLEAN_CONDITIONALLY,
  DEFAULT_MAX_ELEMS_TO_PARSE,
  DEFAULT_N_TOP_CANDIDATES,
  DEFAULT_CHAR_THRESHOLD,
  CLASSES_TO_PRESERVE
} from '../constants';

import { prepDocument } from './preprocess';
import { postProcessContent } from './postprocess';
import { grabArticle } from './grabber';
import { getArticleTitle, getJSONLD, getArticleMetadata } from './metadata';

/**
 * DOM-independent implementation of Readability
 */
export class Readability {
  private _doc: VDocument;
  private _articleTitle: string | null;
  private _articleByline: string | null;
  private _articleDir: string | null;
  private _articleSiteName: string | null;
  private _attempts: ReadabilityAttempt[];
  private _metadata: ReadabilityMetadata;
  private _debug: boolean;
  private _maxElemsToParse: number;
  private _nbTopCandidates: number;
  private _charThreshold: number;
  private _classesToPreserve: string[];
  private _keepClasses: boolean;
  private _serializer: (el: VElement) => string;
  private _disableJSONLD: boolean;
  private _linkDensityModifier: number;
  private _flags: number;
  private log: (...args: any[]) => void;

  constructor(doc: VDocument, options: ReadabilityOptions = {}) {
    this._doc = doc;
    this._articleTitle = null;
    this._articleByline = null;
    this._articleDir = null;
    this._articleSiteName = null;
    this._attempts = [];
    this._metadata = {};

    // Configurable options
    this._debug = !!options.debug;
    this._maxElemsToParse = options.maxElemsToParse || DEFAULT_MAX_ELEMS_TO_PARSE;
    this._nbTopCandidates = options.nbTopCandidates || DEFAULT_N_TOP_CANDIDATES;
    this._charThreshold = options.charThreshold || DEFAULT_CHAR_THRESHOLD;
    this._classesToPreserve = CLASSES_TO_PRESERVE.concat(options.classesToPreserve || []);
    this._keepClasses = !!options.keepClasses;
    this._serializer = options.serializer || ((el: VElement) => JSON.stringify(el));
    this._disableJSONLD = !!options.disableJSONLD;
    this._linkDensityModifier = options.linkDensityModifier || 0;

    // Start with all flags set
    this._flags = FLAG_STRIP_UNLIKELYS | FLAG_WEIGHT_CLASSES | FLAG_CLEAN_CONDITIONALLY;

    // Control whether log messages are sent to the console
    if (this._debug) {
      this.log = function(...args: any[]) {
        console.log("Reader: (Readability)", ...args);
      };
    } else {
      this.log = function() {};
    }
  }

  /**
   * Runs readability.
   *
   * Workflow:
   *  1. Prep the document by removing script tags, css, etc.
   *  2. Build readability's DOM tree.
   *  3. Grab the article content from the current dom tree.
   *  4. Replace the current DOM tree with the new one.
   *  5. Read peacefully.
   *
   * @return ReadabilityArticle or null
   **/
  parse(): ReadabilityArticle | null {
    // Avoid parsing too large documents, as per configuration option
    if (this._maxElemsToParse > 0) {
      const numElements = this._countElements(this._doc.documentElement);
      if (numElements > this._maxElemsToParse) {
        throw new Error(
          "Aborting parsing document; " + numElements + " elements found"
        );
      }
    }

    // Extract JSON-LD metadata before removing scripts
    const jsonLd = this._disableJSONLD ? {} : getJSONLD(this._doc);

    // Prepare the document for readability to scrape it
    prepDocument(this._doc);

    // Get metadata
    const metadata = getArticleMetadata(this._doc, jsonLd);
    this._metadata = metadata;
    this._articleTitle = metadata.title ?? null;

    // Extract the content
    const articleContent = grabArticle(this._doc, {
      flags: this._flags,
      charThreshold: this._charThreshold,
      nbTopCandidates: this._nbTopCandidates,
      articleTitle: this._articleTitle || '',
      articleByline: this._articleByline,
      attempts: this._attempts,
      linkDensityModifier: this._linkDensityModifier
    });

    if (!articleContent) {
      return null;
    }

    // Post-process the content
    postProcessContent(articleContent, {
      keepClasses: this._keepClasses,
      classesToPreserve: this._classesToPreserve,
      baseURI: this._doc.baseURI,
      documentURI: this._doc.documentURI
    });

    // If we haven't found an excerpt in the article's metadata, use the article's
    // first paragraph as the excerpt. This is used for displaying a preview of
    // the article's content.
    if (!metadata.excerpt) {
      const paragraphs = articleContent.children.filter(
        child => child.nodeType === 'element' && child.tagName === 'P'
      );
      if (paragraphs.length > 0) {
        const firstParagraph = paragraphs[0] as VElement;
        const textContent = this._getTextContent(firstParagraph);
        metadata.excerpt = textContent.trim();
      }
    }

    const textContent = this._getTextContent(articleContent);
    
    return {
      title: this._articleTitle,
      byline: metadata.byline || this._articleByline,
      dir: this._articleDir,
      lang: null, // We don't have language detection in this implementation
      content: this._serializer(articleContent),
      textContent,
      length: textContent.length,
      excerpt: metadata.excerpt ?? null,
      siteName: metadata.siteName || this._articleSiteName,
      publishedTime: metadata.publishedTime ?? null,
    };
  }

  /**
   * Get the combined text content of an element and its children
   */
  private _getTextContent(element: VElement): string {
    let text = '';
    
    for (const child of element.children) {
      if (child.nodeType === 'text') {
        text += child.textContent;
      } else if (child.nodeType === 'element') {
        text += this._getTextContent(child);
      }
    }
    
    return text;
  }

  /**
   * Count the number of elements in a document
   */
  private _countElements(element: VElement): number {
    let count = 1; // Count the element itself
    
    for (const child of element.children) {
      if (child.nodeType === 'element') {
        count += this._countElements(child);
      }
    }
    
    return count;
  }

  /**
   * Removes a flag
   */
  _removeFlag(flag: number): void {
    this._flags = this._flags & ~flag;
  }

  /**
   * Check if flag is active
   */
  _flagIsActive(flag: number): boolean {
    return (this._flags & flag) > 0;
  }
}

// Export all the individual functions for direct use
// export * from './preprocess.ts';
// export * from './postprocess.ts';
// export * from './grabber.ts';
// export * from './metadata.ts';
