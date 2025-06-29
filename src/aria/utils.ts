/**
 * Utility functions for ARIA tree operations
 */

import type { AriaNode } from "../types";

/**
 * Extract text content from an AriaNode and its children recursively
 * @param node - The AriaNode to extract text from
 * @param includeNewlines - Whether to include newlines after each node's text
 * @returns The extracted text content
 */
export function extractTextFromAriaNode(node: AriaNode, includeNewlines: boolean = false): string {
  let text = "";
  
  if (node.name) {
    text += node.name;
    if (includeNewlines) {
      text += "\n";
    }
  }
  
  if (node.children) {
    for (const child of node.children) {
      text += extractTextFromAriaNode(child, includeNewlines);
    }
  }
  
  return text;
}