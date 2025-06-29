/**
 * ナビゲーション要素を抽出するサンプルコード
 */

import { readable, analyzePageStructure } from "../src/index.ts";

// サンプルHTML
const html = `
<!DOCTYPE html>
<html>
<head>
  <title>サンプルページ</title>
</head>
<body>
  <header>
    <nav class="main-navigation" aria-label="メインナビゲーション">
      <ul>
        <li><a href="/">ホーム</a></li>
        <li><a href="/about">会社概要</a></li>
        <li>
          <a href="/products">製品</a>
          <ul>
            <li><a href="/products/software">ソフトウェア</a></li>
            <li><a href="/products/hardware">ハードウェア</a></li>
          </ul>
        </li>
        <li><a href="/contact" class="current">お問い合わせ</a></li>
      </ul>
    </nav>
    
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <ol>
        <li><a href="/">ホーム</a></li>
        <li><a href="/products">製品</a></li>
        <li>ソフトウェア</li>
      </ol>
    </nav>
  </header>
  
  <aside>
    <nav class="toc" aria-label="目次">
      <h2>このページの内容</h2>
      <ul>
        <li><a href="#overview">概要</a></li>
        <li><a href="#features">機能</a></li>
        <li><a href="#pricing">価格</a></li>
      </ul>
    </nav>
  </aside>
  
  <main>
    <article>
      <h1>製品ページ</h1>
      <p>これは製品の説明です...</p>
    </article>
    
    <nav class="pagination">
      <a href="/page/1">前へ</a>
      <span>2 / 5</span>
      <a href="/page/3">次へ</a>
    </nav>
  </main>
  
  <footer>
    <nav class="footer-nav">
      <ul>
        <li><a href="/privacy">プライバシーポリシー</a></li>
        <li><a href="/terms">利用規約</a></li>
        <li><a href="/sitemap">サイトマップ</a></li>
      </ul>
    </nav>
  </footer>
</body>
</html>
`;

// 方法1: analyzePageStructure関数を直接使用
console.log("=== 方法1: analyzePageStructure関数を直接使用 ===\n");

const pageStructure = analyzePageStructure(html);

console.log("検出されたナビゲーション数:", pageStructure.navigations.length);
console.log("\n各ナビゲーションの詳細:");

pageStructure.navigations.forEach((nav, index) => {
  console.log(`\n--- ナビゲーション ${index + 1} ---`);
  console.log("タイプ:", nav.type);
  console.log("場所:", nav.location);
  console.log("構造:", nav.structure);
  console.log("ラベル:", nav.label || "なし");
  console.log("アイテム数:", nav.items.length);
  
  // アイテムの詳細を表示
  console.log("アイテム:");
  nav.items.forEach((item, i) => {
    const indent = "  ".repeat(item.level + 1);
    const current = item.isCurrent ? " (現在のページ)" : "";
    console.log(`${indent}${i + 1}. ${item.label} - ${item.href || "リンクなし"}${current}`);
    
    // 子アイテムがある場合
    if (item.children && item.children.length > 0) {
      item.children.forEach((child, j) => {
        const childIndent = "  ".repeat(child.level + 1);
        console.log(`${childIndent}${i + 1}.${j + 1}. ${child.label} - ${child.href || "リンクなし"}`);
      });
    }
  });
});

// 特定のナビゲーションタイプを取得
console.log("\n\n=== 特定のナビゲーションタイプ ===");

if (pageStructure.mainNavigation) {
  console.log("\nメインナビゲーション:");
  console.log("アイテム数:", pageStructure.mainNavigation.items.length);
  console.log("アイテム:", pageStructure.mainNavigation.items.map(item => item.label).join(", "));
}

if (pageStructure.breadcrumb) {
  console.log("\nパンくずリスト:");
  console.log("パス:", pageStructure.breadcrumb.items.map(item => item.label).join(" > "));
}

if (pageStructure.toc) {
  console.log("\n目次:");
  pageStructure.toc.items.forEach(item => {
    console.log(`- ${item.label} (${item.href})`);
  });
}

// 方法2: Readableクラスを使用
console.log("\n\n=== 方法2: Readableクラスを使用 ===\n");

const doc = readable(html);

try {
  const structure = doc.getPageStructure({
    headerNavigationOnly: false, // すべてのナビゲーションを取得
    maxNavigations: 10
  });
  
  console.log("Readableクラス経由で取得したナビゲーション数:", structure.navigations.length);
  
  // ヘッダー内のナビゲーションのみ取得
  const headerOnlyStructure = doc.getPageStructure({
    headerNavigationOnly: true
  });
  
  console.log("ヘッダー内のナビゲーション数:", headerOnlyStructure.navigations.length);
  headerOnlyStructure.navigations.forEach(nav => {
    console.log(`- ${nav.type}: ${nav.items.length}個のアイテム`);
  });
  
} catch (error) {
  console.error("エラー:", error.message);
}

// 本文抽出と組み合わせた使用例
console.log("\n\n=== 本文抽出と組み合わせた使用例 ===\n");

const mainContent = doc.toMarkdown();
const structure = doc.getPageStructure();

console.log("ページタイプ:", doc.inferPageType());
console.log("本文の文字数:", mainContent.length);
console.log("グローバルナビゲーション:", structure.mainNavigation ? "あり" : "なし");
console.log("パンくずリスト:", structure.breadcrumb ? "あり" : "なし");
console.log("目次:", structure.toc ? "あり" : "なし");