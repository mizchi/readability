/**
 * Readability v3 - Core Implementation
 *
 * Core implementation of the content extraction algorithm
 */

import {
  type VDocument, // Keep type imports for interfaces/types
  type VElement,
  type ReadabilityArticle,
  type ReadabilityOptions,
  type Parser,
  type AriaTree,
  type AriaNode, // AriaNode 型をインポート
  PageType, // Import ArticleType as a value
} from "./types.ts";
import { isVElement } from "./types.ts"; // Import isVElement as a value
import {
  getElementsByTagName,
  isProbablyVisible,
  getNodeAncestors,
  createElement,
  getInnerText, // getInnerText を import
  getLinkDensity, // getLinkDensity を import
  getTextDensity, // getTextDensity を import
} from "./dom.ts";
import {
  buildAriaTree, // aria treeを構築する関数
  buildAriaNode, // aria nodeを構築する関数
  ariaTreeToString, // aria treeを文字列に変換する関数
} from "./aria.ts";
// aria.ts 内の countNodes 関数を直接使用するため、同じ関数を定義
function countAriaNodes(node: AriaNode): number {
  let count = 1; // 自身をカウント
  if (node.children) {
    for (const child of node.children) {
      count += countAriaNodes(child);
    }
  }
  return count;
}
import {
  REGEXPS,
  DEFAULT_TAGS_TO_SCORE,
  DEFAULT_N_TOP_CANDIDATES,
  DEFAULT_CHAR_THRESHOLD,
} from "./constants.ts";
import { parseHTML, serializeToHTML } from "./parser.ts";
import { countNodes } from "./format.ts";
import { preprocessDocument } from "./preprocess.ts";

/**
 * Initialize score for an element
 */
function initializeNode(node: VElement): void {
  node.readability = { contentScore: 0 };

  // Initial score based on tag name (now lowercase)
  switch (node.tagName) {
    case "div":
      node.readability.contentScore += 5;
      break;
    case "pre":
    case "td":
    case "blockquote":
      node.readability.contentScore += 3;
      break;
    case "address":
    case "ol":
    case "ul":
    case "dl":
    case "dd":
    case "dt":
    case "li":
    case "form":
      node.readability.contentScore -= 3;
      break;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "th":
      node.readability.contentScore -= 5;
      break;
  }

  // Score adjustment based on class name and ID
  node.readability.contentScore += getClassWeight(node);
}

/**
 * ヘッダー、フッター、その他の主要な構造要素を検出する
 */
