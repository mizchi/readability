/*
 * Article preparation functions for readability
 * These functions prepare the article for display
 */

import type { VElement } from '../types.ts';
import {
  getAttribute,
  getElementsByTagName,
  forEachNode,
  someNode,
  everyNode,
  isPhrasingContent,
  getLinkDensity,
} from '../vdom.ts';

import {
  REGEXPS,
  ALTER_TO_DIV_EXCEPTIONS
} from '../constants.ts';

import { getAllNodesWithTag, setNodeTag, removeNodes } from './preprocess.ts';
import { getNextNode } from './postprocess.ts';
import { markDataTables, isDataTable, getTextDensity, getRelativeLinkDensity } from './helpers.ts';

/**
 * Prepare the article node for display. Clean out any inline styles,
 * iframes, forms, strip extraneous <p> tags, etc.
 *
 * @param articleContent The article element to prepare
 * @param linkDensityModifier Modifier for link density calculation
 * @return void
 **/
export function prepArticle(articleContent: VElement, linkDensityModifier: number = 0): void {
  cleanStyles(articleContent);

  // Check for data tables before we continue, to avoid removing items in
  // those tables, which will often be isolated even though they're
  // visually linked to other content-ful elements (text, images, etc.).
  markDataTables(articleContent);

  fixLazyImages(articleContent);

  // Clean out junk from the article content
  cleanConditionally(articleContent, "form");
  cleanConditionally(articleContent, "fieldset");
  clean(articleContent, "object");
  clean(articleContent, "embed");
  clean(articleContent, "footer");
  clean(articleContent, "link");
  clean(articleContent, "aside");

  // Clean out elements with little content that have "share" in their id/class combinations from final top candidates,
  // which means we don't remove the top candidates even they have "share".
  const shareElementThreshold = 500;

  forEachNode(articleContent.children, function(topCandidate) {
    if (topCandidate.nodeType !== 'element') return;
    
    cleanMatchedNodes(topCandidate as VElement, function(node, matchString) {
      return (
        REGEXPS.shareElements.test(matchString) &&
        getInnerText(node, false).length < shareElementThreshold
      );
    });
  });

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

  // replace H1 with H2 as H1 should be only title that is displayed separately
  replaceNodeTags(getAllNodesWithTag(articleContent, ["h1"]), "h2");

  // Remove extra paragraphs
  removeNodes(
    getAllNodesWithTag(articleContent, ["p"]),
    function(paragraph) {
      // At this point, nasty iframes have been removed; only embedded video
      // ones remain.
      const contentElements = getAllNodesWithTag(paragraph, [
        "img",
        "embed",
        "object",
        "iframe",
      ]);
      
      return (
        contentElements.length === 0 && getInnerText(paragraph, false).length === 0
      );
    }
  );

  forEachNode(
    getAllNodesWithTag(articleContent, ["br"]),
    function(br) {
      const next = getNextNode(br);
      if (next && next.tagName == "P") {
        // If the next element is a paragraph, remove the <br>
        remove(br);
      }
    }
  );

  // Remove single-cell tables
  forEachNode(
    getAllNodesWithTag(articleContent, ["table"]),
    function(table) {
      const tbody = someNode(table.children, child => 
        child.nodeType === 'element' && child.tagName === 'TBODY'
      )
        ? (table.children.find(child => 
            child.nodeType === 'element' && child.tagName === 'TBODY'
          ) as VElement)
        : table;

      if (
        tbody.children.length === 1 && 
        tbody.children[0].nodeType === 'element' && 
        tbody.children[0].tagName === 'TR'
      ) {
        const row = tbody.children[0] as VElement;
        
        if (
          row.children.length === 1 && 
          row.children[0].nodeType === 'element' && 
          row.children[0].tagName === 'TD'
        ) {
          const cell = row.children[0] as VElement;
          
          // If the cell has only phrasing content, convert it to a paragraph,
          // otherwise convert it to a div
          const newTag = everyNode(cell.children, isPhrasingContent) ? "P" : "DIV";
          const newElement = setNodeTag(cell, newTag);
          
          // Replace the table with the cell
          if (table.parent) {
            const index = table.parent.children.indexOf(table);
            if (index !== -1) {
              table.parent.children[index] = newElement;
              newElement.parent = table.parent;
            }
          }
        }
      }
    }
  );
}

/**
 * Remove the style attribute on every element and under.
 *
 * @param element The element to clean styles from
 * @return void
 **/
