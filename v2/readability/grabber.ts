/*
 * Core article extraction logic for readability
 * This is the main algorithm that identifies and extracts the article content
 */

import type { VDocument, VElement, VNode, VTextNode } from '../types.ts';
import {
  // type VDocument,
  // type VElement,
  // VTextNode,
  // VNode,
  getAttribute,
  createVElement,
  isPhrasingContent,
  isWhitespace,
  getLinkDensity,
  getInnerText
} from '../vdom.ts';

import {
  REGEXPS,
  FLAG_STRIP_UNLIKELYS,
  FLAG_WEIGHT_CLASSES,
  FLAG_CLEAN_CONDITIONALLY,
  UNLIKELY_ROLES,
  DEFAULT_TAGS_TO_SCORE
} from '../constants.ts';

import { type ReadabilityAttempt } from '../types.ts';
import { getAllNodesWithTag, setNodeTag } from './preprocess.ts';
import { getNextNode, removeAndGetNext } from './postprocess.ts';
import {
  initializeNode,
  isProbablyVisible,
  checkHasAncestorTag,
  hasChildBlockElement,
  isValidByline,
  headerDuplicatesTitle,
  getNodeAncestors,
  checkElementWithoutContent,
  checkSingleTagInsideElement
} from './helpers.ts';

/**
 * The main grabArticle function
 */
