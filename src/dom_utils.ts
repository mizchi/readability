/**
 * DOM Utilities
 * 
 * Modern implementations of DOM manipulation functions used in Readability.
 * This file contains refactored versions of DOM utility functions from the
 * original ARC90 implementation, updated to use modern DOM APIs.
 */

import {
  ELEMENT_NODE,
  TEXT_NODE,
  REGEXPS,
  UNLIKELY_ROLES,
  DIV_TO_P_ELEMS,
  ALTER_TO_DIV_EXCEPTIONS,
  PRESENTATIONAL_ATTRIBUTES,
  DEPRECATED_SIZE_ATTRIBUTE_ELEMS,
  PHRASING_ELEMS,
  CLASSES_TO_PRESERVE,
  HTML_ESCAPE_MAP
} from './constants';

/**
 * Type guard to check if an Element is an HTMLElement
 * 
 * @param node The element to check
 * @return Boolean indicating if the element is an HTMLElement
 */
export function isHTMLElement(node: Element | Node): node is HTMLElement {
  return node instanceof HTMLElement;
}

/**
 * Converts a NodeList to an Element array
 * 
 * @param nodeList The NodeList to convert
 * @return An array of Elements
 */
export function toElementArray(nodeList: NodeListOf<Element> | Element[]): Element[] {
  return Array.from(nodeList);
}

/**
 * Iterates over an array of Elements, calls `filterFn` for each node and removes node
 * if function returned `true`.
 *
 * @param nodeList The nodes to operate on
 * @param filterFn the function to use as a filter
 * @return void
 */
export function removeNodes(
  nodeList: NodeListOf<Element> | Element[], 
  filterFn?: (node: Element, index: number, nodeList: Element[]) => boolean,
  docJSDOMParser?: any
): void {
  // Avoid ever operating on live node lists.
  if (docJSDOMParser && (nodeList as any)._isLiveNodeList) {
    throw new Error("Do not pass live node lists to removeNodes");
  }
  
  const elements = toElementArray(nodeList);
  
  for (let i = elements.length - 1; i >= 0; i--) {
    const node = elements[i];
    const parentNode = node.parentNode;
    if (parentNode) {
      if (!filterFn || filterFn.call(null, node, i, elements)) {
        parentNode.removeChild(node);
      }
    }
  }
}

/**
 * Iterates over an array of Elements, and calls setNodeTag for each node.
 *
 * @param nodeList The nodes to operate on
 * @param newTagName the new tag name to use
 * @param docJSDOMParser Optional JSDOM parser reference
 * @return void
 */
export function replaceNodeTags(
  nodeList: NodeListOf<Element> | Element[], 
  newTagName: string,
  docJSDOMParser?: any
): void {
  // Avoid ever operating on live node lists.
  if (docJSDOMParser && (nodeList as any)._isLiveNodeList) {
    throw new Error("Do not pass live node lists to replaceNodeTags");
  }
  
  toElementArray(nodeList).forEach(node => {
    setNodeTag(node, newTagName, docJSDOMParser);
  });
}

/**
 * Iterate over an array of nodes.
 *
 * @param nodeList The NodeList or array of nodes.
 * @param fn The iterate function.
 * @return void
 */
export function forEachNode(
  nodeList: NodeListOf<Element> | Element[] | NodeListOf<Node> | Node[], 
  fn: (node: Element | Node, index: number, list: Element[] | Node[]) => void
): void {
  Array.from(nodeList).forEach(fn);
}

/**
 * Iterate over a NodeList or array, and return the first node that passes
 * the supplied test function
 *
 * @param nodeList The NodeList or array of nodes.
 * @param fn The test function.
 * @return The found node or undefined
 */
export function findNode(
  nodeList: NodeListOf<Element> | Element[] | NodeListOf<Node> | Node[], 
  fn: (node: Element | Node, index: number, list: Element[] | Node[]) => boolean
): Element | Node | undefined {
  return Array.from(nodeList).find(fn);
}

/**
 * Iterate over a NodeList or array, return true if any of the provided iterate
 * function calls returns true, false otherwise.
 *
 * @param nodeList The NodeList or array of nodes.
 * @param fn The iterate function.
 * @return Boolean
 */
export function someNode(
  nodeList: NodeListOf<Element> | Element[] | NodeListOf<Node> | Node[], 
  fn: (node: Element | Node, index: number, list: Element[] | Node[]) => boolean
): boolean {
  return Array.from(nodeList).some(fn);
}

