import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extract } from "../src/index.ts"; // プロジェクトルートからの相対パス
import { toHTML } from "../src/format.ts"; // プロジェクトルートからの相対パス
import html2md from "html-to-md";

// __dirnameを取得するための設定（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テストケースのディレクトリパス
// process.cwd() を使うように変更
const TEST_PAGES_DIR = path.resolve(process.cwd(), "test/test-pages");

// HTML を正規化する関数
function normalizeHtml(html: string): string {
  // 比較しやすくするため、スペース1つに正規化し、前後の空白を除去
  return html.replace(/\s+/g, " ").trim();
}

// 002 のテストケースを読み込む
const dir = "002";
const sourcePath = path.join(TEST_PAGES_DIR, dir, "source.html");
const expectedPath = path.join(TEST_PAGES_DIR, dir, "expected.html");

try {
  const source = fs.readFileSync(sourcePath, "utf-8");
  const expected = fs.readFileSync(expectedPath, "utf-8");

  // 新しい実装で HTML を抽出
  const article = extract(source);
  const newReadabilityHTML = article.root ? toHTML(article.root) : "";

  // --- デバッグログ追加 ---
  if (article.root) {
    console.log("\n--- Extracted Root Element ---");
    console.log(
      `Tag: ${article.root.tagName}, ID: ${article.root.id}, Class: ${article.root.className}`
    );
  } else {
    console.log("\n--- No root element extracted ---");
  }

  // HTML を正規化
  const normExpectedHTML = html2md(normalizeHtml(expected));
  const normNewReadabilityHTML = html2md(normalizeHtml(newReadabilityHTML));

  // 結果を出力
  console.log(`--- Debugging Test Case ${dir} ---`);
  console.log("\n--- Expected HTML (Normalized) ---");
  console.log(normExpectedHTML);
  console.log("\n--- New Readability HTML (Normalized) ---");
  console.log(normNewReadabilityHTML);
  console.log("\n------------------------------------");

  // 文字列の差分を確認 (簡単な比較)
  if (normExpectedHTML === normNewReadabilityHTML) {
    console.log("\n✅ Normalized HTML strings are identical.");
  } else {
    console.log("\n❌ Normalized HTML strings differ.");
    // より詳細な差分表示が必要な場合は、差分ライブラリの導入を検討
    // 例: diff パッケージなど
    /*
    import * as Diff from 'diff';
    const diff = Diff.diffChars(normExpectedHTML, normNewReadabilityHTML);
    diff.forEach((part) => {
      const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
      // process.stderr.write(part.value[color]); // 色付けして出力 (要 chalk など)
      process.stderr.write(part.value);
    });
    console.log();
    */
    // 差分箇所を簡易的に表示
    const len = Math.min(
      normExpectedHTML.length,
      normNewReadabilityHTML.length
    );
    let diffIndex = -1;
    for (let i = 0; i < len; i++) {
      if (normExpectedHTML[i] !== normNewReadabilityHTML[i]) {
        diffIndex = i;
        break;
      }
    }
    if (diffIndex !== -1) {
      console.log(`\nDifference found around index ${diffIndex}:`);
      console.log(
        "Expected : ..." +
          normExpectedHTML.substring(
            Math.max(0, diffIndex - 30),
            Math.min(normExpectedHTML.length, diffIndex + 30)
          ) +
          "..."
      );
      console.log(
        "Actual   : ..." +
          normNewReadabilityHTML.substring(
            Math.max(0, diffIndex - 30),
            Math.min(normNewReadabilityHTML.length, diffIndex + 30)
          ) +
          "..."
      );
    } else if (normExpectedHTML.length !== normNewReadabilityHTML.length) {
      console.log("\nHTML strings have different lengths.");
      console.log(
        `Expected length: ${normExpectedHTML.length}, Actual length: ${normNewReadabilityHTML.length}`
      );
      const shorterLen = Math.min(
        normExpectedHTML.length,
        normNewReadabilityHTML.length
      );
      console.log(
        "Expected end: ..." + normExpectedHTML.substring(shorterLen - 60)
      );
      console.log(
        "Actual end  : ..." + normNewReadabilityHTML.substring(shorterLen - 60)
      );
    }
  }
} catch (error) {
  console.error(`Error loading or processing test case ${dir}:`, error);
}