function findStructuralElements(doc: VDocument): {
  header: VElement | null;
  footer: VElement | null;
  otherSignificantNodes: VElement[];
} {
  let header: VElement | null = null;
  let footer: VElement | null = null;
  const otherSignificantNodes: VElement[] = [];
  const body = doc.body;

  // 1. ヘッダー候補を探す
  const headerTags = getElementsByTagName(doc.documentElement, "header");
  if (headerTags.length === 1) {
    header = headerTags[0];
  } else {
    // role="banner" や一般的なID/クラス名で探す
    const allElements = getElementsByTagName(body, "*");
    for (const el of allElements) {
      const role = el.attributes.role?.toLowerCase();
      const id = el.id?.toLowerCase();
      const className = el.className?.toLowerCase();
      if (
        role === "banner" ||
        id === "header" ||
        id === "masthead" ||
        className?.includes("header") ||
        className?.includes("masthead")
      ) {
        // より上位の要素を優先 (body直下など)
        if (!header || (el.parent === body && header.parent !== body)) {
          header = el;
        }
      }
    }
  }

  // 2. フッター候補を探す
  const footerTags = getElementsByTagName(doc.documentElement, "footer");
  if (footerTags.length === 1) {
    footer = footerTags[0];
  } else {
    // role="contentinfo" や一般的なID/クラス名で探す
    const allElements = getElementsByTagName(body, "*");
    // DOMの下位から探す方がフッターらしいことが多いので逆順でループ
    for (let i = allElements.length - 1; i >= 0; i--) {
      const el = allElements[i];
      const role = el.attributes.role?.toLowerCase();
      const id = el.id?.toLowerCase();
      const className = el.className?.toLowerCase();
      if (
        role === "contentinfo" ||
        id === "footer" ||
        id === "colophon" ||
        className?.includes("footer") ||
        className?.includes("site-info")
      ) {
        // より下位の要素を優先
        if (!footer) {
          // ただし、ヘッダーに含まれるフッターは除外
          let isInsideHeader = false;
          let current: VElement | undefined = el;
          while (current && current !== body) {
            if (current === header) {
              isInsideHeader = true;
              break;
            }
            current = current.parent;
          }
          if (!isInsideHeader) {
            footer = el;
            // 最初に見つかった下位のものを採用するため break しても良い場合がある
            // break;
          }
        }
      }
    }
  }

  // 3. その他の主要なノードを探す (<main>, <article>, <section>, <aside>, <nav> など)
  const mainTags = getElementsByTagName(body, "main");
  const articleTags = getElementsByTagName(body, "article");
  const sectionTags = getElementsByTagName(body, "section");
  const asideTags = getElementsByTagName(body, "aside");
  const navTags = getElementsByTagName(body, "nav");

  const potentialNodes = [
    ...mainTags,
    ...articleTags,
    ...sectionTags,
    ...asideTags,
    ...navTags,
  ];

  // クラス名やIDに基づいて意味のある要素を追加
  addSignificantElementsByClassOrId(body, potentialNodes);

  for (const node of potentialNodes) {
    // ヘッダーやフッター自身、またはその内部に含まれるものは除外
    let isInsideHeaderOrFooter = false;
    let current: VElement | undefined = node;
    while (current && current !== body) {
      if (current === header || current === footer) {
        isInsideHeaderOrFooter = true;
        break;
      }
      current = current.parent;
    }

    if (!isInsideHeaderOrFooter && !otherSignificantNodes.includes(node)) {
      // 簡単な可視性チェックと最低限のテキスト量チェック
      if (
        isProbablyVisible(node) &&
        (isSignificantNode(node) || isSemanticTag(node.tagName))
      ) {
        otherSignificantNodes.push(node);
      }
    }
  }

  // 重複を除去 (念のため)
  const uniqueOtherNodes = Array.from(new Set(otherSignificantNodes));

  return { header, footer, otherSignificantNodes: uniqueOtherNodes };
}

/**
 * クラス名やIDに基づいて意味のある要素を検出し、potentialNodesに追加する
 */
function addSignificantElementsByClassOrId(
  body: VElement,
  potentialNodes: VElement[]
): void {
  const allElements = getElementsByTagName(body, "*");

  // 意味のあるクラス名やIDのパターン
  const significantPatterns = [
    /content/i,
    /main/i,
    /article/i,
    /post/i,
    /entry/i,
    /body/i,
    /text/i,
    /story/i,
    /container/i,
    /wrapper/i,
    /page/i,
    /blog/i,
    /section/i,
  ];

  for (const el of allElements) {
    const className = el.className?.toLowerCase() || "";
    const id = el.id?.toLowerCase() || "";
    const combinedString = `${className} ${id}`;

    // 意味のあるクラス名やIDを持つ要素を検出
    for (const pattern of significantPatterns) {
      if (pattern.test(combinedString)) {
        if (!potentialNodes.includes(el)) {
          potentialNodes.push(el);
        }
        break;
      }
    }
  }
}

/**
 * 要素が意味のある要素かどうかを判定する
 */
function isSignificantNode(node: VElement): boolean {
  // 最低限のテキスト量チェック
  const textLength = getInnerText(node, false).length;
  if (textLength < 50) {
    return false;
  }

  // テキスト密度チェック
  const textDensity = getTextDensity(node);
  if (textDensity < 0.1) {
    return false;
  }

  // リンク密度チェック（高すぎるとナビゲーションの可能性）
  const linkDensity = getLinkDensity(node);
  if (linkDensity > 0.5) {
    return false;
  }

  return true;
}

/**
 * タグ名が意味のあるセマンティックタグかどうかを判定する
 */
function isSemanticTag(tagName: string): boolean {
  const semanticTags = ["main", "article", "section", "aside", "nav"];
  return semanticTags.includes(tagName.toLowerCase());
}

/**
 * Adjust score based on class name and ID
 */
function getClassWeight(node: VElement): number {
  let weight = 0;

  // Check class name
  if (node.className) {
    if (REGEXPS.negative.test(node.className)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.className)) {
      weight += 25;
    }
  }

  // Check ID
  if (node.id) {
    if (REGEXPS.negative.test(node.id)) {
      weight -= 25;
    }
    if (REGEXPS.positive.test(node.id)) {
      weight += 25;
    }
  }

  return weight;
}