/**
 * Iterate over a NodeList or array, return true if all of the provided iterate
 * function calls return true, false otherwise.
 *
 * @param nodeList The NodeList or array of nodes.
 * @param fn The iterate function.
 * @return Boolean
 */
export function everyNode(
  nodeList: NodeListOf<Element> | Element[] | NodeListOf<Node> | Node[], 
  fn: (node: Element | Node, index: number, list: Element[] | Node[]) => boolean
): boolean {
  return Array.from(nodeList).every(fn);
}

/**
 * Get all nodes with a given tag name.
 *
 * @param node The root node to start searching from
 * @param tagNames An array of tag names to search for
 * @return An array of matching elements
 */
export function getAllNodesWithTag(node: Element | Document, tagNames: string[]): Element[] {
  if (node.querySelectorAll) {
    return Array.from(node.querySelectorAll(tagNames.join(",")));
  }
  
  return tagNames.flatMap(tag => {
    const collection = node.getElementsByTagName(tag);
    return Array.from(collection);
  });
}

/**
 * Removes the class="" attribute from every element in the given
 * subtree, except those that match CLASSES_TO_PRESERVE and
 * the classesToPreserve array from the options object.
 *
 * @param node The element to clean classes from
 * @param classesToPreserve Array of class names to preserve
 * @return void
 */
export function cleanClasses(node: Element, classesToPreserve: string[]): void {
  const className = (node.getAttribute("class") || "")
    .split(/\s+/)
    .filter(cls => classesToPreserve.includes(cls))
    .join(" ");

  if (className) {
    node.setAttribute("class", className);
  } else {
    node.removeAttribute("class");
  }

  // Use children instead of childNodes to only get element nodes
  Array.from(node.children).forEach(child => {
    cleanClasses(child as Element, classesToPreserve);
  });
}

/**
 * Tests whether a string is a URL or not.
 *
 * @param str The string to test
 * @return true if str is a URL, false if not
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts each <a> and <img> uri in the given element to an absolute URI,
 * ignoring #ref URIs.
 *
 * @param articleContent The element to process
 * @param doc The document
 * @return void
 */
export function fixRelativeUris(articleContent: Element, doc: Document): void {
  const baseURI = doc.baseURI;
  const documentURI = doc.documentURI;
  
  const toAbsoluteURI = (uri: string): string => {
    // Leave hash links alone if the base URI matches the document URI:
    if (baseURI == documentURI && uri.charAt(0) == "#") {
      return uri;
    }

    // Otherwise, resolve against base URI:
    try {
      return new URL(uri, baseURI).href;
    } catch (ex) {
      // Something went wrong, just return the original:
    }
    return uri;
  };

  // Process links
  const links = getAllNodesWithTag(articleContent, ["a"]);
  forEachNode(links, function(link) {
    const href = (link as Element).getAttribute("href");
    if (href) {
      // Remove links with javascript: URIs, since
      // they won't work after scripts have been removed from the page.
      if (href.indexOf("javascript:") === 0) {
        // if the link only contains simple text content, it can be converted to a text node
        if (
          link.childNodes.length === 1 &&
          link.childNodes[0].nodeType === TEXT_NODE
        ) {
          const text = doc.createTextNode(link.textContent || "");
          if (link.parentNode) {
            link.parentNode.replaceChild(text, link);
          }
        } else {
          // if the link has multiple children, they should all be preserved
          const container = doc.createElement("span");
          while (link.firstChild) {
            container.appendChild(link.firstChild);
          }
          if (link.parentNode) {
            link.parentNode.replaceChild(container, link);
          }
        }
      } else {
        (link as Element).setAttribute("href", toAbsoluteURI(href));
      }
    }
  });

  // Process media elements
  const medias = getAllNodesWithTag(articleContent, [
    "img",
    "picture",
    "figure",
    "video",
    "audio",
    "source",
  ]);

  forEachNode(medias, function(media) {
    const mediaElement = media as Element;
    const src = mediaElement.getAttribute("src");
    const poster = mediaElement.getAttribute("poster");
    const srcset = mediaElement.getAttribute("srcset");

    if (src) {
      mediaElement.setAttribute("src", toAbsoluteURI(src));
    }

    if (poster) {
      mediaElement.setAttribute("poster", toAbsoluteURI(poster));
    }

    if (srcset) {
      const newSrcset = srcset.replace(
        REGEXPS.srcsetUrl,
        function(_, p1, p2, p3) {
          return toAbsoluteURI(p1) + (p2 || "") + p3;
        }
      );

      mediaElement.setAttribute("srcset", newSrcset);
    }
  });
}

