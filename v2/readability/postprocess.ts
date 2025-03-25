/*
 * Post-processing functions for readability
 * These functions clean up and enhance the extracted article content
 */

import {
  getAttribute,
  setAttribute,
  removeAttribute,
  getElementsByTagName,
  forEachNode,
  someNode,
  getNextNode as vdomGetNextNode,
  removeAndGetNext as vdomRemoveAndGetNext
} from '../vdom.ts';

import {
  REGEXPS,
  CLASSES_TO_PRESERVE
} from '../constants.ts';
import type { VElement, VTextNode } from '../types.ts';

/**
 * Run any post-process modifications to article content as necessary.
 *
 * @param articleContent The article element to process
 * @param options Processing options
 * @return void
 **/
export function postProcessContent(
  articleContent: VElement, 
  options: { 
    keepClasses?: boolean, 
    classesToPreserve?: string[],
    baseURI?: string,
    documentURI?: string
  }
): void {
  // Readability cannot open relative uris so we convert them to absolute uris.
  fixRelativeUris(articleContent, options.baseURI, options.documentURI);

  simplifyNestedElements(articleContent);

  if (!options.keepClasses) {
    // Remove classes.
    cleanClasses(articleContent, options.classesToPreserve || CLASSES_TO_PRESERVE);
  }
}

/**
 * Removes the class="" attribute from every element in the given
 * subtree, except those that match CLASSES_TO_PRESERVE and
 * the classesToPreserve array from the options object.
 *
 * @param node The element to clean classes from
 * @param classesToPreserve Array of classes to preserve
 * @return void
 */
export function cleanClasses(node: VElement, classesToPreserve: string[]): void {
  const className = (getAttribute(node, "class") || "")
    .split(/\s+/)
    .filter(cls => cls && classesToPreserve.includes(cls))
    .join(" ");

  if (className) {
    setAttribute(node, "class", className);
  } else {
    removeAttribute(node, "class");
  }

  // 子要素のうち、element型のものだけを処理
  const elementChildren = node.children.filter(child => child.nodeType === 'element') as VElement[];
  elementChildren.forEach(child => cleanClasses(child, classesToPreserve));
}

/**
 * Tests whether a string is a URL or not.
 *
 * @param str The string to test
 * @return true if str is a URL, false if not
 */