/**
 * Detect nodes that are likely to be the main content candidates, sorted by score.
 * Returns the top N candidates.
 */
export function findMainCandidates(
  doc: VDocument,
  nbTopCandidates: number = DEFAULT_N_TOP_CANDIDATES
): VElement[] {
  // 1. First, look for semantic tags (simple method) (now lowercase)
  const semanticTags = ["article", "main"];
  for (const tag of semanticTags) {
    const elements = getElementsByTagName(doc.documentElement, tag);
    if (elements.length === 1) {
      // If a single semantic tag is found, return it as the only candidate
      return [elements[0]];
    }
  }

  // 2. Scoring-based detection
  const body = doc.body;
  const candidates: VElement[] = [];
  const elementsToScore: VElement[] = [];

  // Collect elements to score
  DEFAULT_TAGS_TO_SCORE.forEach((tag) => {
    const elements = getElementsByTagName(body, tag);
    elementsToScore.push(...elements);
  });

  // Score each element
  for (const elementToScore of elementsToScore) {
    // Ignore elements with less than 25 characters
    const innerText = getInnerText(elementToScore);
    if (innerText.length < 25) continue;

    // Get ancestor elements (up to 3 levels)
    const ancestors = getNodeAncestors(elementToScore, 3);
    if (ancestors.length === 0) continue;

    // Calculate base score
    let contentScore = 1; // Base points
    contentScore += innerText.split(REGEXPS.commas).length; // Number of commas
    contentScore += Math.min(Math.floor(innerText.length / 100), 3); // Text length (max 3 points)

    // Add score to ancestor elements
    for (let level = 0; level < ancestors.length; level++) {
      const ancestor = ancestors[level];

      if (!ancestor.readability) {
        initializeNode(ancestor);
        candidates.push(ancestor);
      }

      // Decrease score for deeper levels
      const scoreDivider = level === 0 ? 1 : level === 1 ? 2 : level * 3;
      if (ancestor.readability) {
        ancestor.readability.contentScore += contentScore / scoreDivider;
      }
    }
  }

  // Score and select candidates
  const scoredCandidates: { element: VElement; score: number }[] = [];

  for (const candidate of candidates) {
    // Adjust score based on link density
    if (candidate.readability) {
      const linkDensity = getLinkDensity(candidate);
      candidate.readability.contentScore *= 1 - linkDensity;

      // Also consider text density
      // Elements with high text density are more likely to contain more text content
      const textDensity = getTextDensity(candidate);
      if (textDensity > 0) {
        // Slightly increase the score for higher text density (up to 10%)
        candidate.readability.contentScore *=
          1 + Math.min(textDensity / 10, 0.1);
      }

      // Check parent node score - the parent might be a better candidate
      let currentCandidate = candidate;
      let parentOfCandidate = currentCandidate.parent;
      while (parentOfCandidate && parentOfCandidate.tagName !== "BODY") {
        if (
          parentOfCandidate.readability &&
          currentCandidate.readability &&
          parentOfCandidate.readability.contentScore >
            currentCandidate.readability.contentScore
        ) {
          currentCandidate = parentOfCandidate;
        }
        parentOfCandidate = parentOfCandidate.parent;
      }

      // Avoid adding duplicates if parent check resulted in the same element
      // Also ensure readability property exists before accessing contentScore
      if (
        currentCandidate.readability &&
        !scoredCandidates.some((sc) => sc.element === currentCandidate)
      ) {
        scoredCandidates.push({
          element: currentCandidate,
          score: currentCandidate.readability.contentScore,
        });
      }
    }
  }

  // Sort candidates by score in descending order
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Return top N candidates
  const topCandidates = scoredCandidates
    .slice(0, nbTopCandidates)
    .map((c) => c.element);

  // Return body if no candidate is found and body exists
  if (topCandidates.length === 0 && doc.body) {
    return [doc.body];
  }

  return topCandidates;
}

/**
 * Determine content probability (simplified version similar to isProbablyReaderable)
 */
