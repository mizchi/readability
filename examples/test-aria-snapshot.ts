// const { extract, ariaTreeToString } = require("../src/index");
import { extract, ariaTreeToString } from "../src/index.ts";

import fs from "fs";
import path from "path";

// テスト用のHTMLファイルを読み込む
const htmlPath = path.join(
  import.meta.dirname,
  "../test/test-pages/wikipedia/source.html"
);
const html = fs.readFileSync(htmlPath, "utf-8");

// 本文抽出とaria tree生成を同時に行う
const result = extract(html, { generateAriaTree: true });

console.log("=== 抽出結果 ===");
console.log(`タイトル: ${result.title}`);
console.log(`本文抽出: ${result.root ? "成功" : "失敗"}`);
console.log(`ノード数: ${result.nodeCount}`);
console.log(`ページタイプ: ${result.pageType}`);

// AriaTreeが生成されているか確認
if (result.ariaTree) {
  console.log("\n=== AriaTree情報 ===");
  console.log(`AriaTreeノード数: ${result.ariaTree.nodeCount}`);

  // AriaTreeの最初の数行だけ表示（全体は大きすぎるため）
  const treeString = ariaTreeToString(result.ariaTree);
  const treeLines = treeString.split("\n").slice(0, 20);
  console.log("\n=== AriaTree構造（最初の20行）===");
  console.log(treeLines.join("\n"));
  console.log("...(省略)...");

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
});

console.log(`タイトル: ${shortResult.title}`);
console.log(`本文抽出: ${shortResult.root ? "成功" : "失敗"}`);
console.log(`ノード数: ${shortResult.nodeCount}`);
console.log(`ページタイプ: ${shortResult.pageType}`);

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
}