/**
 * Simplifies nested elements such as divs with only one child block element.
 *
 * @param articleContent The element to simplify
 * @return void
 */
export function simplifyNestedElements(articleContent: Element): void {
  let node: Element | null = articleContent;

  while (node) {
    if (
      node.parentNode &&
      ["DIV", "SECTION"].includes(node.tagName) &&
      !(node.id && node.id.startsWith("readability"))
    ) {
      if (isElementWithoutContent(node)) {
        node = removeAndGetNext(node);
        continue;
      } else if (
        hasSingleTagInsideElement(node, "DIV") ||
        hasSingleTagInsideElement(node, "SECTION")
      ) {
        const child = node.children[0];
        for (let i = 0; i < node.attributes.length; i++) {
          child.setAttributeNode(node.attributes[i].cloneNode() as Attr);
        }
        if (node.parentNode) {
          node.parentNode.replaceChild(child, node);
          node = child;
          continue;
        }
      }
    }

    node = getNextNode(node);
  }
}

/**
 * Changes the tag name of an element.
 *
 * @param node The element to change tag name of
 * @param tagName The new tag name
 * @param docJSDOMParser Optional JSDOM parser reference
 * @return The new element with the changed tag name
 */
export function setNodeTag(node: Element, tagName: string, docJSDOMParser?: any): Element {
  if (docJSDOMParser) {
    // Using JSDOM-specific approach
    // We can't directly modify localName and tagName as they're read-only
    // This is a workaround for JSDOM environments
    return docJSDOMParser.setNodeTagName(node, tagName) || node;
  }

  const replacement = node.ownerDocument.createElement(tagName);
  while (node.firstChild) {
    replacement.appendChild(node.firstChild);
  }
  if (node.parentNode) {
    node.parentNode.replaceChild(replacement, node);
  }
  
  // Copy attributes
  for (let i = 0; i < node.attributes.length; i++) {
    try {
      replacement.setAttributeNode(node.attributes[i].cloneNode() as Attr);
    } catch (e) {
      // If attribute cloning fails, try direct attribute copying
      replacement.setAttribute(
        node.attributes[i].name,
        node.attributes[i].value
      );
    }
  }
  
  // Copy readability data if it exists
  if ((node as any).readability) {
    (replacement as any).readability = (node as any).readability;
  }
  
  return replacement;
}

/**
 * Removes a node and returns the next node in the traversal.
 *
 * @param node The node to remove
 * @return The next node in the traversal
 */
export function removeAndGetNext(node: Element): Element | null {
  const nextNode = getNextNode(node, true);
  node.remove();
  return nextNode;
}

/**
 * Traverse the DOM from node to node, starting at the node passed in.
 * Pass true for the second parameter to indicate this node itself
 * (and its kids) are going away, and we want the next node over.
 *
 * Calling this in a loop will traverse the DOM depth-first.
 *
 * @param node The element to start traversal from
 * @param ignoreSelfAndKids Whether to ignore this node and its children
 * @return The next node in the traversal
 */
export function getNextNode(node: Element, ignoreSelfAndKids?: boolean): Element | null {
  // First check for kids if those aren't being ignored
  if (!ignoreSelfAndKids && node.firstElementChild) {
    return node.firstElementChild;
  }
  
  // Then for siblings...
  if (node.nextElementSibling) {
    return node.nextElementSibling;
  }
  
  // And finally, move up the parent chain *and* find a sibling
  // (because this is depth-first traversal, we will have already
  // seen the parent nodes themselves).
  let parent = node.parentNode as Element;
  while (parent && !parent.nextElementSibling) {
    parent = parent.parentNode as Element;
  }
  
  return parent ? parent.nextElementSibling : null;
}

/**
 * Gets the ancestors of a node up to a specified depth
 * 
 * @param node The node to get ancestors for
 * @param maxDepth Maximum depth of ancestors to return (0 means no limit)
 * @return Array of ancestor nodes
 */
export function getNodeAncestors(node: Node, maxDepth: number = 0): Node[] {
  const ancestors: Node[] = [];
  let i = 0;
  
  while (node.parentNode) {
    ancestors.push(node.parentNode);
    if (maxDepth && ++i === maxDepth) {
      break;
    }
    node = node.parentNode;
  }
  
  return ancestors;
}

