// crawler/main.ts
import path from "node:path";
import fs from "node:fs/promises";
import { URL } from "node:url"; // URL パースに必要
import minimist from "minimist"; // コマンドライン引数解析
import { CacheLoader } from "./loader.ts";
import { Crawler } from "./crawler.ts";
import type { ILoader } from "./types.ts";
import { calculatePageRank } from "./pagerank.ts";
import { readable, PageType, type LinkInfo } from "../src/index.ts"; // LinkInfo もインポート

// --- 定数 ---
const ENTRY_POINT = "https://cnn.co.jp";
// const OUTPUT_DIR = "./crawler_output"; // デフォルト値は args パース後に設定

// --- メイン処理 ---
async function main() {
  const args = minimist(process.argv.slice(2), { string: ["o"] }); // -o を文字列として扱う
  const outputDirArg = args.o; // -o の値を取得
  const shouldGenerateOutput = typeof outputDirArg === "string"; // -o が文字列として指定されているか
  const OUTPUT_DIR = outputDirArg || "./crawler_output"; // 指定があればそれ、なければデフォルト

  // const loader: ILoader = new CacheLoader(1000); // Crawler 内部で生成するため不要
  const crawler = new Crawler(ENTRY_POINT, {
    // loader 引数を削除
    maxRequests: 50,
    maxDepth: 3,
    concurrentRequests: 2,
    epochSize: 10,
    outputDir: OUTPUT_DIR, // Crawler にも渡す
  });

  console.log(
    `[Crawler Start] Entry: ${ENTRY_POINT}, Max Depth: ${crawler["maxDepth"]}, Max Requests: ${crawler["maxRequests"]}, Concurrency: ${crawler["concurrentRequests"]}, Epoch Size: ${crawler["epochSize"]}`
  );

  try {
    // クロール実行
    while (!crawler.isFinished()) {
      const actions = crawler.getNextActions();
      if (actions.length === 0) break;
      await crawler.step(actions);
    }

    // writeFinalData は不要になった (Epoch で上書きされるため)
    // await crawler.writeFinalData();

    const visitedCount = crawler.getVisitedUrls().size;
    console.log(
      `\n[Crawler Finished] Total requests: ${crawler["totalRequestCount"]}. Visited ${visitedCount} unique URLs.`
    );

    // PageRank 計算と表示・保存
    if (visitedCount > 0) {
      console.log("\nCalculating PageRank...");
      const linkGraph = crawler.getLinkGraph();
      const visited = crawler.getVisitedUrls();
      const pageRanks = calculatePageRank(linkGraph, visited);
      const sortedRanks = Array.from(pageRanks.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      console.log("\nTop 10 Pages by PageRank:");
      sortedRanks.slice(0, 10).forEach(([url, rank], index) => {
        console.log(`  ${index + 1}. ${url} (Rank: ${rank.toFixed(6)})`); // PageRank 表示は残す
      });

      const ranksPath = path.join(OUTPUT_DIR, "_meta", "pageranks.json"); // 保存先を _meta/ に変更
      const ranksObj = Object.fromEntries(
        sortedRanks.map(([url, rank]) => [url, rank])
      );
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.mkdir(OUTPUT_DIR, { recursive: true }); // ディレクトリ作成をここでも確認
      await fs.writeFile(ranksPath, JSON.stringify(ranksObj, null, 2));
      console.log(`\nPageRank results saved to ${ranksPath}`);
    }

    // --- -o オプションが指定された場合の処理 ---
    // ドメインごとのページ情報を保持するマップ (ifブロックの外に移動)
    const pagesByDomain = new Map<
      string,
      Map<string, { title: string; mdPath: string }>
    >();
    if (shouldGenerateOutput) {
      console.log("\n[Output Generation Started] (-o option specified)");

      // 1. Markdown 生成
      // const markdownOutputDir = path.join(OUTPUT_DIR, "markdown"); // サブディレクトリ不要
      const visitedPath = path.join(OUTPUT_DIR, "_meta", "visited.json"); // 読み込み元を _meta/ に変更
      try {
        const visitedJson = await fs.readFile(visitedPath, "utf-8");
        const visitedUrls: string[] = JSON.parse(visitedJson);
        const visitedUrlSet = new Set(visitedUrls); // 相対パスチェック用に Set も用意
        console.log(`  Generating Markdown for ${visitedUrls.length} pages...`);

        // Markdown 生成用に別途 Loader を用意 (同じキャッシュディレクトリを指定)
        // const pagesByDomain = new Map<string, Map<string, { title: string; mdPath: string }>>(); // ドメインごとのページ情報 (移動済み)
        const outputLoader = new CacheLoader(
          0,
          path.join(OUTPUT_DIR, "_meta", "cache")
        ); // キャッシュディレクトリを更新 (_meta に変更)
        for (const url of visitedUrls) {
          try {
            const loadResult = await outputLoader.get(url); // outputLoader を使用
            const html = loadResult.content; // content を取り出す
            if (!html) {
              // console.warn(`    [Markdown Skip] No cache found for ${url}`);
              continue;
            }

            const readableInstance = readable(html, { url });
            const pageType = readableInstance.inferPageType();
            let outputContent = "";

            if (pageType === PageType.ARTICLE) {
              outputContent = readableInstance.toMarkdown();
              // console.log(`    [Markdown Gen (Article)] ${url}`);
            } else {
              // PageType.OTHER の場合はリンク階層を出力
              const hierarchy = readableInstance.getLinkHierarchy();
              outputContent = `# Links from ${url}\n\n`;
              const linkCategories = [
                { title: "Parent Links", links: hierarchy.parent }, // プロパティ名を修正
                { title: "Sibling Links", links: hierarchy.sibling }, // プロパティ名を修正
                { title: "Child Links", links: hierarchy.child }, // プロパティ名を修正
                { title: "External Links", links: hierarchy.external }, // プロパティ名を修正
              ];
              for (const category of linkCategories) {
                if (category.links.length > 0) {
                  outputContent += `## ${category.title}\n\n`;
                  category.links.forEach((link: LinkInfo) => {
                    // link に型注釈を追加
                    outputContent += `- [${link.text || link.href}](${link.href})\n`;
                  });
                  outputContent += "\n";
                }
              }
              // console.log(`    [Markdown Gen (Links)] ${url}`);
            }

            // URL から保存パスを生成
            const parsedUrl = new URL(url);
            let pathname = parsedUrl.pathname;
            // ルートパスや末尾スラッシュの場合、index.md とする
            if (pathname === "/" || pathname.endsWith("/")) {
              pathname = path.join(pathname, "index.md");
            } else if (pathname.toLowerCase().endsWith(".html")) {
              // .html で終わる場合は .md に置換
              pathname = pathname.slice(0, -5) + ".md";
            } else if (!path.extname(pathname)) {
              // 拡張子がない場合は .md を追加
              pathname += ".md";
            }
            // その他の拡張子 (.htm など) はそのまま
            // クエリパラメータをファイル名に含める場合 (オプション)
            // const search = parsedUrl.search.replace(/[?&=]/g, '_');
            // if (search) pathname += search;

            // ホスト名をディレクトリ構造に含める
            const saveDir = path.join(OUTPUT_DIR, parsedUrl.hostname);
            const relativeSavePath = pathname.startsWith("/")
              ? pathname.substring(1)
              : pathname;
            const savePath = path.join(saveDir, relativeSavePath);

            // --- 相対パス変換処理 ---
            const currentDir = path.dirname(savePath);
            outputContent = outputContent.replace(
              /\[([^\]]+)\]\(([^)]+)\)/g,
              (match, text, linkUrl) => {
                try {
                  const absoluteLinkUrl = new URL(linkUrl, url).toString(); // 絶対URLに解決
                  // クリーンアップ (フラグメント除去など、必要に応じて)
                  const cleanedLinkUrl = absoluteLinkUrl.split("#")[0];

                  if (visitedUrlSet.has(cleanedLinkUrl)) {
                    // 訪問済みリストにあれば相対パスを計算
                    const targetParsedUrl = new URL(cleanedLinkUrl);
                    let targetPathname = targetParsedUrl.pathname;
                    if (
                      targetPathname === "/" ||
                      targetPathname.endsWith("/")
                    ) {
                      targetPathname = path.join(targetPathname, "index.md");
                    } else if (targetPathname.toLowerCase().endsWith(".html")) {
                      targetPathname = targetPathname.slice(0, -5) + ".md";
                    } else if (!path.extname(targetPathname)) {
                      targetPathname += ".md";
                    }
                    const targetSavePath = path.join(
                      OUTPUT_DIR, // ベースは出力ディレクトリ
                      targetParsedUrl.hostname,
                      targetPathname.startsWith("/")
                        ? targetPathname.substring(1)
                        : targetPathname
                    );
                    const relativePath = path.relative(
                      currentDir,
                      targetSavePath
                    );
                    return `[${text}](${relativePath})`;
                  }
                } catch (e) {
                  // URL パースエラーなどは無視して元のリンクを維持
                }
                return match; // 変換しない場合は元の match を返す
              }
            );
            // --- 相対パス変換処理ここまで ---

            await fs.mkdir(path.dirname(savePath), { recursive: true });
            await fs.writeFile(savePath, outputContent, "utf-8");
            // console.log(`    [Markdown Saved] ${savePath}`);

            // ドメインごとのページ情報を保存
            // ドメインごとのページ情報を保存
            const articleTitle = readableInstance.snapshot.metadata.title; // snapshot.metadata.title を使用
            const title = articleTitle || url; // タイトルがなければ URL を使用
            const domain = parsedUrl.hostname;
            if (!pagesByDomain.has(domain)) {
              pagesByDomain.set(domain, new Map());
            }
            pagesByDomain.get(domain)!.set(url, { title, mdPath: savePath });
          } catch (err: any) {
            console.error(
              `    [Markdown Error] Failed to process ${url}:`,
              err.message
            );
          }
        }
        console.log(
          `  Markdown generation finished. Output directory: ${OUTPUT_DIR}` // markdownOutputDir を OUTPUT_DIR に修正
        );
      } catch (err: any) {
        console.error(
          `[Markdown Error] Failed to read ${visitedPath}:`,
          err.message
        );
      }

      // 2. ドメインごとの index.md 生成
      console.log("\n  Generating index.md for each domain...");
      for (const [domain, pages] of pagesByDomain.entries()) {
        const domainDir = path.join(OUTPUT_DIR, domain);
        const indexPath = path.join(domainDir, "index.md");
        let indexContent = `# Index for ${domain}\n\n`;

        // ページ情報をタイトルでソート（任意）
        const sortedPages = Array.from(pages.values()).sort(
          (
            a: { title: string; mdPath: string },
            b: { title: string; mdPath: string }
          ) => a.title.localeCompare(b.title)
        );

        for (const { title, mdPath } of sortedPages) {
          // index.md から Markdown ファイルへの相対パスを計算
          const relativePath = path.relative(domainDir, mdPath);
          // Windows パス区切り文字を URL フレンドリーな '/' に置換
          const linkPath = relativePath.split(path.sep).join(path.posix.sep);
          indexContent += `- [${title}](${linkPath})\n`;
        }

        try {
          // ドメインディレクトリが存在しない可能性があるので作成
          await fs.mkdir(domainDir, { recursive: true });
          await fs.writeFile(indexPath, indexContent, "utf-8");
          console.log(`    [Index MD Saved] ${indexPath}`);
        } catch (err: any) {
          console.error(
            `    [Index MD Error] Failed to write ${indexPath}:`,
            err.message
          );
        }
      }
      console.log("  Domain index generation finished.");

      // 3. ルートの index.md 生成 (ドメインへのリンク集)
      console.log("\n  Generating root index.md...");
      const rootIndexPath = path.join(OUTPUT_DIR, "index.md");
      let rootIndexContent = "# Crawled Domains\n\n";
      const sortedDomains = Array.from(pagesByDomain.keys()).sort(); // ドメイン名でソート

      for (const domain of sortedDomains) {
        // 各ドメインの index.md への相対パス
        const domainIndexPath = path.join(domain, "index.md");
        // Windows パス区切り文字を URL フレンドリーな '/' に置換
        const linkPath = domainIndexPath.split(path.sep).join(path.posix.sep);
        rootIndexContent += `- [${domain}](${linkPath})\n`;
      }

      try {
        await fs.writeFile(rootIndexPath, rootIndexContent, "utf-8");
        console.log(`    [Root Index MD Saved] ${rootIndexPath}`);
      } catch (err: any) {
        console.error(
          `    [Root Index MD Error] Failed to write ${rootIndexPath}:`,
          err.message
        );
      }
      console.log("  Root index generation finished.");

      console.log("\n[Output Generation Finished]");
    }
  } catch (error) {
    console.error("[Crawler Error]", error);
  }
}

main().catch(console.error);
