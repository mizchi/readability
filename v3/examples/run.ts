/**
 * Readability v3 - 実行例
 * 
 * URLからHTMLを取得して本文抽出を実行する例
 */

import { parse } from '../index.ts';
import type { ReadabilityArticle } from '../types.ts';
import { extractTextContent, elementToHTML } from '../format.ts';

/**
 * URLからHTMLを取得して本文抽出を実行する
 * 
 * @param url 取得するURL
 * @returns 抽出された記事情報
 */
export async function fetchAndExtract(url: string): Promise<ReadabilityArticle> {
  try {
    // URLからHTMLを取得
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    // HTMLを文字列として取得
    const html = await response.text();
    
    // 本文抽出を実行
    const article = parse(html, { charThreshold: 100 });
    
    return article;
  } catch (error) {
    console.error('Error fetching or parsing content:', error);
    throw error;
  }
}

/**
 * 指定されたURLから記事を抽出して表示する
 */
async function main() {
  try {
    // Zenn記事のURLを指定
    const url = 'https://zenn.dev/mizchi/articles/deno-cli-ai-sdk-tools-template';
    
    console.log(`Fetching and extracting content from: ${url}`);
    
    // 記事を抽出
    const article = await fetchAndExtract(url);
    
    // 結果を表示
    console.log('\n=== 抽出結果 ===\n');
    console.log(`タイトル: ${article.title}`);
    console.log(`著者: ${article.byline || '不明'}`);
    console.log(`ノード数: ${article.nodeCount}`);
    
    // 本文のテキストを抽出
    if (article.root) {
      const textContent = extractTextContent(article.root);
      const htmlContent = elementToHTML(article.root);
      
      // テキストの長さを表示
      console.log(`本文長: ${textContent.length} 文字`);
      
      // 本文の一部を表示（最初の200文字）
      const previewText = textContent.length > 200 
        ? textContent.substring(0, 200) + '...' 
        : textContent;
      
      console.log('\n=== 本文プレビュー ===\n');
      console.log(previewText);
      
      console.log('\n=== HTML プレビュー ===\n');
      console.log(htmlContent.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// コマンドラインから実行された場合は main 関数を実行
// if (typeof process !== 'undefined' && process.argv[1] === __filename) {
  main();
// }