/**
 * Find all <noscript> that are located after <img> nodes, and which contain only one
 * <img> element. Replace the first image with the image from inside the <noscript> tag,
 * and remove the <noscript> tag. This improves the quality of the images we use on
 * some sites (e.g. Medium).
 *
 * @param doc The document to process
 * @return void
 */
export function unwrapNoscriptImages(doc: Element): void {
  // Find img without source or attributes that might contains image, and remove it.
  // This is done to prevent a placeholder img is replaced by img from noscript in next step.
  const imgs = Array.from(doc.getElementsByTagName("img"));
  forEachNode(imgs, function(img) {
    if (!isHTMLElement(img)) return;
    
    const imgElement = img as HTMLImageElement;
    let hasImageAttributes = false;
    
    for (let i = 0; i < imgElement.attributes.length; i++) {
      const attr = imgElement.attributes[i];
      switch (attr.name) {
        case "src":
        case "srcset":
        case "data-src":
        case "data-srcset":
          hasImageAttributes = true;
          return;
      }

      if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
        hasImageAttributes = true;
        return;
      }
    }

    if (!hasImageAttributes) {
      imgElement.remove();
    }
  });

  // Next find noscript and try to extract its image
  const noscripts = Array.from(doc.getElementsByTagName("noscript"));
  forEachNode(noscripts, function(noscript) {
    // We need to ensure noscript is an Element
    if (!(noscript instanceof Element)) return;
    
    // Parse content of noscript and make sure it only contains image
    if (!isSingleImage(noscript)) {
      return;
    }
    
    const tmp = doc.ownerDocument?.createElement("div") || document.createElement("div");
    // We're running in the document context, and using unmodified
    // document contents, so doing this should be safe.
    tmp.innerHTML = noscript.innerHTML;

    // If noscript has previous sibling and it only contains image,
    // replace it with noscript content. However we also keep old
    // attributes that might contains image.
    const prevElement = noscript.previousElementSibling;
    if (prevElement && isSingleImage(prevElement)) {
      let prevImg = prevElement;
      if (prevImg.tagName !== "IMG") {
        prevImg = prevElement.getElementsByTagName("img")[0];
      }

      const newImg = tmp.getElementsByTagName("img")[0];
      for (let i = 0; i < prevImg.attributes.length; i++) {
        const attr = prevImg.attributes[i];
        if (attr.value === "") {
          continue;
        }

        if (
          attr.name === "src" ||
          attr.name === "srcset" ||
          /\.(jpg|jpeg|png|webp)/i.test(attr.value)
        ) {
          if (newImg.getAttribute(attr.name) === attr.value) {
            continue;
          }

          let attrName = attr.name;
          if (newImg.hasAttribute(attrName)) {
            attrName = "data-old-" + attrName;
          }
          newImg.setAttribute(attrName, attr.value);
        }
      }

      if (noscript.parentNode) {
        noscript.parentNode.replaceChild(tmp.firstElementChild!, prevElement);
      }
    }
  });
}

/**
 * Check if node is image, or if node contains exactly only one image
 * whether as a direct child or as its descendants.
 *
 * @param node The node to check
 * @return Boolean indicating if this is a single image
 */
export function isSingleImage(node: Node): boolean {
  let currentNode: Node | null = node;
  
  while (currentNode) {
    if ((currentNode as Element).tagName === "IMG") {
      return true;
    }
    
    if ((currentNode as Element).children && (currentNode as Element).children.length !== 1 || 
        currentNode.textContent && currentNode.textContent.trim() !== "") {
      return false;
    }
    
    currentNode = (currentNode as Element).children?.[0] || null;
  }
  
  return false;
}

/**
 * Removes script tags from the document.
 *
 * @param doc The document to process
 * @return void
 */
export function removeScripts(doc: Element): void {
  removeNodes(getAllNodesWithTag(doc, ["script", "noscript"]));
}

/**
 * Check if this node has only whitespace and a single element with given tag
 * Returns false if the DIV node contains non-empty text nodes
 * or if it contains no element with given tag or more than 1 element.
 *
 * @param element The element to check
 * @param tag The tag name to look for
 * @return Boolean indicating if this element has a single tag inside
 */
export function hasSingleTagInsideElement(element: Element, tag: string): boolean {
  // There should be exactly 1 element child with given tag
  if (element.children.length != 1 || element.children[0].tagName !== tag) {
    return false;
  }

  // And there should be no text nodes with real content
  return !someNode(element.childNodes, function(node) {
    return (
      node.nodeType === TEXT_NODE &&
      REGEXPS.hasContent.test(node.textContent || "")
    );
  });
}

