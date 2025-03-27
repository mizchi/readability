/**
 * Readability v3 - ページタイプ分類モジュール
 *
 * ページタイプを分類するための関数を提供します
 */

import { PageType, VDocument, VElement } from "../types.ts";
import { getInnerText, getLinkDensity, getElementsByTagName } from "../dom.ts";
import { DEFAULT_CHAR_THRESHOLD } from "../constants.ts";

/**
 * URLパターンに基づいてページタイプを判定する関数
 *
 * 判定基準:
 * 1. /articles/ を含む場合はARTICLE
 * 2. 3階層以上の深さを持つパスはARTICLE
 * 3. 末尾に英単語ではなさそうなハッシュ・連番・UUIDのような文字列を含む場合はARTICLE
 */
export function getExpectedPageTypeByUrl(url: string): PageType {
  // URLパターンに基づく判定
  // 記事ページのパターン: /articles/ を含む、または特定のパターンに一致
  if (
    url.includes("/articles/") ||
    url.match(/\/[^\/]+\/[^\/]+\/[^\/]+$/) // 3階層以上の深さを持つパス
  ) {
    return PageType.ARTICLE;
  }

  // 追加: 末尾に英単語ではなさそうなハッシュ・連番・UUIDのような文字列を含む場合
  const urlParts = url.split("/");
  const lastPart = urlParts[urlParts.length - 1];

  // 末尾の部分が存在し、.htmlなどの拡張子を含む場合はその前の部分を取得
  const lastPartWithoutExt = lastPart.split(".")[0];

  // 数字のみ、または数字と英字の混合で、かつ5文字以上の場合は記事IDと判断
  if (
    /^\d+$/.test(lastPartWithoutExt) || // 数字のみ
    (/^[a-zA-Z0-9-_]+$/.test(lastPartWithoutExt) && // 英数字のみ
      /\d/.test(lastPartWithoutExt) && // 少なくとも1つの数字を含む
      lastPartWithoutExt.length >= 5) // 5文字以上
  ) {
    return PageType.ARTICLE;
  }

  // トップページやユーザーページなど
  return PageType.OTHER;
}

/**
 * 改善版ページタイプ分類関数
 *
 * 元の classifyPageType 関数の問題点を修正:
 * 1. セマンティックタグ（main, article）だけでなく、テキスト長も考慮
 * 2. URLパターンも考慮
 * 3. リンク数とテキスト数の比率をより厳密に確認
 * 4. 見出し数を確認
 * 5. 画像数を確認
 * 6. URLの末尾パターンを確認（ハッシュ・連番・UUIDなど）
 */
