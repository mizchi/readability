/**
 * Readability - Formatting Functions
 *
 * Provides functions to generate HTML from VElement and stringify it.
 */

import type { VElement, VText, VNode } from "./types";

/**
 * Generate HTML string from VElement, omitting span tags and class attributes.
 *
 * @param element VElement to convert
 * @returns HTML string
 */
export function toHTML(element: VElement | null): string {
  if (!element) return "";

  const { tagName, attributes, children } = element;
  const tagNameLower = tagName.toLowerCase();

  // Omit span tags, process children directly
  if (tagNameLower === "span") {
    return children
      .map((child) => {
        if (child.nodeType === "text") {
          return escapeHTML((child as VText).textContent);
        } else {
          return toHTML(child as VElement);
        }
      })
      .join("");
  }

  // List of self-closing tags
  const selfClosingTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  // Generate attribute string, excluding 'class'
  const attrs = Object.entries(attributes)
    .filter(([key]) => key !== "class") // Exclude class attribute
    .map(([key, value]) => `${key}="${escapeHTML(value)}"`)
    .join(" ");

  // For self-closing tags
  if (selfClosingTags.has(tagNameLower) && children.length === 0) {
    return attrs ? `<${tagNameLower} ${attrs}/>` : `<${tagNameLower}/>`;
  }

  // Start tag
  const startTag = attrs ? `<${tagNameLower} ${attrs}>` : `<${tagNameLower}>`;

  // Process child elements
  const childContent = children
    .map((child) => {
      if (child.nodeType === "text") {
        return escapeHTML((child as VText).textContent);
      } else {
        return toHTML(child as VElement);
      }
    })
    .join("");

  // End tag
  const endTag = `</${tagNameLower}>`;

  return `${startTag}${childContent}${endTag}`;
}

/**
 * Escape HTML special characters
 *
 * @param str String to escape
 * @returns Escaped string
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "&#039;");
}

/**
 * List of block elements
 */
const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

/**
 * Convert VElement to a readable string format
 * Removes tags while applying line breaks considering block and inline elements
 * Aligns all text to the shallowest indent
 * Merges consecutive line breaks into one
 *
 * @param element VElement to convert
 * @returns Formatted string
 */
export function stringify(element: VElement | null): string {
  if (!element) return "";

  const { tagName, children } = element;
  const tagNameLower = tagName.toLowerCase();
  const isBlock = BLOCK_ELEMENTS.has(tagNameLower);

  // Handle special tags
  if (tagNameLower === "br") {
    return "\n";
  }

  if (tagNameLower === "hr") {
    return "\n----------\n";
  }

  let result = "";

  // Insert line break before block elements
  if (isBlock) {
    result += "\n";
  }

  // Process child elements
  for (const child of children) {
    if (child.nodeType === "text") {
      // Append text node directly
      const text = (child as VText).textContent.trim();
      if (text) {
        result += text + " ";
      }
    } else {
      // Recursively process element nodes
      result += stringify(child as VElement);
    }
  }

  // Remove trailing space
  result = result.replace(/ $/, "");

  // Insert line break after block elements
  if (isBlock) {
    result += "\n";
  }

  // Merge consecutive line breaks into one
  return result.replace(/\n{2,}/g, "\n");
}

/**
 * Format the entire document
 * Merges consecutive line breaks into one, removes extra line breaks at the beginning and end
 *
 * @param text Text to format
 * @returns Formatted text
 */
export function formatDocument(text: string): string {
  return text
    .replace(/\n{2,}/g, "\n") // Merge consecutive line breaks
    .replace(/^\n+/, "") // Remove leading line breaks
    .replace(/\n+$/, "") // Remove trailing line breaks
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Extract text content from VElement
 *
 * @param element Target VElement
 * @returns Text content
 */
export function extractTextContent(element: VElement | null): string {
  if (!element) return "";

  return element.children
    .map((child) => {
      if (child.nodeType === "text") {
        return (child as VText).textContent;
      } else {
        return extractTextContent(child as VElement);
      }
    })
    .join("");
}

/**
 * Count the number of nodes within a VElement
 *
 * @param element Target VElement
 * @returns Number of nodes
 */
export function countNodes(element: VElement | null): number {
  if (!element) return 0;

  // Count itself as 1
  let count = 1;

  // Recursively count child elements
  for (const child of element.children) {
    if (child.nodeType === "element") {
      count += countNodes(child as VElement);
    } else {
      // Count text nodes as 1
      count += 1;
    }
  }

  return count;
}
