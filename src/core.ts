/**
 * Readability v3 - Core Implementation
 *
 * Core implementation of the content extraction algorithm
 */

import {
  type VDocument, // Keep type imports for interfaces/types
  type VElement,
  type ReadabilityArticle,
  type ReadabilityOptions,
  type Parser,
  PageType, // Import ArticleType as a value
} from "./types.ts";
import { isVElement } from "./types.ts"; // Import isVElement as a value
import {
  getInnerText,
  getLinkDensity,
  getTextDensity,
  getElementsByTagName,
  isProbablyVisible,
  getNodeAncestors,
  createElement, // Import createElement
} from "./dom.ts";
import {
  REGEXPS,
  DEFAULT_TAGS_TO_SCORE,
  DEFAULT_N_TOP_CANDIDATES,
  DEFAULT_CHAR_THRESHOLD,
} from "./constants.ts";
import { parseHTML, serializeToHTML } from "./parser.ts";
import { countNodes } from "./format.ts";
import { preprocessDocument } from "./preprocess.ts";

/**
 * Initialize score for an element
 */
function initializeNode(node: VElement): void {
  node.readability = { contentScore: 0 };

  // Initial score based on tag name (now lowercase)
  switch (node.tagName) {
    case "div":
      node.readability.contentScore += 5;
      break;
    case "pre":
    case "td":
    case "blockquote":
      node.readability.contentScore += 3;
      break;
    case "address":
    case "ol":
    case "ul":
    case "dl":
    case "dd":
    case "dt":
    case "li":
    case "form":
      node.readability.contentScore -= 3;
      break;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "th":
      node.readability.contentScore -= 5;
      break;
  }

  // Score adjustment based on class name and ID
  node.readability.contentScore += getClassWeight(node);
}

/**
 * Adjust score based on class name and ID
 */
function getClassWeight(node: VElement): number {
  let weight = 0;

  // Check class name
  if (node.className) {
    if (REGEXPS.negative.test(node.className)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.className)) {
      weight += 25;
    }
  }

  // Check ID
  if (node.id) {
    if (REGEXPS.negative.test(node.id)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.id)) {
      weight += 25;
    }
  }

  return weight;
}

/**
 * Detect nodes that are likely to be the main content candidates, sorted by score.
 * Returns the top N candidates.
 */
export function findMainCandidates(
  doc: VDocument,
  nbTopCandidates: number = DEFAULT_N_TOP_CANDIDATES
): VElement[] {
  // 1. First, look for semantic tags (simple method) (now lowercase)
  const semanticTags = ["article", "main"];
  for (const tag of semanticTags) {
    const elements = getElementsByTagName(doc.documentElement, tag);
    if (elements.length === 1) {
      // If a single semantic tag is found, return it as the only candidate
      return [elements[0]];
    }
  }

  // 2. Scoring-based detection
  const body = doc.body;
  const candidates: VElement[] = [];
  const elementsToScore: VElement[] = [];

  // Collect elements to score
  DEFAULT_TAGS_TO_SCORE.forEach((tag) => {
    const elements = getElementsByTagName(body, tag);
    elementsToScore.push(...elements);
  });

  // Score each element
  for (const elementToScore of elementsToScore) {
    // Ignore elements with less than 25 characters
    const innerText = getInnerText(elementToScore);
    if (innerText.length < 25) continue;

    // Get ancestor elements (up to 3 levels)
    const ancestors = getNodeAncestors(elementToScore, 3);
    if (ancestors.length === 0) continue;

    // Calculate base score
    let contentScore = 1; // Base points
    contentScore += innerText.split(REGEXPS.commas).length; // Number of commas
    contentScore += Math.min(Math.floor(innerText.length / 100), 3); // Text length (max 3 points)

    // Add score to ancestor elements
    for (let level = 0; level < ancestors.length; level++) {
      const ancestor = ancestors[level];

      if (!ancestor.readability) {
        initializeNode(ancestor);
        candidates.push(ancestor);
      }

      // Decrease score for deeper levels
      const scoreDivider = level === 0 ? 1 : level === 1 ? 2 : level * 3;
      if (ancestor.readability) {
        ancestor.readability.contentScore += contentScore / scoreDivider;
      }
    }
  }

  // Score and select candidates
  const scoredCandidates: { element: VElement; score: number }[] = [];

  for (const candidate of candidates) {
    // Adjust score based on link density
    if (candidate.readability) {
      const linkDensity = getLinkDensity(candidate);
      candidate.readability.contentScore *= 1 - linkDensity;

      // Also consider text density
      // Elements with high text density are more likely to contain more text content
      const textDensity = getTextDensity(candidate);
      if (textDensity > 0) {
        // Slightly increase the score for higher text density (up to 10%)
        candidate.readability.contentScore *=
          1 + Math.min(textDensity / 10, 0.1);
      }

      // Check parent node score - the parent might be a better candidate
      let currentCandidate = candidate;
      let parentOfCandidate = currentCandidate.parent;
      while (parentOfCandidate && parentOfCandidate.tagName !== "BODY") {
        if (
          parentOfCandidate.readability &&
          currentCandidate.readability &&
          parentOfCandidate.readability.contentScore >
            currentCandidate.readability.contentScore
        ) {
          currentCandidate = parentOfCandidate;
        }
        parentOfCandidate = parentOfCandidate.parent;
      }

      // Avoid adding duplicates if parent check resulted in the same element
      // Also ensure readability property exists before accessing contentScore
      if (
        currentCandidate.readability &&
        !scoredCandidates.some((sc) => sc.element === currentCandidate)
      ) {
        scoredCandidates.push({
          element: currentCandidate,
          score: currentCandidate.readability.contentScore,
        });
      }
    }
  }

  // Sort candidates by score in descending order
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Return top N candidates
  const topCandidates = scoredCandidates
    .slice(0, nbTopCandidates)
    .map((c) => c.element);

  // Return body if no candidate is found and body exists
  if (topCandidates.length === 0 && doc.body) {
    return [doc.body];
  }

  return topCandidates;
}