export function classify(
  doc: VDocument,
  candidates: VElement[],
  charThreshold: number = DEFAULT_CHAR_THRESHOLD,
  url?: string // オプションでURLを受け取る
): PageType {
  // URLパターンによる判定（URLが提供された場合）
  if (url) {
    // URLパターンが強い指標になる場合は、それを優先
    if (url.includes("/articles/")) {
      // 候補がある場合のみ ARTICLE として扱う
      return candidates.length > 0 ? PageType.ARTICLE : PageType.OTHER;
    }

    // 追加: 末尾に英単語ではなさそうなハッシュ・連番・UUIDのような文字列を含む場合
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];

    // 末尾の部分が存在し、.htmlなどの拡張子を含む場合はその前の部分を取得
    const lastPartWithoutExt = lastPart.split(".")[0];

    // 数字のみ、または数字と英字の混合で、かつ5文字以上の場合は記事IDと判断
    if (
      /^\d+$/.test(lastPartWithoutExt) || // 数字のみ
      (/^[a-zA-Z0-9-_]+$/.test(lastPartWithoutExt) && // 英数字のみ
        /\d/.test(lastPartWithoutExt) && // 少なくとも1つの数字を含む
        lastPartWithoutExt.length >= 5) // 5文字以上
    ) {
      // 候補がある場合のみ ARTICLE として扱う
      return candidates.length > 0 ? PageType.ARTICLE : PageType.OTHER;
    }

    // トップレベルドメインやユーザーページは OTHER の可能性が高い
    if (
      url.match(/^https?:\/\/[^\/]+\/?$/) ||
      url.match(/^https?:\/\/[^\/]+\/[^\/]+\/?$/)
    ) {
      // ただし、内容が明らかに記事の場合は例外
      if (candidates.length > 0) {
        const textLength = getInnerText(candidates[0]).length;
        // 非常に長いテキストがあり、リンク密度が低い場合のみ ARTICLE
        if (
          textLength > charThreshold * 2 &&
          getLinkDensity(candidates[0]) < 0.3
        ) {
          return PageType.ARTICLE;
        }
      }
      return PageType.OTHER;
    }
  }

  // 候補がない場合は OTHER
  if (candidates.length === 0) {
    return PageType.OTHER;
  }

  const topCandidate = candidates[0];

  // 1. ページ構造の分析
  // 見出し数をカウント
  const h1Elements = getElementsByTagName(doc.body, "h1");
  const h2Elements = getElementsByTagName(doc.body, "h2");
  const h3Elements = getElementsByTagName(doc.body, "h3");
  const headingCount =
    h1Elements.length + h2Elements.length + h3Elements.length;

  // 画像数をカウント
  const imgElements = getElementsByTagName(doc.body, "img");
  const imageCount = imgElements.length;

  // リンク数をカウント
  const aElements = getElementsByTagName(doc.body, "a");
  const linkCount = aElements.length;

  // 記事リスト要素をカウント
  const articleElements = getElementsByTagName(doc.body, "article");
  const listItemElements = getElementsByTagName(doc.body, "li");
  const cardElements = doc.body.children.filter(
    (child) =>
      child.nodeType === "element" &&
      (child.className?.toLowerCase().includes("card") ||
        child.className?.toLowerCase().includes("item") ||
        child.className?.toLowerCase().includes("entry"))
  );
  const listElementCount =
    articleElements.length + listItemElements.length + cardElements.length;

  // 2. トップページの特徴を検出
  // - 多数の記事/カードリスト要素
  // - 多数のリンク
  // - 多数の画像
  // - 見出しが少ない、または多すぎる
  const hasIndexPageCharacteristics =
    listElementCount > 10 || // 多数のリスト要素
    (linkCount > 50 && imageCount > 20) || // 多数のリンクと画像
    headingCount > 10 ||
    headingCount === 0; // 見出しが多すぎるか、まったくない

  if (hasIndexPageCharacteristics) {
    // トップページの特徴が強い場合は OTHER
    return PageType.OTHER;
  }

  // 3. セマンティックタグの確認 + テキスト長チェック
  const isSemanticTag =
    topCandidate.tagName === "main" ||
    topCandidate.tagName === "article" ||
    topCandidate.className?.toLowerCase().includes("content") ||
    topCandidate.id?.toLowerCase().includes("content") ||
    // 子要素にセマンティックタグがあるかもチェック
    topCandidate.children.some(
      (child) =>
        child.nodeType === "element" &&
        (child.tagName === "main" || child.tagName === "article")
    );

  if (isSemanticTag) {
    const textLength = getInnerText(topCandidate).length;
    const linkDensity = getLinkDensity(topCandidate);

    // セマンティックタグでも、テキスト長が短すぎる場合は OTHER
    if (textLength >= charThreshold / 2 && linkDensity <= 0.5) {
      // 記事リスト要素が多い場合は OTHER
      if (listElementCount > 10) {
        return PageType.OTHER;
      }
      return PageType.ARTICLE;
    }

    // テキスト長が非常に短い場合は OTHER
    if (textLength < 100) {
      return PageType.OTHER;
    }
  }

  // 4. テキスト長とリンク密度の確認
  const textLength = getInnerText(topCandidate).length;
  const linkDensity = getLinkDensity(topCandidate);

  // 記事の特徴: 十分なテキスト長、低いリンク密度、適切な見出し数
  if (
    textLength >= charThreshold &&
    linkDensity <= 0.5 &&
    headingCount >= 1 &&
    headingCount <= 10
  ) {
    return PageType.ARTICLE;
  }

  // 5. 候補のスコア差を確認（平衡性）
  if (candidates.length >= 2) {
    const topScore = topCandidate.readability?.contentScore || 0;
    const secondScore = candidates[1].readability?.contentScore || 0;
    const scoreRatio = secondScore / topScore;

    if (scoreRatio > 0.8) {
      // 候補が平衡している場合、リンク密度と全体のリンク数を確認
      const bodyTextLength = getInnerText(doc.body).length;
      const bodyLinkDensity = linkCount / (bodyTextLength || 1);

      // リンク密度が高い場合は OTHER（リスト/インデックスページの可能性）
      if (bodyLinkDensity > 0.25 || linkDensity > 0.3) {
        return PageType.OTHER;
      }
    }
  }

  // 6. 全体のリンク数と本文の比率を確認
  const bodyTextLength = getInnerText(doc.body).length;

  // リンクが多く、本文が少ない場合は OTHER
  if (linkCount > 30 && bodyTextLength < charThreshold * 1.5) {
    return PageType.OTHER;
  }

  // 7. 最終判定
  // ある程度のテキスト量があり、リンク密度が低い場合は ARTICLE
  if (textLength >= 140 && linkDensity <= 0.5) {
    // 記事リスト要素が多い場合は OTHER
    if (listElementCount > 10) {
      return PageType.OTHER;
    }
    return PageType.ARTICLE;
  }

  // それ以外の場合は OTHER
  return PageType.OTHER;
}

