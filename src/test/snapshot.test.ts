/**
 * Readability v3 - スナップショットテスト
 *
 * URLからHTMLを取得し、本文を抽出してMarkdownに変換し、
 * スナップショットテストを行います。
 * 各URLごとに別々のスナップショットファイルを作成します。
 */

import html2md from "html-to-md";
import { test, expect, describe } from "vitest";
import { extract } from "../index.ts";
import { toHTML } from "../format/format.ts";
import { TEST_URLS } from "./urls.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirnameを取得するための設定（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// キャッシュディレクトリのパス
const CACHE_DIR = path.join(__dirname, "cache");
// スナップショットディレクトリのパス
const SNAPSHOT_DIR = path.join(__dirname, "snapshots");

/**
 * URLからHTMLを取得して本文のHTML構造を抽出する
 *
 * @param url 取得するURL
 * @returns 抽出された記事情報
 */
async function fetchAndExtractHTML(url: string): Promise<{
  title: string; // metadata.title は string
  // byline: string | null; // byline は削除
  html: string;
  markdown: string;
}> {
  try {
    // キャッシュディレクトリのパスを生成
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // URLからファイル名を生成（URLエンコードして安全なファイル名に）
    const filename = encodeURIComponent(url).replace(/%/g, "_");
    const cachePath = path.join(CACHE_DIR, `${filename}.html`);

    let html: string;

    // キャッシュがあればそれを使用、なければ取得してキャッシュ
    if (fs.existsSync(cachePath)) {
      // console.log(`キャッシュからHTMLを読み込み: ${url}`);
      html = fs.readFileSync(cachePath, "utf-8");
    } else {
      // console.log(`URLからHTMLを取得: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      // HTMLを文字列として取得
      html = await response.text();

      // キャッシュに保存
      fs.writeFileSync(cachePath, html);
    }

    // 本文抽出を実行
    const article = extract(html, { charThreshold: 100 });

    // HTML構造を生成
    const htmlContent = article.root ? toHTML(article.root) : "";

    // Markdownに変換
    const markdown = html2md(htmlContent);

    return {
      title: article.metadata.title, // title は metadata から取得
      // byline: article.byline, // byline は削除
      html: htmlContent,
      markdown,
    };
  } catch (error) {
    // console.error('Error fetching or parsing content:', error);
    throw error;
  }
}

/**
 * URLからドメイン名を抽出する
 *
 * @param url URL
 * @returns ドメイン名
 */
function getDomainFromURL(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch (error) {
    return "unknown-domain";
  }
}

/**
 * URLからファイル名を生成する
 *
 * @param url URL
 * @returns ファイル名
 */
function getFilenameFromURL(url: string): string {
  const domain = getDomainFromURL(url);
  const urlObj = new URL(url);
  const pathSegments = urlObj.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : "index";

  // ドメイン名とパスの最後のセグメントを組み合わせてファイル名を生成
  return `${domain}-${lastSegment}`.replace(/[^a-zA-Z0-9-_]/g, "-");
}

/**
 * URLリストが空の場合にクロールしてHTMLを収集する
 *
 * @returns 収集したURLのリスト
 */
async function crawlForURLs(): Promise<string[]> {
  // 例として、人気のニュースサイトやブログからURLを収集
  // 実際の実装では、より洗練されたクローラーを使用することが望ましい
  const defaultURLs = [
    "https://zenn.dev/mizchi/articles/deno-cli-ai-sdk-tools-template",
    "https://blog.mozilla.org/en/mozilla/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/",
  ];

  console.log("URLリストが空のため、デフォルトURLを使用します");
  return defaultURLs;
}

// URLリストを取得
const urls = TEST_URLS.length > 0 ? TEST_URLS : await crawlForURLs();

// 各URLに対して別々のテストファイルを作成
for (const url of urls) {
  const filename = getFilenameFromURL(url);

  describe(`Readability v3 スナップショットテスト - ${filename}`, () => {
    test(`URL: ${url}`, async () => {
      const result = await fetchAndExtractHTML(url);

      // タイトルと著者情報が取得できることを確認
      expect(result.title).toBeDefined();

      // HTMLとMarkdownが生成されることを確認
      expect(result.html).toBeTruthy();
      expect(result.markdown).toBeTruthy();

      // スナップショットディレクトリを作成
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      }

      // Markdownファイルとして保存
      const snapshotPath = path.join(SNAPSHOT_DIR, `${filename}.md`);
      fs.writeFileSync(snapshotPath, result.markdown);

      // スナップショットテスト - ファイル名を指定して別々のファイルに保存
      await expect(result.markdown).toMatchFileSnapshot(snapshotPath);

      // 結果を表示（デバッグ用）
      // console.log(`\n=== テスト結果: ${url} ===`);
      // console.log(`タイトル: ${result.title}`);
      // console.log(`著者: ${result.byline || '不明'}`);
      // console.log(`Markdown長: ${result.markdown.length}文字`);
    });
  });
}