function cleanStyles(element: VElement): void {
  if (element.tagName.toLowerCase() === "svg") {
    return;
  }

  // Remove `style` and deprecated presentational attributes
  const presentationalAttributes = [
    "align",
    "background",
    "bgcolor",
    "border",
    "cellpadding",
    "cellspacing",
    "frame",
    "hspace",
    "rules",
    "style",
    "valign",
    "vspace",
  ];

  for (const attribute of presentationalAttributes) {
    delete element.attributes[attribute];
  }

  // Remove deprecated size attribute from specific elements
  const deprecatedSizeAttributeElems = ["TABLE", "TH", "TD", "HR", "PRE"];
  if (deprecatedSizeAttributeElems.includes(element.tagName)) {
    delete element.attributes["width"];
    delete element.attributes["height"];
  }

  // Process children
  for (const child of element.children) {
    if (child.nodeType === 'element') {
      cleanStyles(child);
    }
  }
}

/**
 * Clean out elements that match the specified conditions
 *
 * @param element The element to clean
 * @param filter Function that determines whether a node should be removed
 * @return void
 **/
function cleanMatchedNodes(element: VElement, filter: (node: VElement, matchString: string) => boolean): void {
  const endOfSearchMarkerNode = getNextNode(element, true);
  let next = getNextNode(element);

  while (next && next !== endOfSearchMarkerNode) {
    if (next.nodeType === 'element') {
      const matchString = (next.className || "") + " " + (next.id || "");
      
      if (filter(next, matchString)) {
        next = removeAndGetNext(next);
      } else {
        next = getNextNode(next);
      }
    } else {
      next = getNextNode(next as any);
    }
  }
}

/**
 * Clean a node of all elements of type "tag".
 * (Unless it's a youtube/vimeo video. People love movies.)
 *
 * @param element The element to clean
 * @param tag Tag to clean
 * @return void
 **/
