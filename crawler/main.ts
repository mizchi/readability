// crawler/main.ts
// import minimist from "minimist"; // コマンドライン引数解析
import { parseArgs } from "node:util";
import { Crawler } from "./crawler.ts";
import { calculatePageRank } from "./pagerank.ts"; // PageRank 計算のために復活
import type { ActionQueueItem } from "./types.ts"; // ★★★ CrawlQueueItem -> ActionQueueItem
import { generateDocs, generateIndexPages } from "./reporter.ts"; // generateDocs もインポート

const ENTRY_POINT = "https://docs.anthropic.com/en/docs/welcome";

// --- メイン処理 ---
async function main() {
  // const args = minimist(process.argv.slice(2), { string: ["o"] }); // -o を文字列として扱う
  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      out: {
        type: "string",
        short: "o",
      },
      step: {
        type: "string",
        short: "s",
      },
      epoch: {
        type: "string",
        short: "e",
      },
      depth: {
        type: "string",
        short: "d",
      },
      concurrent: {
        type: "string",
        short: "c",
      },
      retryFail: {
        // ★★★ 追加 ★★★
        type: "boolean",
        short: "r", // 短縮形として -r を割り当て (任意)
      },
    },
  }); // minimist の結果をパース
  const shouldRetryFail = parsed.values.retryFail ?? false; // ★★★ フラグの値を取得 ★★★
  const outputDirArg = parsed.values.out; // -o の値を取得
  const maxSteps = parsed.values.step ? parseInt(parsed.values.step) : 10; // -s の値を取得

  const shouldGenerateOutput = typeof outputDirArg === "string"; // -o が文字列として指定されているか
  const OUTPUT_DIR = outputDirArg || "./crawler_output"; // 指定があればそれ、なければデフォルト

  // const loader: ILoader = new CacheLoader(1000); // Crawler 内部で生成するため不要
  const crawler = new Crawler(ENTRY_POINT, {
    // loader 引数を削除
    maxSteps: maxSteps, // Use maxSteps option
    maxDepth: Number(parsed.values.epoch ?? 3), // -e の値を取得
    concurrentRequests: Number(parsed.values.concurrent ?? 1), // -c の値を取得
    epochSize: Number(parsed.values.depth ?? 10), // -d の値を取得
    outputDir: OUTPUT_DIR, // Crawler にも渡す
  });

  // ★★★ 変更: 状態 -> キュー の順にロード ★★★
  await crawler.loadEpochData(); // visited, graph, failed をロード
  await crawler.loadQueueState(); // キューをロード

  // ★★★ 追加: --retryFail が指定された場合の処理 ★★★
  if (shouldRetryFail) {
    console.log(
      "[Crawler Info] --retryFail specified. Re-queueing failed URLs..."
    );
    const failedUrls = crawler.getFailedUrls(); // Crawlerクラスにこのメソッドが必要
    if (failedUrls.size > 0) {
      console.log(`  Found ${failedUrls.size} failed URLs to retry.`);
      // 失敗したURLを再度キューに追加するロジック (Crawlerクラスに実装)
      await crawler.requeueFailedUrls(); // 例: このようなメソッドを呼び出す
      // 失敗リストをリセット (requeueFailedUrls 内でやるか、別途呼び出す)
      // await crawler.resetFailedUrls(); // 例: このようなメソッドを呼び出す
    } else {
      console.log("  No failed URLs found to retry.");
    }
  }

  // ★★★ 追加: 状態ロード後にキューが空かチェックし、必要なら開始URLを追加 ★★★
  if (crawler.getQueueLength() === 0 && crawler.getVisitedUrls().size === 0) {
    console.log(
      "[Initial Queue] State loaded, but queue is empty and no URLs visited. Adding start URL."
    );
    // addToQueue は private なので、Crawler クラスに public なメソッドを追加するか、
    // ここで直接キューに追加する必要がある。ここでは簡単のため直接追加するが、
    // 本来は Crawler クラスにメソッドを用意するのが望ましい。
    // crawler.addToQueue(ENTRY_POINT, 0, ENTRY_POINT); // これはできない
    // 代わりに Crawler クラスに addStartUrlIfNeeded() のようなメソッドを作るのが良い
    // 仮実装として、Crawler 側に初期化ロジックがあると想定し、ここでは何もしない
    // ※ crawler.ts の loadQueueState 内のロジックをここに移動するのが正しい
    // crawler.ts 側で loadQueueState の最後にチェックするように修正済みのため、ここでは不要
  }

  console.log(
    `[Crawler Start] Entry: ${ENTRY_POINT}, Max Depth: ${crawler["maxDepth"]}, Max Steps: ${crawler.getMaxSteps()}, Concurrency: ${crawler["concurrentRequests"]}, Epoch Size: ${crawler["epochSize"]}` // Use getMaxSteps()
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
      `\n[Crawler Finished] Total steps: ${crawler.getTotalSteps()}. Visited ${visitedCount} unique URLs.` // Use getTotalSteps()
    );

    // Check if the queue is empty and notify
    if (
      crawler.getQueueLength() === 0 &&
      crawler.getTotalSteps() < crawler.getMaxSteps()
    ) {
      console.log(
        "[Crawler Info] Queue is empty. All reachable URLs processed within depth/step limits."
      );
    } else if (crawler.getTotalSteps() >= crawler.getMaxSteps()) {
      console.log(
        `[Crawler Info] Reached max steps (${crawler.getMaxSteps()}). There might be more URLs in the queue.`
      );
    } else if (crawler.getQueueLength() > 0) {
      // This case might happen if the loop breaks unexpectedly, though unlikely with current logic
      console.log(
        `[Crawler Info] Finished with ${crawler.getQueueLength()} URLs remaining in the queue (reason unclear).`
      );
    }

    // PageRank 計算は削除

    // --- -o オプションが指定された場合の処理 ---
    // ドメインごとのページ情報を保持するマップ (ifブロックの外に移動)
    // pagesByDomain は generateDocs から返されるため、初期化不要
    // const pagesByDomain = new Map<
    //   string,
    //   Map<string, { title: string; mdPath: string }>
    // >();
    if (shouldGenerateOutput) {
      console.log("\n[Output Generation Started] (-o option specified)");

      // 1. Markdown ドキュメント生成 (reporter.ts に分割)
      const pagesByDomain = await generateDocs(OUTPUT_DIR);

      // 2. PageRank 計算 (インデックス生成用)
      let sortedRanks: [string, number][] = [];
      if (visitedCount > 0) {
        console.log("\n  Calculating PageRank for index generation...");
        const linkGraph = crawler.getLinkGraph();
        const visited = crawler.getVisitedUrls();
        const pageRanks = calculatePageRank(linkGraph, visited);
        sortedRanks = Array.from(pageRanks.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        console.log(`  PageRank calculated for ${sortedRanks.length} pages.`);
      }

      // 3. インデックスページ生成 (reporter.ts に分割)
      await generateIndexPages(OUTPUT_DIR, pagesByDomain, sortedRanks);
      await generateIndexPages(OUTPUT_DIR, pagesByDomain, sortedRanks);

      console.log("\n[Output Generation Finished]");
    }
  } catch (error) {
    console.error("[Crawler Error]", error);
  } finally {
    // --- 終了処理 ---
    // 1. 最終的なメタデータ (visited, graph, failed) を保存
    await crawler.writeEpochData(); // ★★★ 終了時に必ずメタデータを保存 ★★★
    // 2. キューの状態を保存
    await crawler.saveQueueState(); // ★★★ キュー保存処理を追加 ★★★

    // 3. 実行結果とキューの最終状態を表示 (保存後に行う)
    const finalQueueLength = crawler.getQueueLength();
    const addedCount = crawler.getSessionAddedUrlsCount(); // ★★★ 追加された数を取得
    console.log(
      `\n[Crawl Summary] Added ${addedCount} URLs to the queue during this session.`
    );
    console.log(`[Final Queue Status] ${finalQueueLength} items remaining.`);
    if (finalQueueLength > 0) {
      const nextActions = crawler.peekQueue(3); // メモリ上の最新状態を見る
      console.log("  Next 3 actions (by score):");
      nextActions.forEach((action: ActionQueueItem, index: number) => {
        // ★★★ CrawlQueueItem -> ActionQueueItem
        // ★★★ 型注釈を追加
        console.log(
          `    ${index + 1}. Count: ${action.count}, Depth: ${action.depth}, URL: ${action.url}` // score を count と depth に変更
        );
      });
    } else {
      console.log("  Queue is empty.");
    }
  }
}

main().catch(console.error);
