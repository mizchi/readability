// オリジナルのReadabilityを使用したテスト
const { JSDOM } = require('jsdom');
const { Readability } = require('./index');

// test-blog.tsからHTMLデータを取得
const blogHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>テストブログ記事 - サンプルブログ</title>
  <meta property="og:title" content="テストブログ記事">
  <meta property="og:site_name" content="サンプルブログ">
  <meta property="og:description" content="これはReadabilityのテスト用のブログ記事です。">
  <meta name="author" content="テスト著者">
  <meta property="article:published_time" content="2025-03-25T12:00:00+09:00">
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; color: #333; }
    header { background: #f5f5f5; padding: 20px; border-bottom: 1px solid #ddd; }
    nav { background: #eee; padding: 10px; }
    nav ul { list-style: none; display: flex; gap: 20px; }
    main { max-width: 800px; margin: 0 auto; padding: 20px; }
    .sidebar { float: right; width: 200px; background: #f9f9f9; padding: 15px; margin-left: 15px; }
    footer { background: #333; color: white; padding: 20px; text-align: center; }
    .ad { background: #ffeeee; padding: 10px; margin: 10px 0; text-align: center; }
    .comments { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <header>
    <h1>サンプルブログ</h1>
    <p>テクノロジーとプログラミングについて</p>
  </header>
  
  <nav>
    <ul>
      <li><a href="/">ホーム</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/articles">記事一覧</a></li>
      <li><a href="/contact">お問い合わせ</a></li>
    </ul>
  </nav>
  
  <main>
    <article>
      <h1>TypeScriptで型安全なコードを書く方法</h1>
      <p class="meta">投稿日: 2025年3月25日 | 著者: テスト著者 | カテゴリ: <a href="/category/typescript">TypeScript</a></p>
      
      <div class="sidebar">
        <h3>関連記事</h3>
        <ul>
          <li><a href="/articles/javascript-basics">JavaScript基礎</a></li>
          <li><a href="/articles/typescript-generics">TypeScriptのジェネリクス</a></li>
          <li><a href="/articles/react-typescript">ReactとTypeScript</a></li>
        </ul>
        <div class="ad">
          <p>広告: プログラミング書籍セール中！</p>
        </div>
      </div>
      
      <p>TypeScriptは、JavaScriptに静的型付けを追加した言語です。型安全なコードを書くことで、多くのバグを未然に防ぐことができます。</p>
      
      <h2>型アノテーションの基本</h2>
      <p>TypeScriptでは、変数や関数の引数、戻り値に型を指定することができます。これにより、コンパイル時に型の不一致を検出できます。</p>
      
      <pre><code>
// 変数の型アノテーション
const name: string = "John";
const age: number = 30;
const isActive: boolean = true;

// 関数の型アノテーション
function greet(person: string): string {
  return \`Hello, \${person}!\`;
}
      </code></pre>
      
      <h2>インターフェースと型エイリアス</h2>
      <p>複雑な型を定義するには、インターフェースや型エイリアスを使用します。</p>
      
      <pre><code>
// インターフェース
interface User {
  id: number;
  name: string;
  email: string;
  isAdmin?: boolean; // オプショナルプロパティ
}

// 型エイリアス
type Point = {
  x: number;
  y: number;
};
      </code></pre>
      
      <h2>ジェネリクス</h2>
      <p>ジェネリクスを使用すると、型の再利用性が高まります。特に、配列や関数で使用すると便利です。</p>
      
      <pre><code>
// ジェネリック関数
function identity<T>(arg: T): T {
  return arg;
}

// 使用例
const num = identity<number>(42);
const str = identity<string>("Hello");
      </code></pre>
      
      <p>TypeScriptの型システムを活用することで、コードの品質が向上し、メンテナンス性も高まります。特に大規模なプロジェクトでは、型の恩恵を大きく受けることができるでしょう。</p>
      
      <h2>型ガード</h2>
      <p>型ガードを使用すると、条件分岐内で変数の型を絞り込むことができます。これにより、型安全な方法で異なる型を処理できます。</p>
      
      <pre><code>
// 型ガードの例
function processValue(value: string | number) {
  if (typeof value === "string") {
    // この中ではvalueはstring型
    return value.toUpperCase();
  } else {
    // この中ではvalueはnumber型
    return value.toFixed(2);
  }
}
      </code></pre>
      
      <div class="ad">
        <p>広告: TypeScript入門コース - 今なら30%オフ！</p>
      </div>
      
      <h2>まとめ</h2>
      <p>TypeScriptの型システムを活用することで、より安全で保守性の高いコードを書くことができます。型アノテーション、インターフェース、ジェネリクス、型ガードなどの機能を使いこなすことで、開発効率も向上するでしょう。</p>
    </article>
    
    <!-- コメントセクション - Readabilityで除外されるべき -->
    <div id="comments" class="comments comment-section">
      <h3>コメント (3)</h3>
      <div class="comment">
        <p><strong>山田太郎</strong> - 2025年3月25日 13:45</p>
        <p>とても参考になりました！TypeScriptの型ガードについてもっと詳しく知りたいです。</p>
      </div>
      <div class="comment">
        <p><strong>佐藤花子</strong> - 2025年3月25日 14:30</p>
        <p>ジェネリクスの説明がわかりやすかったです。実際のプロジェクトでも活用してみます。</p>
      </div>
      <div class="comment">
        <p><strong>鈴木一郎</strong> - 2025年3月25日 15:10</p>
        <p>TypeScriptを使い始めたばかりですが、この記事のおかげで型の重要性がよくわかりました。</p>
      </div>
    </div>
  </main>
  
  <!-- フッター - Readabilityで除外されるべき -->
  <footer id="footer" class="site-footer footer">
    <p>&copy; 2025 サンプルブログ. All rights reserved.</p>
    <p>
      <a href="/privacy">プライバシーポリシー</a> |
      <a href="/terms">利用規約</a> |
      <a href="/contact">お問い合わせ</a>
    </p>
  </footer>
</body>
</html>
`;

// HTMLをパースしてDOMを作成
function testOriginalReadability() {
  console.log('=== オリジナルReadabilityによるブログHTMLのパースと本文抽出テスト ===\n');
  
  // HTMLをパース
  console.log('1. HTMLをパースしています...');
  const dom = new JSDOM(blogHTML, {
    url: 'https://example.com/blog/typescript-safety'
  });
  const doc = dom.window.document;
  
  // Readabilityを使用して本文を抽出
  console.log('2. Readabilityを使用して本文を抽出しています...');
  const reader = new Readability(doc);
  const article = reader.parse();
  
  if (!article) {
    console.log('記事の抽出に失敗しました。');
    return;
  }
  
  // 結果を表示
  console.log('\n=== 抽出結果 ===\n');
  console.log(`タイトル: ${article.title}`);
  console.log(`著者: ${article.byline}`);
  console.log(`サイト名: ${article.siteName}`);
  console.log(`公開日時: ${article.publishedTime}`);
  console.log(`抜粋: ${article.excerpt}`);
  console.log(`テキスト長: ${article.length}文字`);
  
  console.log('\n=== 抽出されたHTML ===\n');
  console.log(article.content);
  
  console.log('\n=== 抽出されたテキスト ===\n');
  console.log(article.textContent);
}

// テストを実行
testOriginalReadability();
