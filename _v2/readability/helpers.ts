import { DIV_TO_P_ELEMS, REGEXPS } from "../constants.ts";
import type { VElement, VNode, VTextNode } from "../types.ts";
import { forEachNode, getAttribute, getElementsByTagName, getInnerText, getLinkDensity, someNode} from "../vdom.ts";
import { getAllNodesWithTag } from "./preprocess.ts";

/**
 * Initialize a node with the readability object. Also checks the
 * className/id for special names to add to its score.
 *
 * @param node The element to initialize
 * @return void
 **/
export function initializeNode(node: VElement): void {
  node.readability = { contentScore: 0 };

  switch (node.tagName) {
    case "DIV":
      node.readability.contentScore += 5;
      break;

    case "PRE":
    case "TD":
    case "BLOCKQUOTE":
      node.readability.contentScore += 3;
      break;

    case "ADDRESS":
    case "OL":
    case "UL":
    case "DL":
    case "DD":
    case "DT":
    case "LI":
    case "FORM":
      node.readability.contentScore -= 3;
      break;

    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
    case "TH":
      node.readability.contentScore -= 5;
      break;
  }

  node.readability.contentScore += getClassWeight(node);
}

/**
 * Get an elements class/id weight. Uses regular expressions to tell if this
 * element looks good or bad.
 *
 * @param e The element to get weight for
 * @return number (Integer)
 **/
export function getClassWeight(e: VElement): number {
  let weight = 0;

  // Look for a special classname
  if (e.className) {
    if (REGEXPS.negative.test(e.className)) {
      weight -= 25;
    }

    if (REGEXPS.positive.test(e.className)) {
      weight += 25;
    }
  }

  // Look for a special ID
  if (e.id) {
    if (REGEXPS.negative.test(e.id)) {
      weight -= 25;
    }

    if (REGEXPS.positive.test(e.id)) {
      weight += 25;
    }
  }

  return weight;
}

/**
 * Determine whether the element is visible
 */
export function isProbablyVisible(node: VElement): boolean {
  // Check for inline style properties that would indicate the element is hidden
  const style = node.attributes.style || '';
  const hidden = node.attributes.hidden !== undefined;
  const ariaHidden = node.attributes['aria-hidden'] === 'true';

  const hasDisplayNone = style.includes('display: none');
  const hasVisibilityHidden = style.includes('visibility: hidden');

  // Element is probably visible if it doesn't have any of these hiding attributes
  return !hasDisplayNone && !hasVisibilityHidden && !hidden && !ariaHidden;
}

/**
 * Checks if this node has one of its ancestor tag name matching the
 * provided one.
 * @param  node
 * @param  tagName
 * @param  maxDepth
 * @param  filterFn a filter to invoke to determine whether this node 'counts'
 * @return Boolean
 */
export function checkHasAncestorTag(
  node: VElement | VTextNode,
  tagName: string,
  maxDepth: number = 3,
  filterFn?: (node: VElement) => boolean
): boolean {
  tagName = tagName.toUpperCase();
  let depth = 0;
  let currentNode = node.parent;

  while (currentNode) {
    if (maxDepth > 0 && depth > maxDepth) {
      return false;
    }

    if (
      currentNode.nodeType === 'element' &&
      currentNode.tagName === tagName &&
      (!filterFn || filterFn(currentNode))
    ) {
      return true;
    }

    currentNode = currentNode.parent;
    depth++;
  }

  return false;
}

/**
 * Check if element has any children block level elements.
 */
export function hasChildBlockElement(element: VElement): boolean {
  return someNode(element.children, function(node) {
    return (
      node.nodeType === 'element' &&
      DIV_TO_P_ELEMS.has((node as VElement).tagName) ||
      hasChildBlockElement(node as VElement)
    );
  });
}

/**
 * Check if element is a byline
 */
export function isValidByline(node: VElement, matchString: string): boolean {
  const rel = getAttribute(node, "rel");
  const itemprop = getAttribute(node, "itemprop");
  const bylineText = getInnerText(node);
  const bylineLength = bylineText ? bylineText.trim().length : 0;

  return (
    (rel === "author" ||
      (itemprop && itemprop.includes("author")) ||
      REGEXPS.byline.test(matchString)) &&
    !!bylineLength &&
    bylineLength < 100
  );
}

/**
 * Check if the current header element is a title duplicate
 */
export function headerDuplicatesTitle(node: VElement, articleTitle: string): boolean {
  if (node.tagName != "H1" && node.tagName != "H2") {
    return false;
  }
  const heading = getInnerText(node, false);
  return compareTextSimilarity(articleTitle, heading) > 0.75;
}

/**
 * Compares second text to first one
 * 1 = same text, 0 = completely different text
 * Works by splitting both texts into words and then finding words that are unique in second text
 * The result is given by the lower length of unique parts
 *
 * @param textA First text to compare
 * @param textB Second text to compare
 * @return Similarity score between 0 and 1
 */
export function compareTextSimilarity(textA: string, textB: string): number {
  const tokensA = textA
    .toLowerCase()
    .split(REGEXPS.tokenize)
    .filter(Boolean);
  const tokensB = textB
    .toLowerCase()
    .split(REGEXPS.tokenize)
    .filter(Boolean);
  if (!tokensA.length || !tokensB.length) {
    return 0;
  }
  const uniqTokensB = tokensB.filter(token => !tokensA.includes(token));
  const distanceB = uniqTokensB.join(" ").length / tokensB.join(" ").length;
  return 1 - distanceB;
}