export function grabArticle(
  doc: VDocument, 
  options: {
    flags: number,
    charThreshold: number,
    nbTopCandidates: number,
    articleTitle: string,
    articleByline: string | null,
    attempts: ReadabilityAttempt[],
    linkDensityModifier: number
  }
): VElement | null {
  const page = doc.body;
  const pageCacheHtml = page.children.slice(); // Save a copy of the original page
  
  let articleContent: VElement | null = null;
  let articleTitle = options.articleTitle;
  let articleByline = options.articleByline;
  
  while (true) {
    const stripUnlikelyCandidates = (options.flags & FLAG_STRIP_UNLIKELYS) !== 0;
    
    // First, node prepping. Trash nodes that look cruddy (like ones with the
    // class name "comment", etc), and turn divs into P tags where they have been
    // used inappropriately (as in, where they contain no other block level elements.)
    const elementsToScore: VElement[] = [];
    let node: VElement | null = doc.documentElement;
    
    let shouldRemoveTitleHeader = true;
    
    while (node) {
      const matchString = (node.className || "") + " " + (node.id || "");
      
      if (!isProbablyVisible(node)) {
        node = removeAndGetNext(node);
        continue;
      }
      
      // User is not able to see elements applied with both "aria-modal = true" and "role = dialog"
      if (
        getAttribute(node, "aria-modal") === "true" &&
        getAttribute(node, "role") === "dialog"
      ) {
        node = removeAndGetNext(node);
        continue;
      }
      
      // If we don't have a byline yet check to see if this node is a byline; if it is store the byline and remove the node.
      if (
        !articleByline &&
        isValidByline(node, matchString)
      ) {
        // Find child node matching [itemprop="name"] and use that if it exists for a more accurate author name byline
        let endOfSearchMarkerNode = getNextNode(node, true);
        let next = getNextNode(node);
        let itemPropNameNode: VElement | null = null;
        
        while (next && next !== endOfSearchMarkerNode) {
          if (next.nodeType === 'element') {
            const itemprop = getAttribute(next as VElement, "itemprop");
            if (itemprop && itemprop.includes("name")) {
              itemPropNameNode = next;
              break;
            }
          }
          next = getNextNode(next as VElement);
        }
        
        articleByline = getInnerText(itemPropNameNode || node).trim();
        node = removeAndGetNext(node);
        continue;
      }
      
      if (shouldRemoveTitleHeader && headerDuplicatesTitle(node, articleTitle)) {
        shouldRemoveTitleHeader = false;
        node = removeAndGetNext(node);
        continue;
      }
      
      // Remove unlikely candidates
      if (stripUnlikelyCandidates) {
        if (
          REGEXPS.unlikelyCandidates.test(matchString) &&
          !REGEXPS.okMaybeItsACandidate.test(matchString) &&
          !checkHasAncestorTag(node, "table") &&
          !checkHasAncestorTag(node, "code") &&
          node.tagName !== "BODY" &&
          node.tagName !== "A"
        ) {
          node = removeAndGetNext(node);
          continue;
        }
        
        const role = getAttribute(node, "role");
        if (role && UNLIKELY_ROLES.includes(role)) {
          node = removeAndGetNext(node);
          continue;
        }
      }
      
      // Remove DIV, SECTION, and HEADER nodes without any content(e.g. text, image, video, or iframe).
      if (
        (node.tagName === "DIV" ||
          node.tagName === "SECTION" ||
          node.tagName === "HEADER" ||
          node.tagName === "H1" ||
          node.tagName === "H2" ||
          node.tagName === "H3" ||
          node.tagName === "H4" ||
          node.tagName === "H5" ||
          node.tagName === "H6") &&
        checkElementWithoutContent(node)
      ) {
        node = removeAndGetNext(node);
        continue;
      }
      
      if (DEFAULT_TAGS_TO_SCORE.includes(node.tagName)) {
        elementsToScore.push(node);
      }
      
      // Turn all divs that don't have children block level elements into p's
      if (node.tagName === "DIV") {
        // Put phrasing content into paragraphs.
        let p: VElement | null = null;
        let childNode: VNode | null = node.children.length > 0 ? node.children[0] : null;
        
        while (childNode) {
          const nextSibling = childNode.parent?.children.indexOf(childNode as VElement) !== undefined
            ? childNode.parent?.children[childNode.parent?.children.indexOf(childNode as VElement) + 1]
            : null;
          
          if (isPhrasingContent(childNode as VElement)) {
            if (p !== null) {
              p.children.push(childNode as VElement | VTextNode);
              childNode.parent = p;
            } else if (!isWhitespace(childNode as VTextNode)) {
              p = createVElement("p");
              p.parent = node;
              
              // Replace the childNode with p
              const index = node.children.indexOf(childNode as VElement);
              if (index !== -1) {
                node.children[index] = p;
              }
              
              p.children.push(childNode as VElement | VTextNode);
              childNode.parent = p;
            }
          } else if (p !== null) {
            // Remove trailing whitespace
            while (p.children.length > 0 && isWhitespace(p.children[p.children.length - 1] as VTextNode)) {
              p.children.pop();
            }
            p = null;
          }
          
          childNode = nextSibling;
        }
        
        // Sites like http://mobile.slate.com encloses each paragraph with a DIV
        // element. DIVs with only a P element inside and no text content can be
        // safely converted into plain P elements to avoid confusing the scoring
        // algorithm with DIVs with are, in practice, paragraphs.
        if (
          checkSingleTagInsideElement(node, "P") &&
          getLinkDensity(node) < 0.25
        ) {
          const newNode = node.children[0] as VElement;
          
          // Replace the DIV with its child P
          if (node.parent) {
            const index = node.parent.children.indexOf(node);
            if (index !== -1) {
              node.parent.children[index] = newNode;
              newNode.parent = node.parent;
            }
          }
          
          node = newNode;
          elementsToScore.push(node);
        } else if (!hasChildBlockElement(node)) {
          node = setNodeTag(node, "P");
          elementsToScore.push(node);
        }
      }
      
      node = getNextNode(node) as VElement;
    }
    
    /**
     * Loop through all paragraphs, and assign a score to them based on how content-y they look.
     * Then add their score to their parent node.
     *
     * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
     **/
    const candidates: VElement[] = [];
    
    for (const elementToScore of elementsToScore) {
      if (!elementToScore.parent || elementToScore.parent.nodeType !== 'element') {
        continue;
      }
      
      // If this paragraph is less than 25 characters, don't even count it.
      const innerText = getInnerText(elementToScore);
      if (innerText.length < 25) {
        continue;
      }
      
      // Exclude nodes with no ancestor.
      const ancestors = getNodeAncestors(elementToScore, 5);
      if (ancestors.length === 0) {
        continue;
      }
      
      let contentScore = 0;
      
      // Add a point for the paragraph itself as a base.
      contentScore += 1;
      
      // Add points for any commas within this paragraph.
      contentScore += innerText.split(REGEXPS.commas).length;
      
      // For every 100 characters in this paragraph, add another point. Up to 3 points.
      contentScore += Math.min(Math.floor(innerText.length / 100), 3);
      
      // Initialize and score ancestors.
      for (let level = 0; level < ancestors.length; level++) {
        const ancestor = ancestors[level] as VElement;
        
        if (!ancestor.tagName || !ancestor.parent || ancestor.parent.nodeType !== 'element') {
          continue;
        }
        
        if (typeof ancestor.readability === "undefined") {
          initializeNode(ancestor);
          candidates.push(ancestor);
        }
        
        // Node score divider:
        // - parent:             1 (no division)
        // - grandparent:        2
        // - great grandparent+: ancestor level * 3
        let scoreDivider = 1;
        if (level === 1) {
          scoreDivider = 2;
        } else if (level > 1) {
          scoreDivider = level * 3;
        }
        
        if (ancestor.readability) {
          ancestor.readability.contentScore += contentScore / scoreDivider;
        }
      }
    }
    
    // After we've calculated scores, loop through all of the possible
    // candidate nodes we found and find the one with the highest score.
    const topCandidates: VElement[] = [];
    
    for (const candidate of candidates) {
      // Scale the final candidates score based on link density. Good content
      // should have a relatively small link density (5% or less) and be mostly
      // unaffected by this operation.
      if (candidate.readability) {
        const candidateScore = candidate.readability.contentScore * (1 - getLinkDensity(candidate));
        candidate.readability.contentScore = candidateScore;
        
        for (let t = 0; t < options.nbTopCandidates; t++) {
          const aTopCandidate = topCandidates[t];
          
          if (
            !aTopCandidate ||
            (aTopCandidate.readability && candidateScore > aTopCandidate.readability.contentScore)
          ) {
            topCandidates.splice(t, 0, candidate);
            if (topCandidates.length > options.nbTopCandidates) {
              topCandidates.pop();
            }
            break;
          }
        }
      }
    }
    
    let topCandidate = topCandidates[0] || null;
    let neededToCreateTopCandidate = false;
    
    // If we still have no top candidate, just use the body as a last resort.
    // We also have to copy the body node so it is something we can modify.
    if (topCandidate === null || topCandidate.tagName === "BODY") {
      // Move all of the page's children into topCandidate
      topCandidate = createVElement("DIV");
      neededToCreateTopCandidate = true;
      
      // Move everything (not just elements, also text nodes etc.) into the container
      // so we even include text directly in the body:
      topCandidate.children = page.children.slice();
      
      // Update parent references
      for (const child of topCandidate.children) {
        child.parent = topCandidate;
      }
      
      page.children = [topCandidate];
      topCandidate.parent = page;
      
      initializeNode(topCandidate);
    } else if (topCandidate) {
      // Find a better top candidate node if it contains (at least three) nodes which belong to `topCandidates` array
      // and whose scores are quite closed with current `topCandidate` node.
      let alternativeCandidateAncestors: VNode[][] = [];
      
      for (let i = 1; i < topCandidates.length; i++) {
        if (
          topCandidates[i].readability &&
          topCandidate.readability &&
          (topCandidates[i].readability?.contentScore ?? 0) /
            topCandidate.readability.contentScore >=
          0.75
        ) {
          alternativeCandidateAncestors.push(getNodeAncestors(topCandidates[i]));
        }
      }
      
      const MINIMUM_TOPCANDIDATES = 3;
      if (alternativeCandidateAncestors.length >= MINIMUM_TOPCANDIDATES) {
        let parentOfTopCandidate = topCandidate.parent as VElement;
        
        while (parentOfTopCandidate.tagName !== "BODY") {
          let listsContainingThisAncestor = 0;
          
          for (
            let ancestorIndex = 0;
            ancestorIndex < alternativeCandidateAncestors.length &&
            listsContainingThisAncestor < MINIMUM_TOPCANDIDATES;
            ancestorIndex++
          ) {
            listsContainingThisAncestor += Number(
              alternativeCandidateAncestors[ancestorIndex].includes(parentOfTopCandidate)
            );
          }
          
          if (listsContainingThisAncestor >= MINIMUM_TOPCANDIDATES) {
            topCandidate = parentOfTopCandidate;
            break;
          }
          
          parentOfTopCandidate = parentOfTopCandidate.parent as VElement;
        }
      }
      
      if (!topCandidate.readability) {
        initializeNode(topCandidate);
      }
      
      // Because of our bonus system, parents of candidates might have scores
      // themselves. They get half of the node. There won't be nodes with higher
      // scores than our topCandidate, but if we see the score going *up* in the first
      // few steps up the tree, that's a decent sign that there might be more content
      // lurking in other places that we want to unify in. The sibling stuff
      // below does some of that - but only if we've looked high enough up the DOM
      // tree.
      let parentOfTopCandidate = topCandidate.parent as VElement;
      let lastScore = topCandidate.readability ? topCandidate.readability.contentScore : 0;
      
      // The scores shouldn't get too low.
      const scoreThreshold = lastScore / 3;
      
      while (parentOfTopCandidate.tagName !== "BODY") {
        if (!parentOfTopCandidate.readability) {
          parentOfTopCandidate = parentOfTopCandidate.parent as VElement;
          continue;
        }
        
        const parentScore = parentOfTopCandidate.readability.contentScore;
        
        if (parentScore < scoreThreshold) {
          break;
        }
        
        if (parentScore > lastScore) {
          // Alright! We found a better parent to use.
          topCandidate = parentOfTopCandidate;
          break;
        }
        
        lastScore = parentOfTopCandidate.readability.contentScore;
        parentOfTopCandidate = parentOfTopCandidate.parent as VElement;
      }
      
      // If the top candidate is the only child, use parent instead. This will help sibling
      // joining logic when adjacent content is actually located in parent's sibling node.
      parentOfTopCandidate = topCandidate.parent as VElement;
      
      while (
        parentOfTopCandidate.tagName !== "BODY" &&
        parentOfTopCandidate.children.length === 1
      ) {
        topCandidate = parentOfTopCandidate;
        parentOfTopCandidate = topCandidate.parent as VElement;
      }
      
      if (!topCandidate.readability) {
        initializeNode(topCandidate);
      }
    }
    
    // Now that we have the top candidate, look through its siblings for content
    // that might also be related. Things like preambles, content split by ads
    // that we removed, etc.
    let articleContent = createVElement("DIV");
    articleContent.id = "readability-content";
    
    const siblingScoreThreshold = Math.max(
      10,
      topCandidate && topCandidate.readability ? topCandidate.readability.contentScore * 0.2 : 10
    );
    
    // Keep potential top candidate's parent node to try to get text direction of it later.
    const parentOfTopCandidate = topCandidate.parent as VElement;
    const siblings = parentOfTopCandidate.children;
    
    for (const sibling of siblings) {
      let append = false;
      
      if (sibling === topCandidate) {
        append = true;
      } else if (sibling.nodeType === 'element') {
        const siblingElement = sibling as VElement;
        let contentBonus = 0;
        
        // Give a bonus if sibling nodes and top candidates have the example same classname
        if (
          siblingElement.className &&
          topCandidate.className &&
          siblingElement.className === topCandidate.className &&
          topCandidate.className !== ""
        ) {
          contentBonus += topCandidate.readability ? topCandidate.readability.contentScore * 0.2 : 0;
        }
        
        if (
          siblingElement.readability &&
          ((siblingElement.readability.contentScore + contentBonus) >= siblingScoreThreshold)
        ) {
          append = true;
        } else if (siblingElement.tagName === "P") {
          const linkDensity = getLinkDensity(siblingElement);
          const nodeContent = getInnerText(siblingElement);
          const nodeLength = nodeContent.length;
          
          if (nodeLength > 80 && linkDensity < 0.25) {
            append = true;
          } else if (
            nodeLength < 80 &&
            nodeLength > 0 &&
            linkDensity === 0 &&
            nodeContent.search(/\.( |$)/) !== -1
          ) {
            append = true;
          }
        }
      }
      
      if (append) {
        // We have a node that isn't a common block level element, like a form or td tag.
        // Turn it into a div so it doesn't get filtered out later by accident.
        if (sibling.nodeType === 'element') {
          const siblingElement = sibling as VElement;
          if (!["DIV", "P", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI"].includes(siblingElement.tagName)) {
            // This node is a element node
            const newSibling = setNodeTag(siblingElement, "DIV");
            articleContent.children.push(newSibling);
            newSibling.parent = articleContent;
          } else {
            articleContent.children.push(siblingElement);
            siblingElement.parent = articleContent;
          }
        } else {
          articleContent.children.push(sibling);
          sibling.parent = articleContent;
        }
      }
    }
    
    // Now that we've gone through the full algorithm, check to see if
    // we got any meaningful content. If we didn't, we may need to re-run
    // grabArticle with different flags set. This gives us a higher likelihood of
    // finding the content, and the sieve approach gives us a higher likelihood of
    // finding the -right- content.
    const textLength = getInnerText(articleContent, true).length;
    
    if (textLength < options.charThreshold) {
      // Article is too short - we need to retry with different flags
      page.children = pageCacheHtml.slice(); // Restore the original page content
      
      // Update parent references
      for (const child of page.children) {
        child.parent = page;
      }
      
      options.attempts.push({
        articleContent,
        textLength,
      });
      
      if ((options.flags & FLAG_STRIP_UNLIKELYS) !== 0) {
        options.flags &= ~FLAG_STRIP_UNLIKELYS;
      } else if ((options.flags & FLAG_WEIGHT_CLASSES) !== 0) {
        options.flags &= ~FLAG_WEIGHT_CLASSES;
      } else if ((options.flags & FLAG_CLEAN_CONDITIONALLY) !== 0) {
        options.flags &= ~FLAG_CLEAN_CONDITIONALLY;
      } else {
        // No luck after removing flags, just return the longest text we found during the different loops
        options.attempts.sort((a, b) => b.textLength - a.textLength);
        
        // But first check if we actually have something
        if (!options.attempts[0].textLength) {
          return null;
        }
        
        articleContent = options.attempts[0].articleContent;
        return articleContent;
      }
    } else {
      return articleContent;
    }
  }
}
