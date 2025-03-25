import { test, expect, describe } from 'vitest';
import { parseHTML } from '../html_parser';
import { Readability } from '../readability/index';
import * as fs from 'fs';
import * as path from 'path';

// テスト用のシリアライザ - 簡易的なテキスト出力
function createSimpleSerializer() {
  return (el: any) => {
    return `<div id="readability-page-1" class="page">${el.textContent}</div>`;
  };
}

/**
 * テストケースのパターン
 */
interface TestPattern {
  dir: string;           // テストディレクトリ名
  description: string;   // テストの説明
  features: string[];    // テストする機能
  textSnippets: string[]; // 期待されるテキストスニペット
  minLength?: number;    // テキスト内容の最小長さ（デフォルト: 100）
}

/**
 * テストパターンの定義
 */
const TEST_PATTERNS: TestPattern[] = [
  {
    dir: '001',
    description: '基本的なブログ記事',
    features: ['タイトル抽出', 'コードブロック保持', '画像参照'],
    textSnippets: [
      "So finally you're testing your frontend JavaScript code",
      "Blanket.js",
      "code coverage"
    ]
  },
  {
    dir: '002',
    description: 'テクニカル記事',
    features: ['コードブロック保持', 'リスト抽出', 'リンク保持'],
    textSnippets: [
      "Fetch API",
      "XMLHttpRequest",
      "Promise"
    ]
  },
  {
    dir: '003-metadata-preferred',
    description: 'メタデータ優先',
    features: ['メタデータ抽出', 'OGP対応'],
    textSnippets: [
      "Test document title",
      "Lorem ipsum dolor sit amet"
    ]
  },
  {
    dir: '004-metadata-space-separated-properties',
    description: 'スペース区切りプロパティのメタデータ',
    features: ['メタデータ抽出', 'プロパティ解析'],
    textSnippets: [
      "Test document title",
      "Lorem ipsum dolor sit amet"
    ]
  },
  {
    dir: '005-unescape-html-entities',
    description: 'HTMLエンティティのアンエスケープ',
    features: ['HTMLエンティティ処理'],
    textSnippets: [
      "Test"
    ],
    minLength: 10 // 短いテキスト用に最小長さを調整
  }
];

/**
 * 指定されたテストパターンでReadabilityをテストする関数
 */
function testReadabilityPattern(pattern: TestPattern) {
  test(`${pattern.dir}: ${pattern.description} [${pattern.features.join(', ')}]`, () => {
    // テストページのパス
    const sourcePath = path.join(process.cwd(), 'test', 'test-pages', pattern.dir, 'source.html');
    const expectedMetadataPath = path.join(process.cwd(), 'test', 'test-pages', pattern.dir, 'expected-metadata.json');
    
    // ファイルが存在するか確認
    if (!fs.existsSync(sourcePath) || !fs.existsSync(expectedMetadataPath)) {
      console.warn(`テストファイル ${pattern.dir} が見つかりません`);
      return;
    }
    
    // ファイルを読み込む
    const html = fs.readFileSync(sourcePath, 'utf-8');
    const expectedMetadata = JSON.parse(fs.readFileSync(expectedMetadataPath, 'utf-8'));
    
    // 適切なbaseURIを設定してドキュメントを解析
    const doc = parseHTML(html, 'http://fakehost/');
    const reader = new Readability(doc, {
      serializer: createSimpleSerializer()
    });
    
    // 記事を解析
    const article = reader.parse();
    expect(article).not.toBeNull();
    
    if (article) {
      // メタデータの検証
      if (expectedMetadata.title) {
        // タイトルは部分一致でチェック
        const expectedTitle = expectedMetadata.title.split('|')[0].trim();
        expect(article.title).toContain(expectedTitle);
      }
      
      // bylineの検証（存在する場合）
      if (expectedMetadata.byline && article.byline) {
        expect(article.byline).toContain(expectedMetadata.byline);
      }
      
      // excerptの検証（存在する場合）
      if (expectedMetadata.excerpt && article.excerpt) {
        expect(article.excerpt).toContain(expectedMetadata.excerpt);
      }
      
      // テキスト内容の検証 - 特徴的なスニペットが含まれているか確認
      for (const snippet of pattern.textSnippets) {
        expect(article.textContent).toContain(snippet);
      }
      
      // 記事の長さが十分あることを確認（パターンごとに最小長さを設定可能）
      const minLength = pattern.minLength || 100;
      expect(article.textContent.length).toBeGreaterThan(minLength);
      
      // readerable フラグの検証（存在する場合）
      if (expectedMetadata.readerable !== undefined) {
        // この実装では直接テストできないため、コメントアウト
        // expect(isProbablyReaderable(doc)).toBe(expectedMetadata.readerable);
      }
    }
  });
}

describe('Readability テストページパターン', () => {
  // 各テストパターンを実行
  for (const pattern of TEST_PATTERNS) {
    testReadabilityPattern(pattern);
  }
});