/**
 * Determines if an element has no content or only whitespace.
 *
 * @param node The element to check
 * @return Boolean indicating if the element is empty
 */
export function isElementWithoutContent(node: Element): boolean {
  return (
    node.nodeType === ELEMENT_NODE &&
    !node.textContent?.trim().length &&
    (!node.children.length ||
      node.children.length ==
        node.getElementsByTagName("br").length +
          node.getElementsByTagName("hr").length)
  );
}

/**
 * Determine whether element has any children block level elements.
 *
 * @param element The element to check
 * @return Boolean indicating if the element has child blocks
 */
export function hasChildBlockElement(element: Element): boolean {
  return someNode(element.childNodes, function(node) {
    if (node.nodeType === ELEMENT_NODE) {
      const childElement = node as Element;
      if (childElement.tagName && DIV_TO_P_ELEMS.has(childElement.tagName)) {
        return true;
      }
      return hasChildBlockElement(childElement);
    }
    return false;
  });
}

/**
 * Determine if a node qualifies as phrasing content.
 * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Phrasing_content
 *
 * @param node The node to check
 * @return Boolean indicating if the node is phrasing content
 */
export function isPhrasingContent(node: Node): boolean {
  if (node.nodeType === TEXT_NODE) {
    return true;
  }
  
  if (node.nodeType === ELEMENT_NODE) {
    const element = node as Element;
    if (PHRASING_ELEMS.includes(element.tagName)) {
      return true;
    }
    
    if (
      element.tagName === "A" ||
      element.tagName === "DEL" ||
      element.tagName === "INS"
    ) {
      return everyNode(node.childNodes, isPhrasingContent);
    }
  }
  
  return false;
}

/**
 * Determine if a node is whitespace or a BR element.
 *
 * @param node The node to check
 * @return Boolean indicating if the node is whitespace
 */
export function isWhitespace(node: Node): boolean {
  return (
    (node.nodeType === ELEMENT_NODE &&
      (node.textContent?.trim().length === 0 || !node.textContent)) ||
    (node.nodeType === ELEMENT_NODE && (node as Element).tagName === "BR")
  );
}

/**
 * Get the inner text of a node - cross browser compatibly.
 * This also strips out any excess whitespace to be found.
 *
 * @param element The element to get the text from
 * @param normalizeSpaces Whether to normalize spaces
 * @return The text content of the element
 */
export function getInnerText(element: Element, normalizeSpaces: boolean = true): string {
  const textContent = element.textContent?.trim() || "";

  if (normalizeSpaces) {
    return textContent.replace(REGEXPS.normalize, " ");
  }
  
  return textContent;
}

/**
 * Remove the style attribute on every element and under.
 * Also removes deprecated presentational attributes.
 *
 * @param element The element to clean styles from
 * @return void
 */
export function cleanStyles(element: Element): void {
  if (!element || (element as Element).tagName?.toLowerCase() === "svg") {
    return;
  }

  // Remove `style` and deprecated presentational attributes
  for (let i = 0; i < PRESENTATIONAL_ATTRIBUTES.length; i++) {
    element.removeAttribute(PRESENTATIONAL_ATTRIBUTES[i]);
  }

  if (DEPRECATED_SIZE_ATTRIBUTE_ELEMS.includes((element as Element).tagName)) {
    element.removeAttribute("width");
    element.removeAttribute("height");
  }

  // Clean styles from all child elements
  Array.from(element.children).forEach(child => {
    cleanStyles(child as Element);
  });
}

/**
 * Determines if an element is probably visible to the user.
 *
 * @param node The element to check
 * @return Boolean indicating if the element is probably visible
 */
export function isProbablyVisible(node: HTMLElement): boolean {
  // Have to null-check node.style and node.className.includes to deal with SVG and MathML nodes.
  return (
    (!node.style || node.style.display != "none") &&
    (!node.style || node.style.visibility != "hidden") &&
    !node.hasAttribute("hidden") &&
    //check for "fallback-image" so that wikimedia math images are displayed
    !!(!node.hasAttribute("aria-hidden") ||
      node.getAttribute("aria-hidden") != "true" ||
      (node.className &&
        typeof node.className === 'string' &&
        node.className.includes("fallback-image")))
  );
}
