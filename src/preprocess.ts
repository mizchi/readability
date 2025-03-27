/**
 * Readability v3 - Preprocessing
 *
 * Performs preprocessing before HTML parsing
 */

import type { VDocument, VElement } from "./types.ts";
import { getElementsByTagName } from "./dom.ts";

// List of semantic tags to remove (now lowercase)
const TAGS_TO_REMOVE = [
  "aside", // Supplementary information not directly related to the main content, like sidebars
  "nav", // Navigation menus
  "header", // Page headers
  "footer", // Page footers
  "script", // JavaScript
  "style", // CSS
  "noscript", // Alternative content for when JavaScript is disabled
  "iframe", // Embedded frames (e.g., ads, social media widgets)
  "form", // Form elements (e.g., login forms)
  "button", // Button elements
  "object", // Embedded objects
  "embed", // Embedded content
  "applet", // Old embedded Java applets
  "map", // Image maps
  "dialog", // Dialog boxes
  // 'audio',      // Audio players
  // 'video',      // Video players
  // Excluded because they might be necessary for the main content
  // 'FIGURE',  // Figures (with captions)
  // 'CANVAS',  // Canvas elements
  // 'DETAILS', // Collapsible details information
];

// Patterns for class names or ID names likely indicating ads
const AD_PATTERNS = [
  /ad-/i,
  /^ad$/i,
  /^ads$/i,
  /advert/i,
  /banner/i,
  /sponsor/i,
  /promo/i,
  /google-ad/i,
  /adsense/i,
  /doubleclick/i,
  /amazon/i,
  /affiliate/i,
  /commercial/i,
  /paid/i,
  /shopping/i,
  /recommendation/i,
];

/**
 * Remove noise elements from the document
 *
 * @param doc Document to process
 * @param options オプション
 * @returns Processed document
 */
export function preprocessDocument(
  doc: VDocument,
  options: {
    /**
     * ナビゲーション要素を保持するかどうか
     * true: ナビゲーション要素を保持する
     * false: ナビゲーション要素を削除する（デフォルト）
     */
    preserveNavigation?: boolean;
  } = {}
): VDocument {
  // 1. Remove semantic tags and unnecessary tags
  removeUnwantedTags(doc, options);

  // 2. Remove ad elements
  removeAds(doc);

  return doc;
}

/**
 * Remove unwanted tags
 */
function removeUnwantedTags(doc: VDocument): void {
  for (const tagName of TAGS_TO_REMOVE) {
    const elements = getElementsByTagName(doc.documentElement, tagName);

    // Remove elements from their parent
    for (const element of elements) {
      if (element.parent) {
        const index = element.parent.children.indexOf(element);
        if (index !== -1) {
          element.parent.children.splice(index, 1);
        }
      }
    }
  }
}

/**
 * Remove ad elements
 */
function removeAds(doc: VDocument): void {
  // Get all elements under body
  const allElements = getElementsByTagName(doc.body, "*");

  // Remove elements that seem to be ads
  for (const element of allElements) {
    if (isLikelyAd(element) && element.parent) {
      const index = element.parent.children.indexOf(element);
      if (index !== -1) {
        element.parent.children.splice(index, 1);
      }
    }
  }
}

/**
 * Determine if an element is likely an ad
 */
function isLikelyAd(element: VElement): boolean {
  // Check class name and ID
  const className = element.className || "";
  const id = element.id || "";
  const combinedString = `${className} ${id}`;

  // Check if it matches ad patterns
  for (const pattern of AD_PATTERNS) {
    if (pattern.test(combinedString)) {
      return true;
    }
  }

  // Check ad-related attributes
  if (
    element.attributes.role === "advertisement" ||
    element.attributes["data-ad"] !== undefined ||
    element.attributes["data-ad-client"] !== undefined ||
    element.attributes["data-ad-slot"] !== undefined
  ) {
    return true;
  }

  return false;
}

/**
 * Determine if an element is visible
 */
function isVisible(element: VElement): boolean {
  // Check style attribute
  const style = element.attributes.style || "";
  if (
    style.includes("display: none") ||
    style.includes("visibility: hidden") ||
    style.includes("opacity: 0")
  ) {
    return false;
  }

  // Check hidden attribute
  if (element.attributes.hidden !== undefined) {
    return false;
  }

  // Check aria-hidden attribute
  if (element.attributes["aria-hidden"] === "true") {
    return false;
  }

  return true;
}
