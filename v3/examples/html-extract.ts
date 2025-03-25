/**
 * Readability v3 - HTML抽出例
 * 
 * URLからHTMLを取得して本文のHTML構造をそのまま出力する例
 */

import { parse } from '../index.ts';
import type { ReadabilityArticle } from '../types.ts';
import html2md from "html-to-md";
/**
 * URLからHTMLを取得して本文のHTML構造を抽出する
 * 
 * @param url 取得するURL
 * @returns 抽出された記事情報
 */
export async function fetchAndExtractHTML(url: string): Promise<ReadabilityArticle> {
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
 * 指定されたURLから記事を抽出してHTML構造を表示する
 */
async function main() {
  try {
    // Zenn記事のURLを指定
    const url = 'https://zenn.dev/mizchi/articles/deno-cli-ai-sdk-tools-template';
    
    console.log(`Fetching and extracting HTML content from: ${url}`);
    
    // 記事を抽出
    const article = await fetchAndExtractHTML(url);
    
    // 結果を表示
    console.log('\n=== 抽出結果 ===\n');
    console.log(`タイトル: ${article.title}`);
    console.log(`著者: ${article.byline || '不明'}`);
    console.log(`サイト名: ${article.siteName || '不明'}`);
    console.log(`抜粋: ${article.excerpt || '抜粋なし'}`);
    console.log(`本文長: ${article.length} 文字`);
    
    // HTML構造を表示
    console.log('\n=== HTML構造 ===\n');
    console.log(article.contentHTML);    
    const md = html2md(article.contentHTML);
    console.log(md);
    // fs.writeFileSync(outputPath, fullHTML);
    // console.log(`\nHTML content saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