export function isProbablyContent(element: VElement): boolean {
  // Visibility check
  if (!isProbablyVisible(element)) {
    return false;
  }

  // Check class name and ID
  const matchString = (element.className || "") + " " + (element.id || "");
  if (
    REGEXPS.unlikelyCandidates.test(matchString) &&
    !REGEXPS.okMaybeItsACandidate.test(matchString)
  ) {
    return false;
  }

  // Check text length
  const textLength = getInnerText(element).length;
  if (textLength < 140) {
    return false;
  }

  // Check link density
  const linkDensity = getLinkDensity(element);
  if (linkDensity > 0.5) {
    return false;
  }

  // Check text density
  // If text density is extremely low, it's unlikely to be the main content
  const textDensity = getTextDensity(element);
  if (textDensity < 0.1) {
    return false;
  }

  return true;
}

/**
 * Get the article title
 */
function getArticleTitle(doc: VDocument): string | null {
  // 1. Get from <title> tag (lowercase)
  const titleElements = getElementsByTagName(doc.documentElement, "title");
  if (titleElements.length > 0) {
    return getInnerText(titleElements[0]);
  }

  // 2. Get from <h1> tag (lowercase)
  const h1Elements = getElementsByTagName(doc.body, "h1");
  if (h1Elements.length === 1) {
    return getInnerText(h1Elements[0]);
  }

  // 3. Get from the first heading (lowercase)
  const headings = [
    ...getElementsByTagName(doc.body, "h1"),
    ...getElementsByTagName(doc.body, "h2"),
  ];

  if (headings.length > 0) {
    return getInnerText(headings[0]);
  }

  return null;
}

/**
 * Get the article byline (author information)
 */
function getArticleByline(doc: VDocument): string | null {
  // Get author information from meta tags (lowercase)
  const metaTags = getElementsByTagName(doc.documentElement, "meta");
  for (const meta of metaTags) {
    const name = meta.attributes.name?.toLowerCase();
    const property = meta.attributes.property?.toLowerCase();
    const content = meta.attributes.content;

    if (!content) continue;

    if (
      name === "author" ||
      property === "author" ||
      property === "og:author" ||
      property === "article:author"
    ) {
      return content;
    }
  }

  // Get from elements with rel="author" attribute (lowercase 'a')
  const relAuthors = getElementsByTagName(doc.body, "a");
  for (const author of relAuthors) {
    if (author.attributes.rel === "author") {
      const text = getInnerText(author);
      if (text) return text;
    }
  }

  return null;
}

/**
 * ページタイプを判定する関数
 *
 * 判定基準:
 * 1. 有意に長い本文がない
 * 2. 候補が平衡している（スコアの差が小さい）
 * 3. ページの構造に対して有意にリンクが多い
 */
export function classifyPageType(
  doc: VDocument,
  candidates: VElement[],
  charThreshold: number = DEFAULT_CHAR_THRESHOLD
): PageType {
  // 候補がない場合は OTHER
  if (candidates.length === 0) {
    return PageType.OTHER;
  }

  const topCandidate = candidates[0];

  // 1. セマンティックタグの確認
  // main, article タグが使われている場合は ARTICLE の可能性が高い
  if (
    topCandidate.tagName === "main" ||
    topCandidate.tagName === "article" ||
    topCandidate.className?.toLowerCase().includes("content") ||
    topCandidate.id?.toLowerCase().includes("content") ||
    // 子要素にセマンティックタグがあるかもチェック
    topCandidate.children.some(
      (child) =>
        child.nodeType === "element" &&
        (child.tagName === "main" || child.tagName === "article")
    )
  ) {
    // セマンティックタグが使われている場合でも、テキスト長とリンク密度を確認
    const textLength = getInnerText(topCandidate).length;
    const linkDensity = getLinkDensity(topCandidate);

    if (textLength >= charThreshold / 2 && linkDensity <= 0.5) {
      return PageType.ARTICLE;
    }
  }

  // 2. テキスト長とリンク密度の確認
  const textLength = getInnerText(topCandidate).length;
  const linkDensity = getLinkDensity(topCandidate);

  if (textLength >= charThreshold && linkDensity <= 0.5) {
    return PageType.ARTICLE;
  }

  // 3. 候補のスコア差を確認（平衡性）
  if (candidates.length >= 2) {
    const topScore = topCandidate.readability?.contentScore || 0;
    const secondScore = candidates[1].readability?.contentScore || 0;

    // スコア差が小さい場合（20%以内）は、候補が平衡していると判断
    const scoreDifference = topScore - secondScore;
    const scoreRatio = secondScore / topScore;

    if (scoreRatio > 0.8) {
      // 候補が平衡している場合、リンク密度と全体のリンク数を確認
      const totalLinks = getElementsByTagName(doc.body, "a").length;
      const bodyTextLength = getInnerText(doc.body).length;
      const bodyLinkDensity = totalLinks / (bodyTextLength || 1);

      // リンク密度が高い場合は OTHER（リスト/インデックスページの可能性）
      if (bodyLinkDensity > 0.25 || linkDensity > 0.3) {
        return PageType.OTHER;
      }
    }
  }

  // 4. 全体のリンク数と本文の比率を確認
  const totalLinks = getElementsByTagName(doc.body, "a").length;
  const bodyTextLength = getInnerText(doc.body).length;

  // リンクが多く、本文が少ない場合は OTHER
  if (totalLinks > 30 && bodyTextLength < charThreshold * 1.5) {
    return PageType.OTHER;
  }

  // 5. 最終判定
  // ある程度のテキスト量があり、リンク密度が低い場合は ARTICLE
  if (textLength >= 140 && linkDensity <= 0.5) {
    return PageType.ARTICLE;
  }

  // それ以外の場合は OTHER
  return PageType.OTHER;
}

