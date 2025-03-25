import { test, expect, describe } from 'vitest';
import { parseHTML } from './parser';
import { extractContent, isProbablyContent } from './core';
import type { VElement, VTextNode } from './types';

// 基本的なテストケース
const BASIC_HTML = `
<html>
  <head>
    <title>テストページ</title>
  </head>
  <body>
    <div id="content">
      <h1>テスト記事のタイトル</h1>
      <p class="byline">著者: テスト太郎</p>
      <p>これはテスト記事の本文です。Readabilityのテストに使用します。</p>
      <p>十分な長さのテキストを持つ段落が必要です。これは本文として検出されるべき段落です。
      実際の記事では、このような長い段落がいくつか含まれていることが一般的です。
      テキストの長さはスコアリングアルゴリズムにおいて重要な要素となります。</p>
    </div>
  </body>
</html>
`;

// セマンティックタグを使用したHTML
const SEMANTIC_HTML = `
<html>
  <head>
    <title>セマンティックタグのテスト</title>
  </head>
  <body>
    <header>
      <h1>ウェブサイトのヘッダー</h1>
      <nav>
        <ul>
          <li><a href="#">ホーム</a></li>
          <li><a href="#">About</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <article>
        <h1>記事のタイトル</h1>
        <p>これは記事の本文です。セマンティックタグを使用しています。</p>
        <p>この段落はarticleタグ内にあり、本文として検出されるべきです。
        十分な長さのテキストを持つことで、スコアリングアルゴリズムによって
        重要なコンテンツとして認識されます。</p>
      </article>
    </main>
    <footer>
      <p>Copyright 2025</p>
    </footer>
  </body>
</html>
`;

// 複数の候補がある複雑なHTML
const COMPLEX_HTML = `
<html>
  <head>
    <title>複雑なレイアウト</title>
  </head>
  <body>
    <header class="site-header">
      <h1>ニュースサイト</h1>
      <nav>メニュー項目がここに入ります</nav>
    </header>
    <div class="container">
      <div class="sidebar">
        <div class="widget">
          <h3>関連記事</h3>
          <ul>
            <li><a href="#">記事1</a></li>
            <li><a href="#">記事2</a></li>
          </ul>
        </div>
      </div>
      <div class="content">
        <h1>メインコンテンツのタイトル</h1>
        <div class="meta">
          <span class="author">著者: コンテンツ作成者</span>
          <span class="date">2025年3月25日</span>
        </div>
        <p>これはメインコンテンツの最初の段落です。この部分は本文として検出されるべきです。</p>
        <p>これは二つ目の段落です。十分な長さのテキストを持つことで、スコアリングアルゴリズムによって
        重要なコンテンツとして認識されます。実際の記事では、このような長い段落がいくつか含まれていることが
        一般的です。テキストの長さはスコアリングアルゴリズムにおいて重要な要素となります。</p>
        <p>三つ目の段落もあります。複数の段落があることで、このdiv要素のスコアが高くなります。</p>
      </div>
      <div class="comments">
        <h3>コメント</h3>
        <div class="comment">
          <p>これは記事へのコメントです。長いコメントかもしれませんが、本文ではありません。
          コメントセクションは通常、本文から除外されるべきです。</p>
        </div>
      </div>
    </div>
    <footer>
      <p>フッター情報がここに入ります</p>
    </footer>
  </body>
</html>
`;

// リンク密度が高いHTML
const HIGH_LINK_DENSITY_HTML = `
<html>
  <body>
    <div class="navigation">
      <a href="#">リンク1</a>
      <a href="#">リンク2</a>
      <a href="#">リンク3</a>
      <a href="#">リンク4</a>
      <a href="#">リンク5</a>
      <span>ほんの少しのテキスト</span>
    </div>
    <div class="content">
      <p>これは本文です。リンクはほとんどありません。</p>
      <p>十分な長さのテキストを持つ段落が必要です。これは本文として検出されるべき段落です。
      実際の記事では、このような長い段落がいくつか含まれていることが一般的です。
      テキストの長さはスコアリングアルゴリズムにおいて重要な要素となります。</p>
      <a href="#">参考リンク</a>
    </div>
  </body>
</html>
`;

