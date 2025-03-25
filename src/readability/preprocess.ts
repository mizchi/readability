/*
 * Document preprocessing functions for readability
 * These functions prepare the document for content extraction
 */

import {
  getAttribute,
  setAttribute,
  removeAttribute,
  getElementsByTagName,
  getNextNode,
  forEachNode,
  someNode,
  isWhitespace,
  isPhrasingContent,
  createVElement,
  isVElement,
  isVTextNode
} from '../vdom.ts';

import type { VDocument, VElement, VNode, VTextNode } from '../types.ts';

/**
 * Prepare the HTML document for readability to scrape it.
 * This includes things like stripping javascript, CSS, and handling terrible markup.
 *
 * @param doc The document to prepare
 * @return void
 **/
export function prepDocument(doc: VDocument): void {
  // Remove all style tags in head
  removeNodes(getAllNodesWithTag(doc.documentElement, ["style"]));

  if (doc.body) {
    replaceBrs(doc.body);
  }

  replaceNodeTags(getAllNodesWithTag(doc.documentElement, ["font"]), "SPAN");
}

/**
 * Finds the next node, starting from the given node, and ignoring
 * whitespace in between. If the given node is an element, the same node is
 * returned.
 */
export function nextNode(node: VNode): VNode | null {
  let next: VNode | null = node;
  while (
    next &&
    !isVElement(next) &&
    isVTextNode(next) &&
    isWhitespace(next)
  ) {
    next = getNextNode(next);
  }
  return next;
}

/**
 * Replaces 2 or more successive <br> elements with a single <p>.
 * Whitespace between <br> elements are ignored. For example:
 *   <div>foo<br>bar<br> <br><br>abc</div>
 * will become:
 *   <div>foo<br>bar<p>abc</p></div>
 */
export function replaceBrs(elem: VElement): void {
  forEachNode(getAllNodesWithTag(elem, ["br"]), function(br: VElement) {
    let next: VNode | null = br.parent?.children.indexOf(br) !== undefined 
      ? br.parent?.children[br.parent?.children.indexOf(br) + 1] 
      : null;

    // Whether 2 or more <br> elements have been found and replaced with a
    // <p> block.
    let replaced = false;

    // If we find a <br> chain, remove the <br>s until we hit another node
    // or non-whitespace. This leaves behind the first <br> in the chain
    // (which will be replaced with a <p> later).
    while ((next = nextNode(next as VNode)) && isVElement(next) && next.tagName == "BR") {
      replaced = true;
      const brSibling = next.parent?.children.indexOf(next) !== undefined
        ? next.parent?.children[next.parent?.children.indexOf(next) + 1]
        : null;
      
      // Remove the br
      if (next.parent) {
        const index = next.parent.children.indexOf(next);
        if (index !== -1) {
          next.parent.children.splice(index, 1);
        }
      }
      
      next = brSibling;
    }

    // If we removed a <br> chain, replace the remaining <br> with a <p>. Add
    // all sibling nodes as children of the <p> until we hit another <br>
    // chain.
    if (replaced) {
      const p = createVElement("P");
      p.parent = br.parent;
      
      if (br.parent) {
        const brIndex = br.parent.children.indexOf(br);
        if (brIndex !== -1) {
          br.parent.children[brIndex] = p;
        }
      }

      next = p.parent?.children.indexOf(p) !== undefined
        ? p.parent?.children[p.parent?.children.indexOf(p) + 1]
        : null;
        
      while (next) {
        // If we've hit another <br><br>, we're done adding children to this <p>.
        if (isVElement(next) && next.tagName == "BR") {
          const nextElem = nextNode(getNextNode(next)!);
          if (nextElem && isVElement(nextElem) && nextElem.tagName == "BR") {
            break;
          }
        }

        if (!isPhrasingContent(next)) {
          break;
        }

        // Otherwise, make this node a child of the new <p>.
        const sibling = next.parent?.children.indexOf(next as VElement | VTextNode) !== undefined
          ? next.parent?.children[next.parent?.children.indexOf(next as VElement | VTextNode) + 1]
          : null;
          
        // 型ガードを使用して適切な型のノードを追加
        if (isVElement(next) || isVTextNode(next)) {
          p.children.push(next);
        }
        
        // Remove the node from its parent
        if (next.parent) {
          const index = next.parent.children.indexOf(next as VElement | VTextNode);
          if (index !== -1) {
            next.parent.children.splice(index, 1);
          }
        }
        
        // Update the parent reference
        next.parent = p;
        
        next = sibling;
      }

      // Remove trailing whitespace nodes
      while (p.children.length > 0 && isWhitespace(p.children[p.children.length - 1])) {
        p.children.pop();
      }

      if (p.parent && p.parent.tagName === "P") {
        setNodeTag(p.parent, "DIV");
      }
    }
  });
}

/**
 * Iterates over a NodeList, calls `filterFn` for each node and removes node
 * if function returned `true`.
 *
 * If function is not passed, removes all the nodes in node list.
 *
 * @param nodeList The nodes to operate on
 * @param filterFn the function to use as a filter
 * @return void
 */
export function removeNodes(
  nodeList: VElement[], 
  filterFn?: (node: VElement, index: number, nodeList: VElement[]) => boolean
): void {
  for (let i = nodeList.length - 1; i >= 0; i--) {
    const node = nodeList[i];
    const parentNode = node.parent;
    
    if (parentNode) {
      if (!filterFn || filterFn.call(null, node, i, nodeList)) {
        const index = parentNode.children.indexOf(node);
        if (index !== -1) {
          parentNode.children.splice(index, 1);
        }
      }
    }
  }
}

/**
 * Iterates over a NodeList, and calls _setNodeTag for each node.
 *
 * @param nodeList The nodes to operate on
 * @param newTagName the new tag name to use
 * @return void
 */
export function replaceNodeTags(nodeList: VElement[], newTagName: string): void {
  for (const node of nodeList) {
    setNodeTag(node, newTagName);
  }
}

/**
 * Changes the tag name of an element
 */
export function setNodeTag(node: VElement, tag: string): VElement {
  const newElement = createVElement(tag);
  
  // Copy attributes
  newElement.attributes = {...node.attributes};
  if (node.id) newElement.id = node.id;
  if (node.className) newElement.className = node.className;
  
  // Copy children
  newElement.children = [...node.children];
  
  // Update parent references in children
  for (const child of newElement.children) {
    child.parent = newElement;
  }
  
  // Replace node in parent's children
  if (node.parent) {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      node.parent.children[index] = newElement;
      newElement.parent = node.parent;
    }
  }
  
  // Copy readability data if exists
  if (node.readability) {
    newElement.readability = node.readability;
  }
  
  return newElement;
}

/**
 * Get all nodes with a given tag name
 */
export function getAllNodesWithTag(node: VElement | VDocument, tagNames: string[]): VElement[] {
  const root = 'documentElement' in node ? node.documentElement : node;
  let result: VElement[] = [];
  
  for (const tagName of tagNames) {
    result = result.concat(getElementsByTagName(root, tagName));
  }
  
  return result;
}