/**
 * URLの末尾パターンを分析する関数
 */
export function analyzeUrlPattern(url: string): string {
  const urlParts = url.split("/");
  const lastPart = urlParts[urlParts.length - 1];

  // 末尾の部分が存在し、.htmlなどの拡張子を含む場合はその前の部分を取得
  const lastPartWithoutExt = lastPart.split(".")[0];

  if (lastPartWithoutExt === "") {
    return "末尾なし";
  }

  if (/^\d+$/.test(lastPartWithoutExt)) {
    return `数字のみ (${lastPartWithoutExt})`;
  }

  if (
    /^[a-zA-Z0-9-_]+$/.test(lastPartWithoutExt) &&
    /\d/.test(lastPartWithoutExt)
  ) {
    return `英数字混合 (${lastPartWithoutExt})`;
  }

  if (/^[a-zA-Z-_]+$/.test(lastPartWithoutExt)) {
    return `英字のみ (${lastPartWithoutExt})`;
  }

  return `その他 (${lastPartWithoutExt})`;
}

/**
 * コンテンツの特性に基づいてページタイプを分析する関数
 * URLパターンに依存せず、コンテンツ自体の特性を分析する
 */
export function analyzeContentCharacteristics(
  doc: VDocument,
  candidates: VElement[],
  charThreshold: number = DEFAULT_CHAR_THRESHOLD
): {
  pageType: PageType;
  reasons: string[];
} {
  const reasons: string[] = [];

  // 候補がない場合は OTHER
  if (candidates.length === 0) {
    reasons.push("コンテンツ候補が見つかりませんでした");
    return { pageType: PageType.OTHER, reasons };
  }

  const topCandidate = candidates[0];

  // 1. セマンティックタグの確認
  const isSemanticTag =
    topCandidate.tagName === "main" ||
    topCandidate.tagName === "article" ||
    topCandidate.className?.toLowerCase().includes("content") ||
    topCandidate.id?.toLowerCase().includes("content") ||
    // 子要素にセマンティックタグがあるかもチェック
    topCandidate.children.some(
      (child) =>
        child.nodeType === "element" &&
        (child.tagName === "main" || child.tagName === "article")
    );

  if (isSemanticTag) {
    reasons.push(
      `セマンティックタグ(${topCandidate.tagName})が使用されています`
    );
  }

  // 2. テキスト長とリンク密度の確認
  const textLength = getInnerText(topCandidate).length;
  const linkDensity = getLinkDensity(topCandidate);

  reasons.push(`テキスト長: ${textLength}文字`);
  reasons.push(`リンク密度: ${linkDensity.toFixed(2)}`);

  // 3. 見出し要素の確認
  const h1Elements = getElementsByTagName(doc.body, "h1");
  const h2Elements = getElementsByTagName(doc.body, "h2");
  const h3Elements = getElementsByTagName(doc.body, "h3");
  const headingCount =
    h1Elements.length + h2Elements.length + h3Elements.length;

  reasons.push(`見出し要素数: ${headingCount}`);

  // 4. リスト要素の確認（記事リストの特徴）
  const articleElements = getElementsByTagName(doc.body, "article");
  const listItemElements = getElementsByTagName(doc.body, "li");
  const cardElements = doc.body.children.filter(
    (child) =>
      child.nodeType === "element" &&
      (child.className?.toLowerCase().includes("card") ||
        child.className?.toLowerCase().includes("item") ||
        child.className?.toLowerCase().includes("entry"))
  );

  const listElementCount = articleElements.length + cardElements.length;
  reasons.push(`リスト要素数: ${listElementCount}`);

  // 5. 候補のスコア差を確認（平衡性）
  let scoreRatio = 1.0;
  if (candidates.length >= 2) {
    const topScore = topCandidate.readability?.contentScore || 0;
    const secondScore = candidates[1].readability?.contentScore || 0;
    scoreRatio = secondScore / topScore;

    reasons.push(`候補スコア比率: ${scoreRatio.toFixed(2)}`);

    if (scoreRatio > 0.8) {
      reasons.push("候補が平衡しています（複数の同等の候補があります）");
    }
  }

  // 6. 判定ロジック
  // 記事の特徴: 十分なテキスト長、低いリンク密度、適切な見出し数
  if (
    textLength >= charThreshold &&
    linkDensity <= 0.5 &&
    headingCount >= 1 &&
    headingCount <= 10
  ) {
    reasons.push(
      "十分なテキスト長、低いリンク密度、適切な見出し数を持っています"
    );
    return { pageType: PageType.ARTICLE, reasons };
  }

  // セマンティックタグがあり、ある程度のテキスト量がある場合
  if (isSemanticTag && textLength >= charThreshold / 2 && linkDensity <= 0.5) {
    reasons.push("セマンティックタグがあり、ある程度のテキスト量があります");
    return { pageType: PageType.ARTICLE, reasons };
  }

  // リスト要素が多い場合はインデックスページの可能性
  if (listElementCount > 10) {
    reasons.push("多数のリスト要素があります（インデックスページの特徴）");
    return { pageType: PageType.OTHER, reasons };
  }

  // 候補が平衡していて、リンク密度が高い場合はインデックスページの可能性
  if (candidates.length >= 2 && scoreRatio > 0.8 && linkDensity > 0.3) {
    reasons.push(
      "候補が平衡していて、リンク密度が高いです（インデックスページの特徴）"
    );
    return { pageType: PageType.OTHER, reasons };
  }

  // ある程度のテキスト量があり、リンク密度が低い場合は記事の可能性
  if (textLength >= 140 && linkDensity <= 0.5) {
    reasons.push("ある程度のテキスト量があり、リンク密度が低いです");
    return { pageType: PageType.ARTICLE, reasons };
  }

  // それ以外の場合は OTHER
  reasons.push("記事の特徴を十分に満たしていません");
  return { pageType: PageType.OTHER, reasons };
}
