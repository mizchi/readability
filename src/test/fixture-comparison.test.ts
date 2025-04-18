import { test, expect, describe } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extract } from "../index";
import { toHTML } from "../format/format"; // extractTextContent は不要になったため削除

// __dirnameを取得するための設定（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テストケースのディレクトリパス
const TEST_PAGES_DIR = path.resolve(__dirname, "../../test/test-pages");

// テストケースを読み込む関数
interface FixtureCase {
  dir: string;
  source: string;
  expected: string;
  metadata: Record<string, any>;
}

function loadTestCase(dir: string): FixtureCase | null {
  const sourcePath = path.join(TEST_PAGES_DIR, dir, "source.html");
  const expectedPath = path.join(TEST_PAGES_DIR, dir, "expected.html");
  const metadataPath = path.join(TEST_PAGES_DIR, dir, "expected-metadata.json");
  const source = fs.readFileSync(sourcePath, "utf-8");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  const expected = fs.readFileSync(expectedPath, "utf-8");
  return { dir, source, metadata, expected };
}

// テストケースのリストを元に戻す
const testCasesDirs = [
  "001",
  // "002",
  "003-metadata-preferred",
  "004-metadata-space-separated-properties",
  // "005-unescape-html-entities",
  "aclu",
  // "aktualne",
  // "archive-of-our-own",
  // "wordpress", // Add wordpress test case
];

function extractHTMLByNewReadability(source: string) {
  const article = extract(source);
  const content = article.root ? toHTML(article.root) : "";
  return content;
}

// HTML を正規化する関数
function normalizeHtml(html: string) {
  // Convert to lowercase and normalize whitespace
  return html.toLowerCase().replace(/\s+/g, " ");
}

// 各テストケースに対してテストを実行
describe("Readability Fixture Comparison Tests", () => {
  testCasesDirs.forEach((dir) => {
    const testCase = loadTestCase(dir);

    // テストケースの読み込みに失敗した場合はスキップ
    if (!testCase) {
      test.skip(`Skipping test case ${dir} due to loading error`, () => {});
      return;
    }

    test(`Test case ${dir}`, async () => {
      const { source, expected } = testCase;
      // HTML を正規化して比較
      const normExpectedHTML = normalizeHtml(expected);
      const article = extract(source); // extract の結果を保持
      const newReadabilityHTML = extractHTMLByNewReadability(source);
      const normNewReadabilityHTML = normalizeHtml(newReadabilityHTML);

      // 005 の場合のみログ出力
      if (dir === "005-unescape-html-entities") {
        console.log("--- 005 Source ---");
        console.log(source);
        console.log("--- 005 Expected ---");
        console.log(expected);
        console.log("--- 005 Actual Article ---");
        console.log(article); // article オブジェクトの内容を出力
        console.log("--- 005 Actual HTML ---");
        console.log(newReadabilityHTML); // 生成された HTML を出力
        console.log("--- 005 Normalized Expected ---");
        console.log(normExpectedHTML);
        console.log("--- 005 Normalized Actual ---");
        console.log(normNewReadabilityHTML);
      }

      // 正規化された HTML の長さで比率を計算
      const originalMainRatio = normExpectedHTML.length / source.length;
      const newMainRatio = normNewReadabilityHTML.length / source.length;

      // console.log は削除

      // with in range of 20% of original
      expect(newMainRatio).toBeGreaterThan(originalMainRatio * 0.8);
      expect(newMainRatio).toBeLessThan(originalMainRatio * 1.2);
    });
  });
});