describe('Core Readability Functions', () => {
  test('isProbablyContent - 本文の可能性判定', () => {
    // 直接コンテンツ要素を作成してテスト
    const longText = `これは十分な長さのテキストを持つ段落です。これは本文として検出されるべき段落です。
    実際の記事では、このような長い段落がいくつか含まれていることが一般的です。
    テキストの長さはスコアリングアルゴリズムにおいて重要な要素となります。
    この段落は140文字以上あり、リンク密度も低いため、本文として検出されるはずです。`;
    
    const longParagraph: VElement = {
      nodeType: 'element',
      tagName: 'P',
      attributes: {},
      children: [
        {
          nodeType: 'text',
          textContent: longText,
          parent: undefined
        }
      ],
      className: 'content'
    };
    
    // 長いテキストを持つ段落は本文の可能性が高い
    expect(isProbablyContent(longParagraph)).toBe(true);
    
    // 短いテキストを持つヘッダー要素
    const header: VElement = {
      nodeType: 'element',
      tagName: 'H1',
      attributes: {},
      children: [
        {
          nodeType: 'text',
          textContent: '短いヘッダーテキスト',
          parent: undefined
        }
      ]
    };
    
    // ヘッダーは短いテキストなので、本文の可能性は低い
    expect(isProbablyContent(header)).toBe(false);
  });

  test('isProbablyContent - リンク密度の高い要素', () => {
    const doc = parseHTML(HIGH_LINK_DENSITY_HTML);
    
    // リンク密度が高いナビゲーション要素
    const navigation = doc.body.children.find(
      (child): child is VElement => child.nodeType === 'element' && child.className === 'navigation'
    );
    
    // 通常のコンテンツ要素
    const content = doc.body.children.find(
      (child): child is VElement => child.nodeType === 'element' && child.className === 'content'
    );
    
    if (navigation && navigation.nodeType === 'element') {
      // リンク密度が高いので、本文の可能性は低い
      expect(isProbablyContent(navigation)).toBe(false);
    }
    
    if (content && content.nodeType === 'element') {
      // リンク密度が低いので、本文の可能性は高い
      expect(isProbablyContent(content)).toBe(true);
    }
  });

  test('extractContent - 基本的なHTML', () => {
    const doc = parseHTML(BASIC_HTML);
    const result = extractContent(doc);
    
    // コンテンツが抽出されることを確認
    expect(result.root).not.toBeNull();
    
    // ノード数が計算されることを確認
    expect(result.nodeCount).toBeGreaterThan(0);
    
    // 抽出されたコンテンツにテスト記事のテキストが含まれることを確認
    if (result.root) {
      const contentText = result.root.children
        .filter((child): child is VElement => child.nodeType === 'element' && child.tagName === 'P')
        .map((p: VElement) => p.children
          .filter((c): c is VTextNode => c.nodeType === 'text')
          .map((t: VTextNode) => t.textContent)
          .join('')
        )
        .join('');
      
      expect(contentText).toContain('これはテスト記事の本文です');
    }
  });

  test('extractContent - セマンティックタグ', () => {
    const doc = parseHTML(SEMANTIC_HTML);
    const result = extractContent(doc);
    
    // コンテンツが抽出されることを確認
    expect(result.root).not.toBeNull();
    
    // ノード数が計算されることを確認
    expect(result.nodeCount).toBeGreaterThan(0);
    
    // 抽出されたコンテンツにarticleタグ内のテキストが含まれることを確認
    if (result.root) {
      const isArticleOrContainsArticle = 
        result.root.tagName === 'ARTICLE' ||
        result.root.children.some((child): boolean => 
          child.nodeType === 'element' && child.tagName === 'ARTICLE'
        );
      
      expect(isArticleOrContainsArticle).toBe(true);
    }
  });

  test('extractContent - 複雑なHTML', () => {
    const doc = parseHTML(COMPLEX_HTML);
    const result = extractContent(doc);
    
    // コンテンツが抽出されることを確認
    expect(result.root).not.toBeNull();
    
    // ノード数が計算されることを確認
    expect(result.nodeCount).toBeGreaterThan(0);
    
    // 抽出されたコンテンツにメインコンテンツのテキストが含まれることを確認
    if (result.root) {
      // contentクラスの要素またはその親要素が選択されていることを確認
      const contentOrParentOfContent = 
        result.root.className === 'content' ||
        result.root.children.some((child): boolean => 
          child.nodeType === 'element' && child.className === 'content'
        );
      
      expect(contentOrParentOfContent).toBe(true);
    }
  });
});
