import { test, expect, describe, beforeEach } from 'vitest';
import { parseHTML } from '../html_parser';
import { Readability } from '../readability/index';

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
    </div>
  </body>
</html>
`;

describe('Readability', () => {
  test('コンストラクタのオプション設定', () => {
    const doc = parseHTML('<html><div>テスト</div></html>');
    
    // デフォルト設定
    const reader1 = new Readability(doc);
    expect(reader1['_debug']).toBe(false);
    expect(reader1['_nbTopCandidates']).toBe(5);
    expect(reader1['_maxElemsToParse']).toBe(0);
    expect(reader1['_keepClasses']).toBe(false);
    
    // カスタム設定
    const reader2 = new Readability(doc, { 
      debug: true,
      nbTopCandidates: 10,
      maxElemsToParse: 100,
      keepClasses: true
    });
    expect(reader2['_debug']).toBe(true);
    expect(reader2['_nbTopCandidates']).toBe(10);
    expect(reader2['_maxElemsToParse']).toBe(100);
    expect(reader2['_keepClasses']).toBe(true);
  });

  test('基本的な記事の解析', () => {
    const doc = parseHTML(BASIC_HTML);
    // カスタムシリアライザを使用して循環参照を回避
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
      // タイトルが抽出されたことを確認（titleタグの内容が使用される）
      expect(article.title).toContain('テストページ');
      
      // 本文が抽出されたことを確認
      expect(article.textContent).toContain('これはテスト記事の本文です');
      
      // コンテンツが存在することを確認
      expect(article.content).toBeTruthy();
    }
  });

  test('maxElemsToParse制限', () => {
    const doc = parseHTML('<html><div>1</div><div>2</div><div>3</div></html>');
    const reader = new Readability(doc, { maxElemsToParse: 2 });
    
    // 要素数が制限を超えているため、エラーがスローされることを確認
    expect(() => reader.parse()).toThrow('Aborting parsing document');
  });
});
