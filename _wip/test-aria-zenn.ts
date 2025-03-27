// const { extract, ariaTreeToString } = require("../src/index");
import { extract, ariaTreeToString } from "../src/index.ts";
import { toMarkdown } from "../src/format/markdown.ts";
import { getContentByPageType, PageType } from "../src/types.ts";

import fs from "fs";
import path from "path";

// 長いテキストを切り詰める関数
function truncateLongText(line: string, maxLength: number = 50): string {
  // URL属性（href, src, alt）を含む行はtruncateしない
  if (
    line.includes("[href=") ||
    line.includes("[src=") ||
    line.includes("[alt=")
  ) {
    return line;
  }

  // テキストを含む行を検出（": "または" "の後にテキストがある行）
  const textMatch = line.match(/^(\s*-.+?(?::|"))\s+(.+?)(\s*(?:\[.*\])?\s*)$/);
  if (textMatch) {
    const [, prefix, text, suffix] = textMatch;
    if (text.length > maxLength) {
      // テキストが長い場合は切り詰める
      return `${prefix} ${text.substring(0, maxLength)}...(${text.length}) ${suffix}`;
    }
  }
  return line;
}

// テスト用のHTMLファイルを読み込む
// const htmlPath = path.join(
//   import.meta.dirname,
//   "../test/test-pages/wikipedia/source.html"
// );
// const html = fs.readFileSync(htmlPath, "utf-8");
const html = await fetch("https://zenn.dev/").then((res) => res.text());

// 本文抽出とaria tree生成を同時に行う
// forcedPageTypeオプションを使用してページタイプを強制的に設定
const result = extract(html, {
  generateAriaTree: true,
  forcedPageType: PageType.OTHER, // 強制的にOTHERに設定
});

console.log("=== 抽出結果 ===");
console.log(`タイトル: ${result.title}`);
console.log(`本文抽出: ${result.root ? "成功" : "失敗"}`);
console.log(`ノード数: ${result.nodeCount}`);
console.log(`ページタイプ: ${result.pageType}`);

// AIに記事を読ませるための処理手順
// pageTypeに応じたデータを取得
const content = getContentByPageType(result);

// 1. もし本文が抽出されれば（ARTICLEの場合）、markdownのサマリーを表示
// 2. 本文が抽出されなければ（OTHERの場合）、aria treeの要約を表示
if (result.root) {
  // 本文が抽出された場合
  console.log("\n=== Markdown サマリー ===");
  const markdown = toMarkdown(result.root);
  console.log(markdown);
} else if (result.ariaTree) {
  // 本文が抽出されなかった場合、AriaTreeの要約を表示
  console.log("\n=== AriaTree情報 ===");

  // AriaTreeの最初の数行だけ表示（全体は大きすぎるため）
  const treeString = ariaTreeToString(result.ariaTree);
  const treeLines = treeString.split("\n").slice(0, 20);

  // コンパクトな結果も表示
  console.log("\n=== AriaTree構造（コンパクト版）===");
  // 最初の3レベルまでのノードだけを表示
  const compactLines = treeString
    .split("\n")
    // .filter((line) => {
    //   const indentLevel = line.match(/^(\s*)/)?.[1].length || 0;
    //   return indentLevel <= 4; // 2スペースのインデントで3レベルまで
    // })
    .map((line) => truncateLongText(line, 60));
  // .slice(0, 15); // 最初の15行だけ表示
  console.log(compactLines.join("\n"));

  // 特定のロールを持つノードを探す例
  const findRoleNodes = (
    node: any,
    role: string,
    results: any[] = []
  ): any[] => {
    if (node.type === role) {
      results.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        findRoleNodes(child, role, results);
      }
    }
    return results;
  };

  // 見出し要素を探す
  const headings = findRoleNodes(result.ariaTree.root, "heading", []);
  console.log(`\n見出し要素数: ${headings.length}`);
  if (headings.length > 0) {
    console.log("\n=== 見出し要素 ===");
    headings.slice(0, 5).forEach((heading, i) => {
      console.log(
        `${i + 1}. レベル${heading.level || "不明"}: ${heading.name || "(名前なし)"}`
      );
    });
    if (headings.length > 5) {
      console.log(`...他 ${headings.length - 5} 件`);
    }
  }

  // リンク要素を探す
  const links = findRoleNodes(result.ariaTree.root, "link", []);
  console.log(`\nリンク要素数: ${links.length}`);
  if (links.length > 0) {
    console.log("\n=== リンク要素（最初の5件）===");
    links.slice(0, 5).forEach((link, i) => {
      console.log(`${i + 1}. ${link.name || "(名前なし)"}`);
    });
    if (links.length > 5) {
      console.log(`...他 ${links.length - 5} 件`);
    }
  }
}

// 本文抽出に失敗したケースをシミュレート
console.log("\n\n=== 本文抽出失敗のシミュレーション ===");
const shortHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>短いコンテンツ</title>
</head>
<body>
  <header role="banner">
    <h1>ウェブサイトのヘッダー</h1>
    <nav role="navigation">
      <ul>
        <li><a href="#">ホーム</a></li>
        <li><a href="#">製品</a></li>
        <li><a href="#">お問い合わせ</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <p>これは短いコンテンツです。本文抽出には失敗するはずです。</p>
  </main>
  <footer role="contentinfo">
    <p>&copy; 2025 サンプル会社</p>
  </footer>
</body>
</html>
`;
const shortResult = extract(shortHtml, {
  charThreshold: 500, // 閾値を高く設定して本文抽出を失敗させる
  generateAriaTree: true,
  forcedPageType: PageType.OTHER, // 強制的にOTHERに設定
});

console.log(`タイトル: ${shortResult.title}`);
console.log(`本文抽出: ${shortResult.root ? "成功" : "失敗"}`);
console.log(`ノード数: ${shortResult.nodeCount}`);
console.log(`ページタイプ: ${shortResult.pageType}`);

// AIに記事を読ませるための処理手順
// pageTypeに応じたデータを取得
const shortContent = getContentByPageType(shortResult);

// 1. もし本文が抽出されれば（ARTICLEの場合）、markdownのサマリーを表示
// 2. 本文が抽出されなければ（OTHERの場合）、aria treeの要約を表示
if (shortResult.root) {
  // 本文が抽出された場合
  console.log("\n=== Markdown サマリー ===");
  const markdown = toMarkdown(shortResult.root);
  console.log(markdown);
} else {
  // 構造要素の確認
  console.log("\n=== 構造要素 ===");
  console.log(`ヘッダー: ${shortResult.header ? "あり" : "なし"}`);
  console.log(`フッター: ${shortResult.footer ? "あり" : "なし"}`);
  console.log(
    `その他の重要ノード: ${shortResult.otherSignificantNodes?.length || 0}個`
  );

  // AriaTreeの確認
  if (shortResult.ariaTree) {
    console.log("\n=== AriaTree構造 ===");
    console.log(ariaTreeToString(shortResult.ariaTree));

    // コンパクト版も表示
    console.log("\n=== AriaTree構造（コンパクト版）===");
    const compactString = ariaTreeToString(shortResult.ariaTree)
      .split("\n")
      .filter((line) => {
        const indentLevel = line.match(/^(\s*)/)?.[1].length || 0;
        return indentLevel <= 4; // 最初の2レベルまで
      })
      .map((line) => truncateLongText(line))
      .join("\n");
    console.log(compactString);
  }
}
