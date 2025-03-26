/**
 * Readability v3 - ページタイプ分類テスト
 *
 * classifyPageType関数を使ってページタイプを分類するテスト
 */

import { describe, it, expect } from "vitest";
import { extract, classifyPageType } from "./index.ts";
import { PageType, VDocument, VElement } from "./types.ts";
import { parseHTML } from "./parser.ts";
import { getInnerText, getLinkDensity, getElementsByTagName } from "./dom.ts";
import { DEFAULT_CHAR_THRESHOLD } from "./constants.ts";

// テスト対象のURL
const OTHER_URLS = [
  "https://zenn.dev/",
  "https://zenn.dev/mizchi",
  "https://automaton-media.com/",
  "https://www.cnn.co.jp/",
];

const ARTICLE_URLS = [
  "https://zenn.dev/mizchi/articles/ts-using-resource-management",
  "https://automaton-media.com/articles/newsjp/nintendo-switch-20250326-332888/",
  "https://www.cnn.co.jp/world/35230995.html",
];

// URLからHTMLを取得する関数
async function fetchHtml(url: string): Promise<string> {
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  return await response.text();
}

/**
 * URLパターンに基づいてページタイプを判定する関数
 *
 * 判定基準:
 * 1. /articles/ を含む場合はARTICLE
 * 2. 3階層以上の深さを持つパスはARTICLE
 * 3. 末尾に英単語ではなさそうなハッシュ・連番・UUIDのような文字列を含む場合はARTICLE
 */
