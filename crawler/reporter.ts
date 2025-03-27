// crawler/reporter.ts
import path from "node:path";
import fs from "node:fs/promises";
import { URL } from "node:url";
// 追加: Markdown 生成に必要な import
import { readable, PageType, type LinkInfo } from "../src/index.ts";
import { FetcherLoader } from "./loaders/fetcher.ts";
import { FileSystemKVBackend } from "./loaders/kv_backend.ts";
import { CachingLoader } from "./loaders/caching_loader.ts";

// pagesByDomain の型を定義 (main.ts から推測)
type PagesByDomainMap = Map<
  string,
  Map<string, { title: string; mdPath: string }>
>;
// sortedRanks の型を定義 (main.ts から推測)
type SortedRanksArray = [string, number][];

/**
 * 訪問済み URL の Markdown ドキュメントを生成し、ドメインごとの情報を返す
 * @param outputDir 出力ディレクトリ
 * @returns ドメインごとのページ情報 (PagesByDomainMap)
 */
export async function generateDocs(
  outputDir: string
): Promise<PagesByDomainMap> {
  console.log("\n[Docs Generation Started]");
  const pagesByDomain: PagesByDomainMap = new Map();
  const visitedPath = path.join(outputDir, "_meta", "visited.json");

  try {
    const visitedJson = await fs.readFile(visitedPath, "utf-8");
    const visitedUrls: string[] = JSON.parse(visitedJson);
    const visitedUrlSet = new Set(visitedUrls); // 相対パスチェック用に Set も用意
    console.log(`  Generating Markdown for ${visitedUrls.length} pages...`);

    // Markdown 生成用に別途 Loader を用意 (同じキャッシュディレクトリを指定)
    const outputFetcher = new FetcherLoader({ interval: 0 }); // Markdown生成時はインターバル不要
    const outputBackend = new FileSystemKVBackend(
      path.join(outputDir, "_meta", "cache")
    );
    const outputLoader = new CachingLoader(outputFetcher, outputBackend);

    for (const url of visitedUrls) {
      try {
        // CachingLoader の get は CachedLoadResult | null を返す
        const loadResult = await outputLoader.get(url);
        const html = loadResult?.content; // Optional chaining を使用
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
            { title: "Parent Links", links: hierarchy.parent },
            { title: "Sibling Links", links: hierarchy.sibling },
            { title: "Child Links", links: hierarchy.child },
            { title: "External Links", links: hierarchy.external },
          ];
          for (const category of linkCategories) {
            if (category.links.length > 0) {
              outputContent += `## ${category.title}\n\n`;
              category.links.forEach((link: LinkInfo) => {
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
        if (pathname === "/" || pathname.endsWith("/")) {
          pathname = path.join(pathname, "index.md");
        } else if (pathname.toLowerCase().endsWith(".html")) {
          pathname = pathname.slice(0, -5) + ".md";
        } else if (!path.extname(pathname)) {
          pathname += ".md";
        }

        const saveDir = path.join(outputDir, parsedUrl.hostname);
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
              const absoluteLinkUrl = new URL(linkUrl, url).toString();
              const cleanedLinkUrl = absoluteLinkUrl.split("#")[0];

              if (visitedUrlSet.has(cleanedLinkUrl)) {
                const targetParsedUrl = new URL(cleanedLinkUrl);
                let targetPathname = targetParsedUrl.pathname;
                if (targetPathname === "/" || targetPathname.endsWith("/")) {
                  targetPathname = path.join(targetPathname, "index.md");
                } else if (targetPathname.toLowerCase().endsWith(".html")) {
                  targetPathname = targetPathname.slice(0, -5) + ".md";
                } else if (!path.extname(targetPathname)) {
                  targetPathname += ".md";
                }
                const targetSavePath = path.join(
                  outputDir,
                  targetParsedUrl.hostname,
                  targetPathname.startsWith("/")
                    ? targetPathname.substring(1)
                    : targetPathname
                );
                const relativePath = path.relative(currentDir, targetSavePath);
                return `[${text}](${relativePath})`;
              }
            } catch (e) {
              // URL パースエラーなどは無視
            }
            return match;
          }
        );
        // --- 相対パス変換処理ここまで ---

        await fs.mkdir(path.dirname(savePath), { recursive: true });
        await fs.writeFile(savePath, outputContent, "utf-8");
        // console.log(`    [Markdown Saved] ${savePath}`);

        // ドメインごとのページ情報を保存
        const articleTitle = readableInstance.snapshot.metadata.title;
        const title = articleTitle || url;
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
      `  Markdown generation finished. Output directory: ${outputDir}`
    );
  } catch (err: any) {
    console.error(
      `[Markdown Error] Failed to read ${visitedPath}:`,
      err.message
    );
    // visited.json が読めない場合は空の Map を返す
    return new Map();
  }

  console.log("\n[Docs Generation Finished]");
  return pagesByDomain;
}

export async function generateIndexPages(
  outputDir: string,
  pagesByDomain: PagesByDomainMap,
  sortedRanks: SortedRanksArray
): Promise<void> {
  console.log("\n[Index Generation Started]");

  // 1. ドメインごとの index.md 生成
  console.log("  Generating index.md for each domain...");
  for (const [domain, pages] of pagesByDomain.entries()) {
    const domainDir = path.join(outputDir, domain);
    const indexPath = path.join(domainDir, "index.md");
    let indexContent = `# Index for ${domain}\n\n`;

    // ページ情報をタイトルでソート（任意）
    const sortedPages = Array.from(pages.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
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

  // 2. ルートの index.md 生成 (PageRank 上位 20 件)
  console.log("\n  Generating root index.md (Top 20 by PageRank)...");
  const rootIndexPath = path.join(outputDir, "index.md");
  let rootIndexContent = "# Top 20 Pages by PageRank\n\n";

  // PageRank 上位 20 件を取得
  const topRankedPages = sortedRanks.slice(0, 20);

  for (const [url, rank] of topRankedPages) {
    // URL からドメインとパスを取得
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;
      // pagesByDomain からタイトルと Markdown パスを取得
      const pageInfo = pagesByDomain.get(domain)?.get(url);

      if (pageInfo) {
        const { title, mdPath } = pageInfo;
        // ルート index.md から Markdown ファイルへの相対パスを計算
        const relativePath = path.relative(outputDir, mdPath);
        // Windows パス区切り文字を URL フレンドリーな '/' に置換
        const linkPath = relativePath.split(path.sep).join(path.posix.sep);
        rootIndexContent += `- [${title}](${linkPath}) (Rank: ${rank.toFixed(6)})\n`;
      } else {
        // pagesByDomain に情報がない場合 (通常はありえないはずだが念のため)
        rootIndexContent += `- ${url} (Rank: ${rank.toFixed(6)}) - (Page info not found)\n`;
      }
    } catch (e) {
      console.warn(
        `  [Root Index Warn] Failed to process URL for index: ${url}`,
        e
      );
      rootIndexContent += `- ${url} (Rank: ${rank.toFixed(6)}) - (Error processing URL)\n`;
    }
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
  console.log("\n[Index Generation Finished]");
}
