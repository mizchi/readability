/**
 * Readability v3 - HTML抽出例
 * 
 * URLからHTMLを取得して本文のHTML構造をそのまま出力する例
 */

import { extract } from '../v3/index.ts';
import type { ReadabilityArticle } from '../v3/types.ts';
import { elementToHTML, stringify } from '../v3/format.ts';
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
    const article = extract(html, { charThreshold: 100 });
    
    return article;
  } catch (error) {
    console.error('Error fetching or parsing content:', error);
    throw error;
  }
}

/**
 * 指定されたURLから記事を抽出してHTML構造を表示する
 */
async function main(url: string) {
  try {
    // Zenn記事のURLを指定
    // const url = ;
    
    console.log(`Fetching and extracting HTML content from: ${url}`);
    
    // 記事を抽出
    const article = await fetchAndExtractHTML(url);
    
    // 結果を表示
    console.log('\n=== 抽出結果 ===\n');
    console.log(`タイトル: ${article.title}`);
    console.log(`著者: ${article.byline || '不明'}`);
    console.log(`ノード数: ${article.nodeCount}`);
    
    if (article.root) {
      // HTML構造を生成
      const htmlContent = elementToHTML(article.root);
      
      // HTML構造を表示
      // console.log('\n=== HTML構造 ===\n');
      // console.log(htmlContent);
    
      // Markdownに変換
      const md = html2md(htmlContent);
      console.log('\n=== Markdown ===\n');
      console.log(md);

      // stringy
      // const str = stringify(article.root);
      // console.log('\n=== Stringify ===\n');
      // console
      // console.log(str);
      // const outputPath = 'output.html';
    }
    // fs.writeFileSync(outputPath, fullHTML);
    // console.log(`\nHTML content saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main(process.argv[2] ?? 'https://zenn.dev/mizchi/articles/deno-cli-ai-sdk-tools-template');
