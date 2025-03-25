import { test, expect, describe } from 'vitest';
import { parseHTML } from '../html_parser';
import { Readability } from '../readability/index';

// メタデータテスト用のHTMLサンプル
const METADATA_HTML = `
<html>
  <head>
    <title>メタデータテスト</title>
    <meta name="author" content="テスト著者">
    <meta name="description" content="これはメタデータのテスト用の説明文です。">
    <meta property="og:site_name" content="テストサイト">
    <meta property="article:published_time" content="2025-03-25T12:00:00Z">
  </head>
  <body>
    <article>
      <h1>メタデータテストの記事</h1>
      <p class="byline">著者: テスト太郎</p>
      <p>これはメタデータテスト用の記事本文です。</p>
    </article>
  </body>
</html>
`;

describe('Readability メタデータ抽出', () => {
  test('メタデータが正しく抽出される', () => {
    const doc = parseHTML(METADATA_HTML);
    const reader = new Readability(doc, {
      serializer: (el) => {
        // 簡易的なシリアライザ - 親参照を除外
        const simpleEl = { 
          tagName: el.tagName,
          textContent: el.children
            .filter(child => child.nodeType === 'text')
            .map(child => (child as any).textContent)
            .join('')
        };
        return JSON.stringify(simpleEl);
      }
    });
    
    const article = reader.parse();
    
    // 記事が解析されたことを確認
    expect(article).not.toBeNull();
    
    if (article) {
      // タイトルの確認
      expect(article.title).toBe('メタデータテスト');
      
      // bylineの確認（metaタグまたはbylineクラスから抽出）
      expect(article.byline).toBeTruthy();
      
      // excerptの確認（metaタグのdescriptionから抽出）
      expect(article.excerpt).toBeTruthy();
      if (article.excerpt) {
        expect(article.excerpt).toContain('メタデータのテスト用の説明文');
      }
      
      // サイト名の確認（og:site_nameから抽出）
      expect(article.siteName).toBeTruthy();
      if (article.siteName) {
        expect(article.siteName).toContain('テストサイト');
      }
      
      // 公開日時の確認（article:published_timeから抽出）
      expect(article.publishedTime).toBeTruthy();
      if (article.publishedTime) {
        expect(article.publishedTime).toContain('2025-03-25');
      }
    }
  });
});
