/*
 * Article preparation functions for readability
 * These functions clean up and enhance the extracted article content
 */

import {
  VElement,
  VTextNode,
  getAttribute,
  getElementsByTagName,
  getInnerText,
  everyNode,
  isPhrasingContent
} from '../vdom';

import {
  REGEXPS,
  FLAG_CLEAN_CONDITIONALLY
} from '../constants';

import { getAllNodesWithTag, removeNodes, replaceNodeTags, setNodeTag } from './preprocess';
import { getNextNode, removeAndGetNext } from './postprocess';
import { markDataTables, checkSingleTagInsideElement } from './helpers';

/**
 * Prepare the article node for display. Clean out any inline styles,
 * iframes, forms, strip extraneous <p> tags, etc.
 *
 * @param articleContent The article element to prepare
 * @return void
 **/
export function prepArticle(articleContent: VElement): void {
  // Check for data tables before we continue, to avoid removing items in
  // those tables, which will often be isolated even though they're
  // visually linked to other content-ful elements (text, images, etc.).
  markDataTables(articleContent);

  // Clean out elements with little content that have "share" in their id/class combinations
  cleanMatchedNodes(articleContent, function(node, matchString) {
    return (
      REGEXPS.shareElements.test(matchString) &&
      getInnerText(node).length < 500
    );
  });

  // Clean out elements that match certain criteria
  clean(articleContent, "form");
  clean(articleContent, "fieldset");
  clean(articleContent, "object");
  clean(articleContent, "embed");
  clean(articleContent, "footer");
  clean(articleContent, "link");
  clean(articleContent, "aside");
  clean(articleContent, "iframe");
  clean(articleContent, "input");
  clean(articleContent, "textarea");
  clean(articleContent, "select");
  clean(articleContent, "button");
  cleanHeaders(articleContent);

  // Do these last as the previous stuff may have removed junk
  // that will affect these
  cleanConditionally(articleContent, "table");
  cleanConditionally(articleContent, "ul");
  cleanConditionally(articleContent, "div");

  // Replace H1 with H2 as H1 should be only title that is displayed separately
  replaceNodeTags(getAllNodesWithTag(articleContent, ["h1"]), "h2");

  // Remove extra paragraphs
  removeNodes(getAllNodesWithTag(articleContent, ["p"]), function(paragraph) {
    const imgCount = getAllNodesWithTag(paragraph, ["img", "embed", "object", "iframe"]).length;
    const embedCount = getAllNodesWithTag(paragraph, ["embed", "object", "iframe"]).length;
    const objectCount = getAllNodesWithTag(paragraph, ["object", "iframe"]).length;
    const iframeCount = getAllNodesWithTag(paragraph, ["iframe"]).length;
    const totalCount = imgCount + embedCount + objectCount + iframeCount;
    
    return totalCount === 0 && !getInnerText(paragraph, false);
  });

  // Remove single-cell tables
  for (const table of getAllNodesWithTag(articleContent, ["table"])) {
    const tbody = checkSingleTagInsideElement(table, "TBODY")
      ? table.children[0] as VElement
      : table;
    
    if (tbody && checkSingleTagInsideElement(tbody, "TR")) {
      const row = tbody.children[0] as VElement;
      
      if (row && checkSingleTagInsideElement(row, "TD")) {
        const cell = row.children[0] as VElement;
        
        if (cell) {
          const newTag = everyNode(cell.children, isPhrasingContent) ? "P" : "DIV";
          const newNode = setNodeTag(cell, newTag);
          
          if (table.parent) {
            const index = table.parent.children.indexOf(table);
            if (index !== -1) {
              table.parent.children[index] = newNode;
              newNode.parent = table.parent;
            }
          }
        }
      }
    }
  }
}

/**
 * Clean a node of all elements of type "tag".
 * (Unless it's a youtube/vimeo video. People love movies.)
 *
 * @param articleContent The element to clean
 * @param tag to clean
 * @return void
 **/
