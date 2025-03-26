/**
 * Readability v3 - DOM Manipulation Utilities
 *
 * Utility functions for manipulating the virtual DOM structure
 */

import type {
  VElement,
  VNode,
  VText,
  AriaNode,
  AriaNodeType,
  AriaTree,
  VDocument,
} from "./types.ts";
import { DIV_TO_P_ELEMS, PHRASING_ELEMS, REGEXPS } from "./constants.ts";

// Node creation helper functions
export function createElement(tagName: string): VElement {
  return {
    nodeType: "element",
    tagName: tagName.toLowerCase(), // Use lowercase
    attributes: {},
    children: [],
  };
}

export function createTextNode(content: string): VText {
  return {
    nodeType: "text",
    textContent: content,
  };
}

// Get attribute
export function getAttribute(element: VElement, name: string): string | null {
  return element.attributes[name] || null;
}

// Get elements by tag name
export function getElementsByTagName(
  element: VElement,
  tagName: string | string[]
): VElement[] {
  const tagNames = Array.isArray(tagName) ? tagName : [tagName];
  const lowerTagNames = tagNames.map((tag) => tag.toLowerCase()); // Use lowercase
  const result: VElement[] = [];

  // Check if this element matches (using lowercase)
  if (lowerTagNames.includes("*") || lowerTagNames.includes(element.tagName)) {
    result.push(element);
  }

  // Recursively check child elements
  for (const child of element.children) {
    if (child.nodeType === "element") {
      result.push(...getElementsByTagName(child, tagName));
    }
  }

  return result;
}

// Get the next node (depth-first traversal)
export function getNextNode(
  node: VElement | VText,
  ignoreSelfAndKids?: boolean
): VElement | VText | null {
  if (
    node.nodeType === "element" &&
    !ignoreSelfAndKids &&
    node.children.length > 0
  ) {
    return node.children[0];
  }

  // Look for sibling nodes
  const siblings = node.parent?.children || [];
  const index = siblings.indexOf(node);
  if (index !== -1 && index < siblings.length - 1) {
    return siblings[index + 1];
  }

  // Look for parent's siblings
  if (node.parent) {
    return getNextNode(node.parent, true);
  }

  return null;
}

// Check visibility
export function isProbablyVisible(node: VElement): boolean {
  const style = node.attributes.style || "";
  const hidden = node.attributes.hidden !== undefined;
  const ariaHidden = node.attributes["aria-hidden"] === "true";

  return (
    !style.includes("display: none") &&
    !style.includes("visibility: hidden") &&
    !hidden &&
    !ariaHidden
  );
}

// Iterate over nodes
export function forEachNode<T extends VElement | VText>(
  nodeList: T[],
  fn: (node: T, index: number, list: T[]) => void
): void {
  nodeList.forEach(fn);
}

// Check if any node satisfies the condition
export function someNode<T extends VElement | VText>(
  nodeList: T[],
  fn: (node: T, index: number, list: T[]) => boolean
): boolean {
  return nodeList.some(fn);
}

// Check if all nodes satisfy the condition
export function everyNode<T extends VElement | VText>(
  nodeList: T[],
  fn: (node: T, index: number, list: T[]) => boolean
): boolean {
  return nodeList.every(fn);
}

// Check ancestor elements
export function hasAncestorTag(
  node: VElement | VText,
  tagName: string,
  maxDepth: number = -1
): boolean {
  tagName = tagName.toLowerCase(); // Use lowercase
  let depth = 0;
  let currentNode = node.parent;

  while (currentNode) {
    if (maxDepth > 0 && depth > maxDepth) {
      return false;
    }

    if (currentNode.tagName === tagName) {
      return true;
    }

    currentNode = currentNode.parent;
    depth++;
  }

  return false;
}

// Check for child block elements
export function hasChildBlockElement(element: VElement): boolean {
  return someNode(element.children, (child) => {
    if (child.nodeType !== "element") {
      return false;
    }

    return DIV_TO_P_ELEMS.has(child.tagName) || hasChildBlockElement(child);
  });
}

// Check for phrasing content
export function isPhrasingContent(node: VNode): boolean {
  if (node.nodeType === "text") {
    return true;
  }

  if (node.nodeType === "element") {
    const element = node as VElement;

    if (PHRASING_ELEMS.includes(element.tagName)) {
      return true;
    }

    // Check specific tags in lowercase
    if (
      element.tagName === "a" ||
      element.tagName === "del" ||
      element.tagName === "ins"
    ) {
      return everyNode(element.children, isPhrasingContent);
    }
  }

  return false;
}

// Get inner text
export function getInnerText(
  element: VElement | VText,
  normalizeSpaces: boolean = true
): string {
  let text = "";

  if (element.nodeType === "text") {
    text = element.textContent;
  } else {
    for (const child of element.children) {
      if (child.nodeType === "text") {
        text += child.textContent;
      } else {
        text += getInnerText(child, false);
      }
    }
  }

  text = text.trim();

  if (normalizeSpaces) {
    return text.replace(REGEXPS.normalize, " ");
  }

  return text;
}

// Get link density
export function getLinkDensity(element: VElement): number {
  const textLength = getInnerText(element).length;
  if (textLength === 0) {
    return 0;
  }

  let linkLength = 0;
  const links = getElementsByTagName(element, "a"); // Use lowercase 'a'

  forEachNode(links, (link) => {
    const href = getAttribute(link, "href");
    const coefficient = href && href.startsWith("#") ? 0.3 : 1;
    linkLength += getInnerText(link).length * coefficient;
  });

  return linkLength / textLength;
}

// Get text density
export function getTextDensity(element: VElement): number {
  const text = getInnerText(element);
  const textLength = text.length;
  if (textLength === 0) return 0;

  const childElements = element.children.filter(
    (child) => child.nodeType === "element"
  );
  return textLength / (childElements.length || 1);
}

// Get ancestor elements
export function getNodeAncestors(
  node: VElement,
  maxDepth: number = 3
): VElement[] {
  const ancestors: VElement[] = [];
  let currentNode = node.parent;
  let depth = 0;

  while (currentNode && (maxDepth <= 0 || depth < maxDepth)) {
    ancestors.push(currentNode);
    currentNode = currentNode.parent;
    depth++;
  }

  return ancestors;
}