/**
 * Determine content probability (simplified version similar to isProbablyReaderable)
 */
export function isProbablyContent(element: VElement): boolean {
  // Visibility check
  if (!isProbablyVisible(element)) {
    return false;
  }

  // Check class name and ID
  const matchString = (element.className || "") + " " + (element.id || "");
  if (
    REGEXPS.unlikelyCandidates.test(matchString) &&
    !REGEXPS.okMaybeItsACandidate.test(matchString)
  ) {
    return false;
  }

  // Check text length
  const textLength = getInnerText(element).length;
  if (textLength < 140) {
    return false;
  }

  // Check link density
  const linkDensity = getLinkDensity(element);
  if (linkDensity > 0.5) {
    return false;
  }

  // Check text density
  // If text density is extremely low, it's unlikely to be the main content
  const textDensity = getTextDensity(element);
  if (textDensity < 0.1) {
    return false;
  }

  return true;
}

/**
 * Get the article title
 */
function getArticleTitle(doc: VDocument): string | null {
  // 1. Get from <title> tag (lowercase)
  const titleElements = getElementsByTagName(doc.documentElement, "title");
  if (titleElements.length > 0) {
    return getInnerText(titleElements[0]);
  }

  // 2. Get from <h1> tag (lowercase)
  const h1Elements = getElementsByTagName(doc.body, "h1");
  if (h1Elements.length === 1) {
    return getInnerText(h1Elements[0]);
  }

  // 3. Get from the first heading (lowercase)
  const headings = [
    ...getElementsByTagName(doc.body, "h1"),
    ...getElementsByTagName(doc.body, "h2"),
  ];

  if (headings.length > 0) {
    return getInnerText(headings[0]);
  }

  return null;
}

/**
 * Get the article byline (author information)
 */
function getArticleByline(doc: VDocument): string | null {
  // Get author information from meta tags (lowercase)
  const metaTags = getElementsByTagName(doc.documentElement, "meta");
  for (const meta of metaTags) {
    const name = meta.attributes.name?.toLowerCase();
    const property = meta.attributes.property?.toLowerCase();
    const content = meta.attributes.content;

    if (!content) continue;

    if (
      name === "author" ||
      property === "author" ||
      property === "og:author" ||
      property === "article:author"
    ) {
      return content;
    }
  }

  // Get from elements with rel="author" attribute (lowercase 'a')
  const relAuthors = getElementsByTagName(doc.body, "a");
  for (const author of relAuthors) {
    if (author.attributes.rel === "author") {
      const text = getInnerText(author);
      if (text) return text;
    }
  }

  return null;
}

/**
 * Get the article excerpt
 */