function getExpectedPageTypeByUrl(url: string): PageType {
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
function improvedClassifyPageType(
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
function analyzeUrlPattern(url: string): string {
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

// 改善版extractContent関数
function improvedExtract(
  html: string,
  url: string
): ReturnType<typeof extract> {
  // 通常のextract関数を呼び出す
  const result = extract(html);

  // HTMLを解析
  const doc = parseHTML(html);

  // 候補を取得
  const candidates = result.root ? [result.root] : [];

  // 改善版分類関数を呼び出し
  const improvedPageType = improvedClassifyPageType(
    doc,
    candidates,
    DEFAULT_CHAR_THRESHOLD,
    url
  );

  // 結果を上書き
  result.pageType = improvedPageType;

  // ARTICLEでない場合は本文をnullに
  if (improvedPageType !== PageType.ARTICLE) {
    result.root = null;
    result.nodeCount = 0;
  }

  return result;
}

// テストスイート
describe("ページタイプ分類テスト", () => {
  // URLパターンに基づく分類テスト
  describe("URLパターンに基づく分類", () => {
    it("トップページのURLを正しく分類できる", () => {
      expect(getExpectedPageTypeByUrl("https://zenn.dev/")).toBe(
        PageType.OTHER
      );
      expect(getExpectedPageTypeByUrl("https://www.cnn.co.jp/")).toBe(
        PageType.OTHER
      );
      expect(getExpectedPageTypeByUrl("https://automaton-media.com/")).toBe(
        PageType.OTHER
      );
    });

    it("ユーザーページのURLを正しく分類できる", () => {
      expect(getExpectedPageTypeByUrl("https://zenn.dev/mizchi")).toBe(
        PageType.OTHER
      );
    });

    it("/articles/を含むURLを正しく分類できる", () => {
      expect(
        getExpectedPageTypeByUrl(
          "https://zenn.dev/mizchi/articles/ts-using-resource-management"
        )
      ).toBe(PageType.ARTICLE);
      expect(
        getExpectedPageTypeByUrl(
          "https://automaton-media.com/articles/newsjp/nintendo-switch-20250326-332888/"
        )
      ).toBe(PageType.ARTICLE);
    });

    it("末尾に数字のIDを含むURLを正しく分類できる", () => {
      expect(
        getExpectedPageTypeByUrl("https://www.cnn.co.jp/world/35230995.html")
      ).toBe(PageType.ARTICLE);
    });
  });

  // URL末尾パターン分析テスト
  describe("URL末尾パターン分析", () => {
    it("末尾なしのURLを正しく分析できる", () => {
      expect(analyzeUrlPattern("https://zenn.dev/")).toBe("末尾なし");
      expect(analyzeUrlPattern("https://www.cnn.co.jp/")).toBe("末尾なし");
    });

    it("英字のみの末尾を正しく分析できる", () => {
      expect(analyzeUrlPattern("https://zenn.dev/mizchi")).toBe(
        "英字のみ (mizchi)"
      );
      expect(
        analyzeUrlPattern(
          "https://zenn.dev/mizchi/articles/ts-using-resource-management"
        )
      ).toBe("英字のみ (ts-using-resource-management)");
    });

    it("数字のみの末尾を正しく分析できる", () => {
      expect(
        analyzeUrlPattern("https://www.cnn.co.jp/world/35230995.html")
      ).toBe("数字のみ (35230995)");
    });
  });

  // 実際のHTMLを使った分類テスト（非同期テスト）
  describe("実際のHTMLを使った分類テスト", () => {
    // 各URLに対するテスト
    it.skip("すべてのURLを正しく分類できる", async () => {
      // このテストは実際にネットワークリクエストを行うため、通常はスキップする
      // 実行する場合は .skip を削除する

      // OTHERカテゴリのURLをテスト
      for (const url of OTHER_URLS) {
        const html = await fetchHtml(url);

        // 元の分類結果
        const originalResult = extract(html);

        // 改善版分類結果
        const improvedResult = improvedExtract(html, url);

        // URLパターンによる期待値
        const expectedType = getExpectedPageTypeByUrl(url);

        // 改善版分類と期待値の一致を確認
        expect(improvedResult.pageType).toBe(expectedType);
      }

      // ARTICLEカテゴリのURLをテスト
      for (const url of ARTICLE_URLS) {
        const html = await fetchHtml(url);

        // 元の分類結果
        const originalResult = extract(html);

        // 改善版分類結果
        const improvedResult = improvedExtract(html, url);

        // URLパターンによる期待値
        const expectedType = getExpectedPageTypeByUrl(url);

        // 改善版分類と期待値の一致を確認
        expect(improvedResult.pageType).toBe(expectedType);
      }
    }, 60000); // タイムアウトを60秒に設定
  });

  // モックHTMLを使った分類テスト
  describe("モックHTMLを使った分類テスト", () => {
    it("記事ページのHTMLを正しく分類できる", () => {
      // テキスト量を大幅に増やした記事ページのHTML
      const articleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>テスト記事</title>
        </head>
        <body>
          <article>
            <h1>テスト記事のタイトル</h1>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
            <p>これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。これはテスト記事の本文です。十分な長さのテキストを含んでいます。</p>
          </article>
        </body>
        </html>
      `;

      // HTMLを解析
      const doc = parseHTML(articleHtml);

      // 候補を取得（extract関数を使用）
      const result = extract(articleHtml);
      const candidates = result.root ? [result.root] : [];

      // 元の分類関数でテスト
      const originalType = classifyPageType(doc, candidates);
      expect(originalType).toBe(PageType.ARTICLE);

      // 改善版分類関数でテスト
      const improvedType = improvedClassifyPageType(doc, candidates);
      expect(improvedType).toBe(PageType.ARTICLE);

      // URLを指定した場合のテスト
      const articleUrl = "https://example.com/articles/test-article";
      const improvedTypeWithUrl = improvedClassifyPageType(
        doc,
        candidates,
        DEFAULT_CHAR_THRESHOLD,
        articleUrl
      );
      expect(improvedTypeWithUrl).toBe(PageType.ARTICLE);
    });
  });
});

// it('トップページのHTMLを正しく分類できる', () => {
//   const indexHtml = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <title>テストサイト</title>
//     </head>
//     <body>
//       <header>
//         <h1>テストサイト</h1>
//         <nav>
//           <ul>
//             <li><a href="#">ホーム</a></li>
//             <li><a href="#">カテゴリ</a></li>
//             <li><a href="#">お問い合わせ</a></li>
//           </ul>
//         </nav>
//       </header>
//       <main>
//         <section>
//           <h2>最新記事</h2>
//           <div class="card-list">
//             <article class="card">
//               <h3><a href="#">記事1</a></h3>
//               <img src="image1.jpg" alt="記事1">
//               <p>記事1の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事2</a></h3>
//               <img src="image2.jpg" alt="記事2">
//               <p>記事2の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事3</a></h3>
//               <img src="image3.jpg" alt="記事3">
//               <p>記事3の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事4</a></h3>
//               <img src="image4.jpg" alt="記事4">
//               <p>記事4の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事5</a></h3>
//               <img src="image5.jpg" alt="記事5">
//               <p>記事5の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事6</a></h3>
//               <img src="image6.jpg" alt="記事6">
//               <p>記事6の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事7</a></h3>
//               <img src="image7.jpg" alt="記事7">
//               <p>記事7の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事8</a></h3>
//               <img src="image8.jpg" alt="記事8">
//               <p>記事8の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事9</a></h3>
//               <img src="image9.jpg" alt="記事9">
//               <p>記事9の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事10</a></h3>
//               <img src="image10.jpg" alt="記事10">
//               <p>記事10の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事11</a></h3>
//               <img src="image11.jpg" alt="記事11">
//               <p>記事11の概要</p>
//             </article>
//             <article class="card">
//               <h3><a href="#">記事12</a></h3>
//               <img src="image12.jpg" alt="記事12">
//               <p>記事12の概要</p>
//             </article>
//           </div>
//         </section>
//       </main>
//       <footer>
//         <p>&copy; 2025 テストサイト</p>
//       </footer>
//     </body>
//     </html>