export function isUrl(str: string): boolean {
  if (!str) return false;
  
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
 * @param baseURI Base URI to resolve against
 * @param documentURI Document URI for comparison
 * @return void
 */
export function fixRelativeUris(
  articleContent: VElement, 
  baseURI?: string, 
  documentURI?: string
): void {
  if (!baseURI) return;
  
  const toAbsoluteURI = (uri: string): string => {
    // Leave hash links alone if the base URI matches the document URI:
    if (baseURI === documentURI && uri.charAt(0) === "#") {
      return uri;
    }

    // Otherwise, resolve against base URI:
    try {
      return new URL(uri, baseURI).href;
    } catch (ex) {
      // Something went wrong, log the error and return the original
      console.error(`Error resolving URL: ${uri} against base ${baseURI}`, ex);
    }
    return uri;
  };

  // Fix links
  const links = getElementsByTagName(articleContent, "a");
  forEachNode(links, function(link) {
    const href = getAttribute(link, "href");
    if (href) {
      // Remove links with javascript: URIs, since
      // they won't work after scripts have been removed from the page.
      if (href.indexOf("javascript:") === 0) {
        // if the link only contains simple text content, it can be converted to a text node
        if (
          link.children.length === 1 &&
          link.children[0].nodeType === 'text'
        ) {
          const text: VTextNode = {
            nodeType: 'text',
            textContent: link.children[0].textContent,
            parent: link.parent
          };
          
          if (link.parent) {
            const index = link.parent.children.indexOf(link);
            if (index !== -1) {
              link.parent.children[index] = text;
            }
          }
        } else {
          // if the link has multiple children, they should all be preserved
          // by moving them up to the parent
          if (link.parent) {
            const index = link.parent.children.indexOf(link);
            if (index !== -1) {
              // Replace the link with its children
              link.parent.children.splice(index, 1, ...link.children);
              
              // Update parent references
              for (const child of link.children) {
                child.parent = link.parent;
              }
            }
          }
        }
      } else {
        setAttribute(link, "href", toAbsoluteURI(href));
      }
    }
  });

  // Fix media elements
  const medias = getElementsByTagName(articleContent, [
    "img",
    "picture",
    "figure",
    "video",
    "audio",
    "source",
  ]);

  forEachNode(medias, function(media) {
    const src = getAttribute(media, "src");
    const poster = getAttribute(media, "poster");
    const srcset = getAttribute(media, "srcset");

    if (src) {
      setAttribute(media, "src", toAbsoluteURI(src));
    }

    if (poster) {
      setAttribute(media, "poster", toAbsoluteURI(poster));
    }

    if (srcset) {
      const newSrcset = srcset.replace(
        REGEXPS.srcsetUrl,
        function(_, p1, p2, p3) {
          return toAbsoluteURI(p1) + (p2 || "") + p3;
        }
      );

      setAttribute(media, "srcset", newSrcset);
    }
  });
}

/**
 * Simplifies nested elements like DIVs and SECTIONs that have only one child
 * block element, replacing the parent with the child.
 *
 * @param articleContent The element to process
 * @return void
 */
export function simplifyNestedElements(articleContent: VElement): void {
  let node: VElement | null = articleContent;

  while (node) {
    if (
      node.parent &&
      ["DIV", "SECTION"].includes(node.tagName) &&
      !(node.id && node.id.startsWith("readability"))
    ) {
      if (isElementWithoutContent(node)) {
        // Remove empty nodes
        const next = removeAndGetNext(node);
        node = next;
        continue;
      } else if (
        hasSingleTagInsideElement(node, "DIV") ||
        hasSingleTagInsideElement(node, "SECTION")
      ) {
        // If node has only one child of the same type, replace node with its child
        const child = node.children[0] as VElement;
        
        // Copy attributes from parent to child
        for (const attrName in node.attributes) {
          if (node.attributes.hasOwnProperty(attrName)) {
            setAttribute(child, attrName, node.attributes[attrName]);
          }
        }
        
        if (node.parent) {
          const index = node.parent.children.indexOf(node);
          if (index !== -1) {
            node.parent.children[index] = child;
            child.parent = node.parent;
          }
        }
        
        node = child;
        continue;
      }
    }

    // Move to next node
    const nextNode = getNextNode(node);
    node = nextNode as VElement;
  }
}

/**
 * Checks if an element has no content (no text and only BR or HR elements)
 */
export function isElementWithoutContent(node: VElement): boolean {
  // 子要素がない場合は空と見なす
  if (node.children.length === 0) return true;
  
  // テキストノードがあるかチェック
  const hasTextContent = someNode(node.children, child => 
    child.nodeType === 'text' && child.textContent.trim().length > 0
  );
  
  if (hasTextContent) return false;
  
  // BR/HR以外の要素があるかチェック
  const hasNonBrHrElement = someNode(node.children, child => 
    child.nodeType === 'element' && child.tagName !== 'BR' && child.tagName !== 'HR'
  );
  
  // テキストがなく、BR/HR以外の要素もない場合は空と見なす
  return !hasNonBrHrElement;
}

/**
 * Check if this node has only one child element with the specified tag
 * and no text content
 */
export function hasSingleTagInsideElement(element: VElement, tag: string): boolean {
  // 子要素が1つだけであることを確認
  if (element.children.length !== 1) return false;
  
  const child = element.children[0];
  
  // 子要素が指定されたタグの要素であることを確認
  if (child.nodeType !== 'element' || child.tagName !== tag) return false;
  
  // テキストノードがないか、あっても空であることを確認
  const textNodes = element.children.filter(node => 
    node.nodeType === 'text' && node.textContent.trim().length > 0
  );
  
  return textNodes.length === 0;
}

/**
 * Get the next node in a tree traversal
 * This is a wrapper around the vdom getNextNode function to maintain API compatibility
 */
export function getNextNode(node: VElement, ignoreSelfAndKids?: boolean): VElement | null {
  const nextNode = vdomGetNextNode(node, ignoreSelfAndKids);
  return nextNode && nextNode.nodeType === 'element' ? nextNode as VElement : null;
}

/**
 * Remove a node and get the next node in the traversal
 * This is a wrapper around the vdom removeAndGetNext function to maintain API compatibility
 */
export function removeAndGetNext(node: VElement): VElement | null {
  const nextNode = vdomRemoveAndGetNext(node);
  return nextNode && nextNode.nodeType === 'element' ? nextNode as VElement : null;
}