/**
 * Main function for content extraction
 */
export function extractContent(
  doc: VDocument,
  options: ReadabilityOptions = {}
): ReadabilityArticle {
  const charThreshold = options.charThreshold || DEFAULT_CHAR_THRESHOLD;
  const nbTopCandidates = options.nbTopCandidates || DEFAULT_N_TOP_CANDIDATES;
  const generateAriaTree =
    options.generateAriaTree !== undefined ? options.generateAriaTree : true;

  // Preprocess: Remove unwanted tags before finding candidates
  // preprocessDocument(doc); // preprocess は extract 関数で行う

  // Find content candidates
  const candidates = findMainCandidates(doc, nbTopCandidates);
  let topCandidate: VElement | null = null;
  let articleContent: VElement | null = null;

  // ページタイプを強制的に設定するか、自動判定する
  let pageType: PageType =
    options.forcedPageType || classifyPageType(doc, candidates, charThreshold);

  // 候補が存在する場合、最適なものを選択
  if (candidates.length > 0) {
    topCandidate = candidates[0]; // 最高スコアの候補

    // 候補が実際に意味のあるコンテンツかどうかを判断
    const textLength = getInnerText(topCandidate).length;
    const linkDensity = getLinkDensity(topCandidate);

    // ページタイプが ARTICLE の場合、本文を抽出
    if (pageType === PageType.ARTICLE) {
      if (textLength >= charThreshold && linkDensity <= 0.5) {
        articleContent = topCandidate;
      }
    }
  }

  // Get metadata
  const title = getArticleTitle(doc);
  const byline = getArticleByline(doc);

  // 構造要素の検出 (pageType が ARTICLE だが articleContent が null の場合)
  let structuralElements:
    | {
        header: VElement | null;
        footer: VElement | null;
        otherSignificantNodes: VElement[];
      }
    | undefined = undefined;

  if (pageType === PageType.ARTICLE && !articleContent) {
    structuralElements = findStructuralElements(doc);
  }

  // AriaTreeの生成
  // 本文抽出に失敗した場合、または明示的に要求された場合にAriaTreeを生成
  let ariaTree: AriaTree | undefined = undefined;
  if (generateAriaTree && (!articleContent || options.generateAriaTree)) {
    ariaTree = buildAriaTree(doc);

    // デバッグ用にaria treeの文字列表現をコンソールに出力
    if (process.env.NODE_ENV === "development") {
      console.log("Generated AriaTree:");
      console.log(ariaTreeToString(ariaTree));
    }
  }

  return {
    title,
    byline,
    root: articleContent, // 閾値を超えた場合のみ設定
    nodeCount: articleContent ? countNodes(articleContent) : 0,
    pageType: pageType,
    // 構造要素を追加
    header: structuralElements?.header,
    footer: structuralElements?.footer,
    otherSignificantNodes: structuralElements?.otherSignificantNodes,
    // AriaTreeを追加
    ariaTree,
  };
}

/**
 * Extract article from HTML
 */