function getArticleExcerpt(
  doc: VDocument,
  content: VElement | null
): string | null {
  // Get excerpt from meta tags (lowercase)
  const metaTags = getElementsByTagName(doc.documentElement, "meta");
  for (const meta of metaTags) {
    const name = meta.attributes.name?.toLowerCase();
    const property = meta.attributes.property?.toLowerCase();
    const contentAttr = meta.attributes.content; // Renamed to avoid conflict

    if (!contentAttr) continue;

    if (name === "description" || property === "og:description") {
      return contentAttr;
    }
  }

  // Get excerpt from the first paragraph of the content (lowercase 'p')
  if (content) {
    const paragraphs = getElementsByTagName(content, "p");
    if (paragraphs.length > 0) {
      return getInnerText(paragraphs[0]);
    }
  }

  return null;
}

/**
 * Get the site name
 */
function getSiteName(doc: VDocument): string | null {
  // Get site name from meta tags (lowercase)
  const metaTags = getElementsByTagName(doc.documentElement, "meta");
  for (const meta of metaTags) {
    const property = meta.attributes.property?.toLowerCase();
    const content = meta.attributes.content;

    if (!content) continue;

    if (property === "og:site_name") {
      return content;
    }
  }

  return null;
}

/**
 * Main function for content extraction
 */
export function extractContent(
  doc: VDocument,
  options: ReadabilityOptions = {}
): ReadabilityArticle {
  const charThreshold = options.charThreshold || DEFAULT_CHAR_THRESHOLD;
  const nbTopCandidates = options.nbTopCandidates || DEFAULT_N_TOP_CANDIDATES;

  // Find content candidates
  const candidates = findMainCandidates(doc, nbTopCandidates);
  const mainContent = candidates.length > 0 ? candidates[0] : null; // Use the top candidate

  // Get metadata
  const title = getArticleTitle(doc);
  const byline = getArticleByline(doc);
  const excerpt = getArticleExcerpt(doc, mainContent);
  const siteName = getSiteName(doc);

  // Calculate text length
  const textLength = mainContent ? getInnerText(mainContent).length : 0;

  // Skip minimum character check in test environment
  // Perform minimum character check in actual environment
  const isTestEnvironment =
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV === "test";

  // Set content based on threshold check, regardless of environment
  const content = textLength >= charThreshold ? mainContent : null;

  // Determine article type based on whether the extracted text meets the threshold, regardless of environment
  const articleType =
    textLength >= charThreshold ? PageType.ARTICLE : PageType.OTHER;

  return {
    title,
    byline,
    root: content,
    nodeCount: content ? countNodes(content) : 0,
    pageType: articleType, // Include the determined article type
  };
}

/**
 * Extract article from HTML
 */
export function extract(
  html: string,
  options: ReadabilityOptions = {}
): ReadabilityArticle {
  // Parse HTML to create virtual DOM
  // Use custom parser if provided, otherwise use default
  const parser = options.parser || parseHTML; // Assuming parseHTML is the default from ./parser.ts
  const parsedResult = parser(html);
  let doc: VDocument;

  // Wrap VElement result in a VDocument if necessary (lowercase 'html')
  if (isVElement(parsedResult)) {
    doc = {
      documentElement: createElement("html"),
      body: parsedResult,
      // baseURI and documentURI might need adjustment based on context if parsing fragments
    };
    doc.documentElement.children = [doc.body];
    doc.body.parent = doc.documentElement;
  } else {
    doc = parsedResult;
  }

  // Execute preprocessing
  preprocessDocument(doc);

  // Extract content
  return extractContent(doc, options);
}

/**
 * Creates an extractor function with a specific parser configured.
 * @param opts - Options containing the parser to use.
 * @returns An extract function that uses the configured parser.
 */
export function createExtractor(opts: {
  parser: Parser;
}): (
  html: string,
  options?: Omit<ReadabilityOptions, "parser">
) => ReadabilityArticle {
  const { parser } = opts;

  return (
    html: string,
    options: Omit<ReadabilityOptions, "parser"> = {}
  ): ReadabilityArticle => {
    // Parse HTML using the configured parser
    const parsedResult = parser(html);
    let doc: VDocument;

    // Wrap VElement result in a VDocument if necessary (lowercase 'html')
    if (isVElement(parsedResult)) {
      doc = {
        documentElement: createElement("html"),
        body: parsedResult,
        // baseURI and documentURI might need adjustment based on context if parsing fragments
      };
      doc.documentElement.children = [doc.body];
      doc.body.parent = doc.documentElement;
    } else {
      doc = parsedResult;
    }

    // Execute preprocessing
    preprocessDocument(doc);

    // Extract content using the main logic, passing other options
    return extractContent(doc, options);
  }; // Add missing closing brace
}
