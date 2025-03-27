import { test, expect, describe } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readable } from "../readable";
import { LinkHierarchyAnalysis } from "../nav/hierarchy";
import type { LinkInfo } from "../types";

// __dirnameを取得するための設定（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// スナップショットとキャッシュのディレクトリパス
const SNAPSHOTS_DIR = path.resolve(__dirname, "./snapshots");
const CACHE_DIR = path.resolve(__dirname, "./cache");

// スナップショットファイルのリストを取得
const snapshotFiles = fs
  .readdirSync(SNAPSHOTS_DIR)
  .filter((file) => file.endsWith(".md"));

describe("Link Hierarchy Analysis for Snapshots", () => {
  snapshotFiles.forEach((filename) => {
    test(`Analyze link hierarchy for ${filename}`, () => {
      // ファイル名からURLとキャッシュファイルパスを生成
      let url;
      let cacheFilePath;

      // 各ファイル名に対応するキャッシュファイルを直接指定
      switch (filename) {
        case "automaton-media-com-monster-hunter-wilds-20250325-332715.md":
          url =
            "https://automaton-media.com/articles/newsjp/monster-hunter-wilds-20250325-332715/";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fautomaton-media.com_2Farticles_2Fnewsjp_2Fmonster-hunter-wilds-20250325-332715_2F.html"
          );
          break;
        case "blog-mozilla-org-firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide.md":
          url =
            "https://blog.mozilla.org/en/mozilla/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fblog.mozilla.org_2Fen_2Fmozilla_2Ffirefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide_2F.html"
          );
          break;
        case "en-wikipedia-org-Gradual_typing.md":
          url = "https://en.wikipedia.org/wiki/Gradual_typing";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fen.wikipedia.org_2Fwiki_2FGradual_typing.html"
          );
          break;
        case "newsletter-francofernando-com-advent-of-code.md":
          url = "https://newsletter.francofernando.com/p/advent-of-code";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fnewsletter.francofernando.com_2Fp_2Fadvent-of-code.html"
          );
          break;
        case "webkit-org-webkit-features-in-safari-16-1.md":
          url = "https://webkit.org/blog/13966/webkit-features-in-safari-16-1/";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fwebkit.org_2Fblog_2F13966_2Fwebkit-features-in-safari-16-1_2F.html"
          );
          break;
        case "www-cnn-co-jp-35230901-html.md":
          url = "https://www.cnn.co.jp/fringe/35230901.html";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fwww.cnn.co.jp_2Ffringe_2F35230901.html.html"
          );
          break;
        case "zenn-dev-deno-cli-ai-sdk-tools-template.md":
          url =
            "https://zenn.dev/mizchi/articles/deno-cli-ai-sdk-tools-template";
          cacheFilePath = path.join(
            CACHE_DIR,
            "https_3A_2F_2Fzenn.dev_2Fmizchi_2Farticles_2Fdeno-cli-ai-sdk-tools-template.html"
          );
          break;
        default:
          // console.warn(`No cache mapping for ${filename}`);
          return;
      }

      // キャッシュファイルを読み込む
      const htmlContent = fs.readFileSync(cacheFilePath, "utf-8");

      // readableを使用してコンテンツを解析（URLを指定）
      const readableInstance = readable(htmlContent, { url });

      // リンク階層分析を実行
      const hierarchy = readableInstance.getLinkHierarchy();

      // 結果を検証
      expect(hierarchy).toBeDefined();

      // スナップショットとして保存
      expect(hierarchy).toMatchSnapshot();
    });
  });
});