/**
 * Get the ancestors of a node
 */
export function getNodeAncestors(node: VNode, maxDepth: number = 0): VNode[] {
  const ancestors: VNode[] = [];
  let currentNode = node.parent;
  let i = 0;

  while (currentNode) {
    ancestors.push(currentNode);
    if (maxDepth && ++i === maxDepth) {
      break;
    }
    currentNode = currentNode.parent;
  }

  return ancestors;
}

/**
 * Get the density of links as a percentage of the content
 * This is the amount of text that is inside a link divided by the total text in the node.
 * Relative link density is the amount of link text / the total text in the node
 */
export function getRelativeLinkDensity(element: VElement, linkDensityModifier: number = 0): number {
  const linkDensity = getLinkDensity(element);
  return linkDensity - linkDensityModifier;
}

/**
 * Check if element is a data table
 */
export function isDataTable(table: VElement): boolean {
  return !!table._readabilityDataTable;
}

/**
 * Mark data tables for later identification
 */
export function markDataTables(root: VElement): void {
  const tables = getElementsByTagName(root, "table");

  for (const table of tables) {
    const role = getAttribute(table, "role");
    if (role === "presentation") {
      table._readabilityDataTable = false;
      continue;
    }

    const datatable = getAttribute(table, "datatable");
    if (datatable === "0") {
      table._readabilityDataTable = false;
      continue;
    }

    const summary = getAttribute(table, "summary");
    if (summary) {
      table._readabilityDataTable = true;
      continue;
    }

    const captions = getElementsByTagName(table, "caption");
    if (captions.length > 0 && captions[0].children.length > 0) {
      table._readabilityDataTable = true;
      continue;
    }

    // If the table has a descendant with any of these tags, consider a data table:
    const dataTableDescendants = ["col", "colgroup", "tfoot", "thead", "th"];
    let hasDataTableDescendants = false;

    for (const tag of dataTableDescendants) {
      if (getElementsByTagName(table, tag).length > 0) {
        hasDataTableDescendants = true;
        break;
      }
    }

    if (hasDataTableDescendants) {
      table._readabilityDataTable = true;
      continue;
    }

    // Nested tables indicate a layout table:
    if (getElementsByTagName(table, "table").length > 0) {
      table._readabilityDataTable = false;
      continue;
    }

    const rows = getElementsByTagName(table, "tr");
    let columns = 0;
    let rowCount = 0;

    // Count rows and columns
    for (const row of rows) {
      const rowspan = getAttribute(row, "rowspan");
      rowCount += rowspan ? parseInt(rowspan, 10) : 1;

      // Now look for column-related info
      let columnsInThisRow = 0;
      const cells = getElementsByTagName(row, "td");

      for (const cell of cells) {
        const colspan = getAttribute(cell, "colspan");
        columnsInThisRow += colspan ? parseInt(colspan, 10) : 1;
      }

      columns = Math.max(columns, columnsInThisRow);
    }

    if (columns === 1 || rowCount === 1) {
      // Single column/row tables are not data tables
      table._readabilityDataTable = false;
      continue;
    }

    if (rows.length >= 10 || columns > 4) {
      // Large tables are likely to be data tables
      table._readabilityDataTable = true;
      continue;
    }

    // Now just go by size entirely:
    table._readabilityDataTable = rowCount * columns > 10;
  }
}

/**
 * Check if element is without content
 */
export function checkElementWithoutContent(node: VElement): boolean {
  // Check if node has no text content
  let hasText = false;
  for (const child of node.children) {
    if (child.nodeType === 'text' && child.textContent.trim().length > 0) {
      hasText = true;
      break;
    }
  }

  if (hasText) return false;

  // Count BR and HR elements
  let brHrCount = 0;
  for (const child of node.children) {
    if (child.nodeType === 'element' && (child.tagName === 'BR' || child.tagName === 'HR')) {
      brHrCount++;
    }
  }

  // Element has no content if it has no text and all children are BR or HR
  return !hasText && (node.children.length === 0 || node.children.length === brHrCount);
}

/**
 * Check if this node has only one child element with the specified tag
 */
export function checkSingleTagInsideElement(element: VElement, tag: string): boolean {
  // There should be exactly 1 element child with given tag
  if (element.children.length != 1) return false;

  const child = element.children[0];
  if (child.nodeType !== 'element' || child.tagName !== tag) return false;

  // And there should be no text nodes with real content
  return !someNode(element.children, function(node) {
    return (
      node.nodeType === 'text' &&
      node.textContent.trim().length > 0
    );
  });
}

/**
 * Get the number of times a string s appears in the node e.
 */
export function getCharCount(e: VElement, s: string = ","): number {
  return getInnerText(e).split(s).length - 1;
}

/**
 * Get the density of elements within a node
 */
export function getTextDensity(e: VElement, tags: string[]): number {
  const textLength = getInnerText(e, true).length;
  if (textLength === 0) {
    return 0;
  }

  let childrenLength = 0;
  const children = getAllNodesWithTag(e, tags);

  forEachNode(children, child => {
    childrenLength += getInnerText(child, true).length;
  });

  return childrenLength / textLength;
}