export function clean(articleContent: VElement, tag: string): void {
  const isEmbed = ["object", "embed", "iframe"].includes(tag);

  removeNodes(getAllNodesWithTag(articleContent, [tag]), function(element) {
    // Allow youtube and vimeo videos through as people usually want to see those.
    if (isEmbed) {
      // Check attributes for video URLs
      for (const attrName in element.attributes) {
        if (element.attributes[attrName] && REGEXPS.videos.test(element.attributes[attrName])) {
          return false;
        }
      }

      // For embed with <object> tag, check inner HTML as well.
      if (element.tagName === "object" && element.children.some(child => {
        return child.nodeType === 'element' && REGEXPS.videos.test(getInnerText(child));
      })) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Clean out elements that match the specified conditions
 *
 * @param articleContent The element to clean
 * @param filter The function to use as a filter
 * @return void
 **/
export function cleanMatchedNodes(articleContent: VElement, filter: (node: VElement, matchString: string) => boolean): void {
  const endOfSearchMarkerNode = getNextNode(articleContent, true);
  let next = getNextNode(articleContent);

  while (next && next !== endOfSearchMarkerNode) {
    if (next.nodeType === 'element' && filter(next, (next.className || "") + " " + (next.id || ""))) {
      next = removeAndGetNext(next);
    } else {
      next = getNextNode(next);
    }
  }
}

/**
 * Clean out spurious headers from an Element.
 *
 * @param articleContent The element to clean
 * @return void
 **/
export function cleanHeaders(articleContent: VElement): void {
  let headingNodes = getAllNodesWithTag(articleContent, ["h1", "h2"]);
  removeNodes(headingNodes, function(node) {
    const shouldRemove = node.readability ? node.readability.contentScore < 0 : false;
    return shouldRemove;
  });
}

/**
 * Check if this node has an ancestor with the given tag name
 */
function hasAncestorTag(
  node: VElement, 
  tagName: string, 
  maxDepth: number = -1, 
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
 * Get the text density of a node
 */
function getTextDensity(e: VElement, tags: string[]): number {
  const textLength = getInnerText(e, true).length;
  if (textLength === 0) {
    return 0;
  }
  
  let childrenLength = 0;
  const children = getAllNodesWithTag(e, tags);
  
  for (const child of children) {
    childrenLength += getInnerText(child, true).length;
  }
  
  return childrenLength / textLength;
}

/**
 * Clean an element of all tags of type "tag" if they look fishy.
 * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
 *
 * @param articleContent The element to clean
 * @param tag The tag to clean
 * @return void
 **/
export function cleanConditionally(articleContent: VElement, tag: string): void {
  if ((FLAG_CLEAN_CONDITIONALLY & FLAG_CLEAN_CONDITIONALLY) === 0) {
    return;
  }

  const isList = tag === "ul" || tag === "ol";
  
  removeNodes(getAllNodesWithTag(articleContent, [tag]), function(node) {
    // First check if this node IS data table, in which case don't remove it.
    if (tag === "table" && node._readabilityDataTable) {
      return false;
    }

    // Next check if we're inside a data table, in which case don't remove it as well.
    if (hasAncestorTag(node, "table", -1, function(ancestor) {
      return !!ancestor._readabilityDataTable;
    })) {
      return false;
    }

    // If this is a list, make sure it's not just a list of images
    if (isList) {
      const listLength = getInnerText(node).length;
      const listItems = getAllNodesWithTag(node, ["li"]);
      
      if (listItems.length > 0) {
        const imgCount = getAllNodesWithTag(node, ["img"]).length;
        
        // If there are more images than list items, it's probably a gallery
        if (imgCount > listItems.length) {
          return false;
        }
        
        // If there are at least as many list items as paragraphs, it's probably a real list
        const pCount = getAllNodesWithTag(node, ["p"]).length;
        if (pCount <= listItems.length && listLength > 50) {
          return false;
        }
      }
    }

    // Check if this node has a relatively high link density
    const linkDensity = getLinkDensity(node);
    
    // Check if this node has a relatively high text density
    const textDensity = getTextDensity(node, ["span", "li", "td"]);
    
    // Check if this node contains any images
    const imgCount = getAllNodesWithTag(node, ["img"]).length;
    
    // Check for suspicious characteristics
    const contentScore = node.readability ? node.readability.contentScore : 0;
    const weight = getClassWeight(node);
    const hasSuspiciousContent = 
      (linkDensity > 0.3 && textDensity < 0.9) || 
      (weight < 0 && linkDensity > 0.1) ||
      (imgCount === 0 && textDensity === 0);
    
    return hasSuspiciousContent && contentScore < 10;
  });
}

/**
 * Get the link density of a node
 */
function getLinkDensity(element: VElement): number {
  const textLength = getInnerText(element).length;
  if (textLength === 0) {
    return 0;
  }

  let linkLength = 0;
  const links = getElementsByTagName(element, "a");
  
  for (const link of links) {
    const href = getAttribute(link, "href");
    const coefficient = href && href.startsWith('#') ? 0.3 : 1;
    linkLength += getInnerText(link).length * coefficient;
  }

  return linkLength / textLength;
}

/**
 * Get an elements class/id weight. Uses regular expressions to tell if this
 * element looks good or bad.
 */
function getClassWeight(e: VElement): number {
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