export function extract(
  html: string,
  options: ReadabilityOptions = {}
): ReadabilityArticle {
  // Parse HTML to create virtual DOM
  // Use custom parser if provided, otherwise use default
  const parser = options.parser || parseHTML; // Assuming parseHTML is the default from ./parser.ts
  const parsedResult = parser(html);
  let doc: VDocument;

  // Wrap VElement result in a VDocument if necessary (lowercase 'html')
  if (isVElement(parsedResult)) {
    doc = {
      documentElement: createElement("html"),
      body: parsedResult,
      // baseURI and documentURI might need adjustment based on context if parsing fragments
    };
    doc.documentElement.children = [doc.body];
    doc.body.parent = doc.documentElement;
  } else {
    doc = parsedResult;
  }

  // Execute preprocessing
  preprocessDocument(doc);

  // pageType が未指定の場合は ARTICLE をデフォルトとして設定
  const optionsWithPageType = {
    ...options,
    forcedPageType: options.forcedPageType || PageType.ARTICLE,
  };

  // Extract content
  return extractContent(doc, optionsWithPageType);
}

/**
 * HTMLからAriaTreeを抽出する
 *
 * @param html HTML文字列
 * @param options オプション
 * @returns AriaTree
 */
export function extractAriaTree(
  html: string,
  options: Omit<ReadabilityOptions, "generateAriaTree"> & {
    /**
     * ARIA ツリーを圧縮するかどうか
     * true: 圧縮する（デフォルト）
     * false: 圧縮しない（生の ARIA ツリー）
     */
    compress?: boolean;
    /**
     * ナビゲーション要素を保持するかどうか
     * true: ナビゲーション要素を保持する
     * false: ナビゲーション要素を削除する（デフォルト）
     */
    preserveNavigation?: boolean;
  } = {}
): AriaTree {
  // デフォルトでは圧縮する
  const compress = options.compress !== undefined ? options.compress : true;
  // デフォルトではナビゲーション要素を削除する
  const preserveNavigation =
    options.preserveNavigation !== undefined
      ? options.preserveNavigation
      : false;

  // Parse HTML to create virtual DOM
  const parser = options.parser || parseHTML;
  const parsedResult = parser(html);
  let doc: VDocument;

  // Wrap VElement result in a VDocument if necessary
  if (isVElement(parsedResult)) {
    doc = {
      documentElement: createElement("html"),
      body: parsedResult,
    };
    doc.documentElement.children = [doc.body];
    doc.body.parent = doc.documentElement;
  } else {
    doc = parsedResult;
  }

  // Execute preprocessing with preserveNavigation option
  preprocessDocument(doc);

  if (compress) {
    // 圧縮された ARIA ツリーを構築して返す
    return buildAriaTree(doc);
  } else {
    // 圧縮されていない生の ARIA ツリーを構築して返す
    const rootNode = buildAriaNode(doc.body);
    const nodeCount = countAriaNodes(rootNode);

    return {
      root: rootNode,
      nodeCount,
    };
  }
}

/**
 * Creates an extractor function with a specific parser configured.
 * @param opts - Options containing the parser to use.
 * @returns An extract function that uses the configured parser.
 */
export function createExtractor(opts: {
  parser: Parser;
  generateAriaTree?: boolean; // AriaTreeを生成するかどうかのオプションを追加
  forcedPageType?: PageType; // 強制的に設定するページタイプを追加
}): (
  html: string,
  options?: Omit<ReadabilityOptions, "parser">
) => ReadabilityArticle {
  const { parser, generateAriaTree, forcedPageType } = opts;

  return (
    html: string,
    options: Omit<ReadabilityOptions, "parser"> = {}
  ): ReadabilityArticle => {
    // Parse HTML using the configured parser
    const parsedResult = parser(html);
    let doc: VDocument;

    // Wrap VElement result in a VDocument if necessary (lowercase 'html')
    if (isVElement(parsedResult)) {
      doc = {
        documentElement: createElement("html"),
        body: parsedResult,
        // baseURI and documentURI might need adjustment based on context if parsing fragments
      };
      doc.documentElement.children = [doc.body];
      doc.body.parent = doc.documentElement;
    } else {
      doc = parsedResult;
    }

    // Execute preprocessing
    preprocessDocument(doc);

    // Extract content using the main logic, passing other options
    // generateAriaTreeオプションとforcedPageTypeオプションを追加
    // forcedPageType が未指定の場合は ARTICLE をデフォルトとして設定
    return extractContent(doc, {
      ...options,
      generateAriaTree:
        options.generateAriaTree !== undefined
          ? options.generateAriaTree
          : generateAriaTree,
      forcedPageType:
        options.forcedPageType !== undefined
          ? options.forcedPageType
          : forcedPageType || PageType.ARTICLE,
    });
  };
}