function clean(element: VElement, tag: string): void {
  const isEmbed = ["object", "embed", "iframe"].includes(tag);

  removeNodes(getAllNodesWithTag(element, [tag]), function(node) {
    // Allow youtube and vimeo videos through as people usually want to see those.
    if (isEmbed) {
      // Check the elements attributes to see if any of them contain youtube or vimeo
      for (const attrName in node.attributes) {
        if (REGEXPS.videos.test(node.attributes[attrName])) {
          return false;
        }
      }

      // For embed with <object> tag, check inner HTML as well.
      if (
        node.tagName === "object" &&
        REGEXPS.videos.test(getInnerHTML(node))
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Clean an element of all tags of type "tag" if they look fishy.
 * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
 *
 * @param element The element to clean
 * @param tag Tag to clean conditionally
 * @return void
 **/
function cleanConditionally(element: VElement, tag: string): void {
  removeNodes(getAllNodesWithTag(element, [tag]), function(node) {
    // First check if this node IS data table, in which case don't remove it.
    if (tag === "table" && isDataTable(node)) {
      return false;
    }

    // Next check if we're inside a data table, in which case don't remove it as well.
    if (hasAncestorTag(node, "table", -1, isDataTable)) {
      return false;
    }

    if (hasAncestorTag(node, "code")) {
      return false;
    }

    // Keep element if it has data tables
    if (
      getAllNodesWithTag(node, ["table"]).some(tbl => isDataTable(tbl))
    ) {
      return false;
    }

    const weight = getClassWeight(node);
    const contentScore = 0;

    if (weight + contentScore < 0) {
      return true;
    }

    if (getCharCount(node, ",") < 10) {
      // If there are not very many commas, and the number of
      // non-paragraph elements is more than paragraphs or other
      // ominous signs, remove the element.
      const p = getAllNodesWithTag(node, ["p"]).length;
      const img = getAllNodesWithTag(node, ["img"]).length;
      const li = getAllNodesWithTag(node, ["li"]).length - 100;
      const input = getAllNodesWithTag(node, ["input"]).length;
      const headingDensity = getTextDensity(node, [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ]);

      let embedCount = 0;
      const embeds = getAllNodesWithTag(node, [
        "object",
        "embed",
        "iframe",
      ]);

      for (const embed of embeds) {
        // Check if this embed has attribute that matches video regex
        let isVideo = false;
        for (const attrName in embed.attributes) {
          if (REGEXPS.videos.test(embed.attributes[attrName])) {
            isVideo = true;
            break;
          }
        }

        // For embed with <object> tag, check inner HTML as well.
        if (
          !isVideo &&
          embed.tagName === "object" &&
          REGEXPS.videos.test(getInnerHTML(embed))
        ) {
          isVideo = true;
        }

        if (isVideo) {
          return false;
        }

        embedCount++;
      }

      const innerText = getInnerText(node);

      // Check for suspicious words
      if (
        REGEXPS.adWords.test(innerText) ||
        REGEXPS.loadingWords.test(innerText)
      ) {
        return true;
      }

      const contentLength = innerText.length;
      const linkDensity = getLinkDensity(node);
      const textishTags = ["SPAN", "LI", "TD"].concat(
        Array.from(ALTER_TO_DIV_EXCEPTIONS)
      );
      const textDensity = getTextDensity(node, textishTags);
      const isFigureChild = hasAncestorTag(node, "figure");

      // Apply shadiness checks
      if (!isFigureChild && img > 1 && p / img < 0.5) {
        return true;
      }
      if (!tag.match(/^ul|ol|li$/i) && li > p) {
        return true;
      }
      if (input > Math.floor(p / 3)) {
        return true;
      }
      if (
        !tag.match(/^ul|ol|li$/i) &&
        !isFigureChild &&
        headingDensity < 0.9 &&
        contentLength < 25 &&
        (img === 0 || img > 2) &&
        linkDensity > 0
      ) {
        return true;
      }
      if (
        !tag.match(/^ul|ol|li$/i) &&
        weight < 25 &&
        linkDensity > 0.2
      ) {
        return true;
      }
      if (weight >= 25 && linkDensity > 0.5) {
        return true;
      }
      if ((embedCount === 1 && contentLength < 75) || embedCount > 1) {
        return true;
      }
      if (img === 0 && textDensity === 0) {
        return true;
      }

      // Allow simple lists of images to remain
      if (tag.match(/^ul|ol|li$/i)) {
        // Check if all children are single elements
        let allSingleElements = true;
        for (const child of node.children) {
          if (child.nodeType === 'element' && child.children.length > 1) {
            allSingleElements = false;
            break;
          }
        }

        // If all list items contain a single element and all are images, keep the list
        if (allSingleElements) {
          const liCount = getAllNodesWithTag(node, ["li"]).length;
          if (img === liCount) {
            return false;
          }
        }
      }

      return true;
    }
    return false;
  });
}

/**
 * Clean out spurious headers from an Element.
 *
 * @param element The element to clean headers from
 * @return void
 **/
function cleanHeaders(element: VElement): void {
  removeNodes(getAllNodesWithTag(element, ["h1", "h2"]), function(header) {
    const weight = getClassWeight(header);
    return weight < 0;
  });
}

/**
 * Get the inner HTML of an element
 *
 * @param element The element to get inner HTML from
 * @return string
 **/
function getInnerHTML(element: VElement): string {
  let html = "";
  for (const child of element.children) {
    if (child.nodeType === 'text') {
      html += child.textContent;
    } else if (child.nodeType === 'element') {
      html += getOuterHTML(child);
    }
  }
  return html;
}

/**
 * Get the outer HTML of an element
 *
 * @param element The element to get outer HTML from
 * @return string
 **/
function getOuterHTML(element: VElement): string {
  let html = "<" + element.tagName.toLowerCase();
  
  // Add attributes
  for (const attrName in element.attributes) {
    html += ` ${attrName}="${element.attributes[attrName]}"`;
  }
  
  html += ">";
  
  // Add inner HTML
  html += getInnerHTML(element);
  
  // Add closing tag
  html += "</" + element.tagName.toLowerCase() + ">";
  
  return html;
}

/**
 * Get the inner text of a node
 *
 * @param element The element to get inner text from
 * @param normalizeSpaces Whether to normalize spaces
 * @return string
 **/
function getInnerText(element: VElement, normalizeSpaces: boolean = true): string {
  let text = "";
  
  for (const child of element.children) {
    if (child.nodeType === 'text') {
      text += child.textContent;
    } else if (child.nodeType === 'element') {
      text += getInnerText(child, false);
    }
  }
  
  // Normalize spaces
  text = text.trim();
  if (normalizeSpaces) {
    text = text.replace(/\s{2,}/g, " ");
  }
  
  return text;
}

/**
 * Get the number of times a string s appears in the node e.
 *
 * @param element The element to search in
 * @param s The string to search for
 * @return number
 **/
function getCharCount(element: VElement, s: string = ","): number {
  return getInnerText(element).split(s).length - 1;
}

/**
 * Get an elements class/id weight. Uses regular expressions to tell if this
 * element looks good or bad.
 *
 * @param element The element to get weight for
 * @return number (Integer)
 **/
function getClassWeight(element: VElement): number {
  let weight = 0;

  // Look for a special classname
  if (element.className) {
    if (REGEXPS.negative.test(element.className)) {
      weight -= 25;
    }

    if (REGEXPS.positive.test(element.className)) {
      weight += 25;
    }
  }

  // Look for a special ID
  if (element.id) {
    if (REGEXPS.negative.test(element.id)) {
      weight -= 25;
    }

    if (REGEXPS.positive.test(element.id)) {
      weight += 25;
    }
  }

  return weight;
}

/**
 * Check if a given node has one of its ancestor tag name matching the
 * provided one.
 *
 * @param node The node to check
 * @param tagName The tag name to look for
 * @param maxDepth The maximum depth to search
 * @param filterFn A filter function to apply to ancestors
 * @return boolean
 **/
function hasAncestorTag(
  node: VElement,
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
 * Remove a node
 *
 * @param node The node to remove
 **/
export function remove(node: VElement): void {
  const nextNode = getNextNode(node, true);
  
  if (node.parent) {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      node.parent.children.splice(index, 1);
    }
  }
}

/**
 * Remove a node and get the next node in the traversal
 *
 * @param node The node to remove
 * @return The next node in the traversal
 **/
function removeAndGetNext(node: VElement): VElement | null {
  const nextNode = getNextNode(node, true);
  
  if (node.parent) {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      node.parent.children.splice(index, 1);
    }
  }
  
  return nextNode;
}

/**
 * Iterates over a NodeList, and calls _setNodeTag for each node.
 *
 * @param nodeList The nodes to operate on
 * @param newTagName the new tag name to use
 * @return void
 */
function replaceNodeTags(nodeList: VElement[], newTagName: string): void {
  for (const node of nodeList) {
    setNodeTag(node, newTagName);
  }
}

/**
 * Fix images with data-src or data-srcset attributes
 *
 * @param element The element to fix images in
 * @return void
 **/
function fixLazyImages(element: VElement): void {
  forEachNode(
    getAllNodesWithTag(element, ["img", "picture", "figure"]),
    function(elem) {
      // Check for base64 data URIs in src
      const src = getAttribute(elem, "src");
      if (src && REGEXPS.b64DataUrl.test(src)) {
        // Make sure it's not SVG, which can have a meaningful image in under 133 bytes
        const parts = REGEXPS.b64DataUrl.exec(src);
        if (parts && parts[1] === "image/svg+xml") {
          return;
        }

        // Check if this element has other attributes which contains image
        let srcCouldBeRemoved = false;
        for (const attrName in elem.attributes) {
          if (attrName === "src") {
            continue;
          }

          if (/\.(jpg|jpeg|png|webp)/i.test(elem.attributes[attrName])) {
            srcCouldBeRemoved = true;
            break;
          }
        }

        // If image is less than 100 bytes (or 133 after encoded to base64)
        // it will be too small, therefore it might be placeholder image
        if (srcCouldBeRemoved) {
          const b64starts = parts ? parts[0].length : 0;
          const b64length = src.length - b64starts;
          if (b64length < 133) {
            delete elem.attributes["src"];
          }
        }
      }

      // Check for data-src/data-srcset attributes
      if (
        (src || getAttribute(elem, "srcset")) &&
        !elem.className?.toLowerCase().includes("lazy")
      ) {
        return;
      }

      for (const attrName in elem.attributes) {
        if (
          attrName === "src" ||
          attrName === "srcset" ||
          attrName === "alt"
        ) {
          continue;
        }

        const attrValue = elem.attributes[attrName];
        let copyTo = null;

        if (/\.(jpg|jpeg|png|webp)\s+\d/.test(attrValue)) {
          copyTo = "srcset";
        } else if (/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(attrValue)) {
          copyTo = "src";
        }

        if (copyTo) {
          // If this is an img or picture, set the attribute directly
          if (elem.tagName === "IMG" || elem.tagName === "PICTURE") {
            elem.attributes[copyTo] = attrValue;
          } else if (
            elem.tagName === "FIGURE" &&
            getAllNodesWithTag(elem, ["img", "picture"]).length === 0
          ) {
            // If the item is a <figure> that does not contain an image or picture,
            // create one and place it inside the figure
            const img = {
              nodeType: 'element' as const,
              tagName: "IMG",
              attributes: { [copyTo]: attrValue },
              children: [],
              parent: elem
            };
            elem.children.push(img);
          }
        }
      }
    }
  );
}
