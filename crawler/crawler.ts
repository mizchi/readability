// crawler/crawler.ts
import { readable, type LinkInfo, toMarkdown, PageType } from "../src/index.ts"; // Import toMarkdown and PageType
import { URL } from "node:url";
import path from "node:path";
import fsPromises from "node:fs/promises"; // promises API 用
import { appendFile } from "node:fs/promises"; // appendFile をインポート
import fs from "node:fs"; // 同期 API 用
// import { CacheLoader } from "./loader.ts"; // CacheLoader をインポート -> 削除
import type { ActionQueueItem, CrawlerOptions } from "./types.ts"; // ★★★ CrawlQueueItem -> ActionQueueItem
// ILoader は loaders/types.ts からインポートするが、ここでは CachingLoader を直接使う
import { FetcherLoader } from "./loaders/fetcher.ts";
import { FileSystemKVBackend } from "./loaders/kv_backend.ts";
import {
  CachingLoader,
  type CachedLoadResult,
} from "./loaders/caching_loader.ts";

// --- URLフィルター (main.ts から移動、ALLOWED_DOMAIN は外部から渡す) ---
function createUrlFilter(allowedDomain: string): (url: string) => boolean {
  return (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== allowedDomain) {
        return false;
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return false;
      }
      const ext = path.extname(parsedUrl.pathname).toLowerCase();
      if (
        [".pdf", ".zip", ".jpg", ".png", ".gif", ".css", ".js"].includes(ext)
      ) {
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`[Filter Invalid URL] ${url}`);
      return false;
    }
  };
}

// --- クローラークラス ---
export class Crawler {
  private queue: ActionQueueItem[] = []; // ★★★ CrawlQueueItem -> ActionQueueItem
  private visited = new Set<string>(); // 実際に処理が完了したURL
  private queuedUrls = new Set<string>(); // 現在キューに入っている、または処理中のURL
  private linkGraph = new Map<string, Set<string>>();
  private maxDepth: number;
  private maxSteps: number; // 最大ステップ数 (フェッチ試行回数) の上限
  private concurrentRequests: number;
  private delayMs: number;
  private loader: CachingLoader; // CachingLoader を直接使用
  private filter: (url: string) => boolean;
  private failedUrls = new Set<string>(); // クロール失敗 URL を記録
  private epochSize: number;
  private actionCount = 0; // 実行した step 内のアクション数
  private totalSteps = 0; // 累計実行ステップ数 (処理したアクション数)
  private sessionAddedUrlsCount = 0; // このセッションでキューに追加されたURL数
  // private epochCount = 0; // 上書きするため不要
  private outputDir: string; // epoch ファイルの出力先
  private queueLogPath: string; // アクションログファイルのパス

  constructor(
    private startUrl: string,
    options: CrawlerOptions & { outputDir?: string } = {}
  ) {
    this.maxDepth = options.maxDepth ?? 5;
    this.maxSteps = options.maxSteps ?? 100; // Use maxSteps option
    this.concurrentRequests = options.concurrentRequests ?? 3;
    this.delayMs = options.delayMs ?? 200;
    this.epochSize = options.epochSize ?? 10;
    this.outputDir = options.outputDir ?? "./crawler_output";
    this.queueLogPath = path.join(this.outputDir, "_meta", "queue.jsonl"); // ログパス初期化 (_meta に変更)
    const cacheDir = path.join(this.outputDir, "_meta", "cache"); // キャッシュディレクトリを更新 (_meta に変更)
    const fetcher = new FetcherLoader({ interval: this.delayMs });
    const backend = new FileSystemKVBackend(cacheDir);
    this.loader = new CachingLoader(fetcher, backend);

    const allowedDomain = new URL(startUrl).hostname;
    this.filter = createUrlFilter(allowedDomain);

    // --- 状態復元の試行 (同期的に行う) ---
    const metaDir = path.join(this.outputDir, "_meta"); // _meta に変更
    const visitedPath = path.join(metaDir, "visited.json");
    const graphPath = path.join(metaDir, "link_graph.json");
    const failedPath = path.join(metaDir, "failed.json");

    let restoredState = false; // 状態復元フラグ
    let restoredQueue = false; // キュー復元フラグ
    const queueStatePath = path.join(metaDir, "queue_state.json"); // キュー状態ファイルパス

    try {
      // --- 状態復元 (visited, graph, failed) ---
      if (
        fs.existsSync(visitedPath) &&
        fs.existsSync(graphPath) &&
        fs.existsSync(failedPath)
      ) {
        const visitedData = fs.readFileSync(visitedPath, "utf-8");
        const graphData = fs.readFileSync(graphPath, "utf-8");
        const failedData = fs.readFileSync(failedPath, "utf-8");

        const visitedUrls: string[] = JSON.parse(visitedData);
        const graphObj: { [key: string]: string[] } = JSON.parse(graphData);
        const failedUrls: string[] = JSON.parse(failedData);

        this.visited = new Set(visitedUrls);
        this.linkGraph = new Map();
        for (const fromUrl in graphObj) {
          this.linkGraph.set(fromUrl, new Set(graphObj[fromUrl]));
        }
        this.failedUrls = new Set(failedUrls);

        // totalSteps はセッションごとに 0 から開始するため、復元時の初期化は不要
        // this.totalSteps = this.visited.size; // Removed initialization based on visited size

        console.log(
          `[Restore State] Successfully restored state (visited, graph, failed) from ${metaDir}. Visited: ${this.visited.size}, Failed: ${this.failedUrls.size}`
        );
        restoredState = true;
      } else {
        console.log(
          `[Restore State] No previous state (visited, graph, failed) found in ${metaDir}.`
        );
      }

      // --- キューの復元 ---
      if (fs.existsSync(queueStatePath)) {
        const queueData = fs.readFileSync(queueStatePath, "utf-8");
        const queueItems: ActionQueueItem[] = JSON.parse(queueData); // ★★★ CrawlQueueItem -> ActionQueueItem
        // 保存されていたキューアイテムをそのまま復元する
        // (キュー内のURLは visited に含まれているのが正常な状態)
        this.queue = queueItems;
        // 復元したキューアイテムを queuedUrls にも追加
        this.queue.forEach((item) => this.queuedUrls.add(item.url));
        console.log(
          `[Restore Queue] Successfully restored ${this.queue.length} items from ${queueStatePath}. Added to queuedUrls.`
        );
        restoredQueue = true;
      } else {
        console.log(
          `[Restore Queue] No queue state file found at ${queueStatePath}.`
        );
      }
    } catch (error: any) {
      console.warn(
        `[Restore Error] Error reading state or queue files:`,
        error.message
      );
      // エラーが発生した場合も、できるだけ処理を続ける (一部復元できている可能性もある)
      // 完全に新規で始める場合は、ここで this.visited や this.queue をクリアする
      // this.visited = new Set();
      // this.queue = [];
      // restoredState = false;
      // restoredQueue = false;
    }

    // 状態もキューも復元できなかった場合のみ、開始URLをキューに追加
    if (!restoredState && !restoredQueue) {
      console.log("[Initial Queue] Adding start URL to the queue.");
      this.addToQueue(this.startUrl, 0, 1000, this.startUrl);
    } else if (this.queue.length === 0 && this.visited.size === 0) {
      // 状態ファイルはあったがキューが空 or 復元失敗し、visited も空の場合、開始URLを追加
      console.log(
        "[Initial Queue] State files found but queue is empty and no URLs visited. Adding start URL."
      );
      this.addToQueue(this.startUrl, 0, 1000, this.startUrl);
    }
    // --- 状態復元ここまで ---
  }

  // addToQueue は main.ts からほぼそのまま移動
  private addToQueue(
    relativeOrAbsoluteUrl: string,
    currentDepth: number,
    score: number,
    baseUrl: string
  ): { added: boolean; normalizedUrl: string | null } {
    let absoluteUrl: URL;
    try {
      absoluteUrl = new URL(relativeOrAbsoluteUrl, baseUrl);
    } catch (e) {
      console.warn(
        `[addToQueue Invalid URL] Url: ${relativeOrAbsoluteUrl}, Base: ${baseUrl}`
      );
      return { added: false, normalizedUrl: null };
    }

    // 正規化 (main.ts と同様)
    absoluteUrl.hostname = absoluteUrl.hostname.toLowerCase();
    absoluteUrl.hash = "";
    const params = absoluteUrl.searchParams;
    const keysToRemove: string[] = [];
    for (const key of params.keys()) {
      if (key.startsWith("utm_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => params.delete(key));
    const sortedParams = new URLSearchParams();
    Array.from(params.keys())
      .sort()
      .forEach((key) => {
        params.getAll(key).forEach((value) => {
          sortedParams.append(key, value);
        });
      });
    absoluteUrl.search = sortedParams.toString();
    let normalizedUrl = absoluteUrl.toString();
    if (absoluteUrl.pathname !== "/" && normalizedUrl.endsWith("/")) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    // 新しいキューアイテムを作成
    const newItem: ActionQueueItem = {
      type: "fetch",
      url: normalizedUrl, // ★★★ Use normalizedUrl defined above
      score,
      depth: currentDepth,
      // init は現時点では不要
    };

    // フィルター実行
    if (
      this.queuedUrls.has(normalizedUrl) || // ★★★ Check against queuedUrls instead of visited
      !this.filter(normalizedUrl) ||
      currentDepth > this.maxDepth
    ) {
      // console.log(`[Queue Skip] Already queued or filtered: ${normalizedUrl}`);
      return { added: false, normalizedUrl }; // 追加しなくても正規化URLは返す
    }

    this.queue.push(newItem); // ★★★ newItem を追加
    this.queuedUrls.add(normalizedUrl); // ★★★ Add to queuedUrls instead of visited
    this.sessionAddedUrlsCount++; // ★★★ Increment session added count
    // console.log(`[Queue Add] Depth: ${currentDepth}, URL: ${normalizedUrl}`);
    return { added: true, normalizedUrl };
  }

  /**
   * 次に実行すべきアクション(URL)のリストを取得する。
   * @returns 次に処理する CrawlQueueItem の配列
   */
  public getNextActions(): ActionQueueItem[] {
    // ★★★ CrawlQueueItem -> ActionQueueItem
    if (this.queue.length === 0 || this.totalSteps >= this.maxSteps) {
      // Check against totalSteps and maxSteps
      return [];
    }
    // スコアに基づいてソート (score が大きい方が先頭)
    this.queue.sort((a, b) => b.score - a.score); // 降順ソート

    // concurrentRequests 分だけ取り出す
    const count = Math.min(
      this.queue.length,
      this.concurrentRequests,
      this.maxSteps - this.totalSteps // 残りステップ数を考慮
    );
    const actions = this.queue.splice(0, count);
    // キューから取り出したので queuedUrls から削除
    actions.forEach((action) => this.queuedUrls.delete(action.url));
    return actions;
  }

  /**
   * 指定されたアクション(URL)を処理する。
   * @param actions 処理する CrawlQueueItem の配列
   */
  public async step(actions: ActionQueueItem[]): Promise<void> {
    // ★★★ CrawlQueueItem -> ActionQueueItem
    if (actions.length === 0) return;

    console.log(
      `\n[Step Start] Processing ${actions.length} actions. Total steps: ${this.totalSteps}/${this.maxSteps}` // Update log message
    );

    const processingPromises = actions.map(async (item) => {
      // console.log(
      //   `  [Crawling] Depth: ${item.depth}, Score: ${item.score}, URL: ${item.url}`
      // );
      const loadResult: CachedLoadResult = await this.loader.load(item.url);
      const html = loadResult.content;
      const cacheHit = loadResult.cacheHit;

      // アクションログを記録
      await this.logAction(item.url, cacheHit);

      if (!html) {
        this.failedUrls.add(item.url); // 失敗リストに追加
        return { cacheHit: cacheHit, success: false }; // Return status even for failed loads
      }

      // ★★★ コンテンツ取得成功時に visited に追加 ★★★
      this.visited.add(item.url);

      try {
        const result = readable(html, { url: item.url }); // html (content) を渡す

        // --- Markdown Generation ---
        let generatedMarkdown: string | null = null;
        if (
          result &&
          result.snapshot &&
          result.snapshot.links &&
          result.snapshot.links.length > 0
        ) {
          // Only generate if links exist
          if (result.pageType === PageType.ARTICLE) {
            // Generate Markdown from the main extracted content for articles
            generatedMarkdown = result.toMarkdown();
            // console.log(`  [Markdown Generated (Article)] URL: ${item.url}, Length: ${generatedMarkdown?.length ?? 0}`);
          } else if (
            // result.snapshot is checked above
            result.snapshot.mainCandidates &&
            result.snapshot.mainCandidates.length > 0
          ) {
            // Check if mainCandidates exist (snapshot is already checked)
            // Generate Markdown from the top candidate even if not classified as an article
            const topCandidateElement =
              result.snapshot.mainCandidates[0].element; // Access is now safe
            generatedMarkdown = toMarkdown(topCandidateElement);
            // console.log(`  [Markdown Generated (Other)] URL: ${item.url}, Length: ${generatedMarkdown?.length ?? 0}`);
          }

          // TODO: Implement logic to save or use the generatedMarkdown
          if (generatedMarkdown) {
            // Example: Log the first 200 chars
            // console.log(`  Generated Markdown for ${item.url}:\n${generatedMarkdown.substring(0, 200)}...`);
            // You might want to save this markdown to a file or database here.
            // For example:
            // const mdFilename = path.join(this.outputDir, "markdown", `${encodeURIComponent(item.url)}.md`);
            // await fsPromises.mkdir(path.dirname(mdFilename), { recursive: true });
            // await fsPromises.writeFile(mdFilename, generatedMarkdown, "utf-8");
            // console.log(`    Markdown saved to ${mdFilename}`);
          }
        }
        // --- End Markdown Generation ---

        if (result && result.snapshot && result.snapshot.links) {
          const links: LinkInfo[] = result.snapshot.links;
          // console.log(`    Found ${links.length} links in ${item.url}`);

          let addedCount = 0;
          for (const linkInfo of links) {
            if (linkInfo.href) {
              const score = linkInfo.element.readability?.contentScore ?? 0;
              const urlWithoutFragment = linkInfo.href.split("#")[0];

              const { added, normalizedUrl } = this.addToQueue(
                urlWithoutFragment,
                item.depth + 1,
                score,
                item.url // baseUrl は現在のページの URL
              );

              if (added && normalizedUrl) {
                addedCount++;
                // リンクグラフに記録 (from: 現在のURL, to: 正規化されたリンク先URL)
                const fromUrl = item.url;
                if (!this.linkGraph.has(fromUrl)) {
                  this.linkGraph.set(fromUrl, new Set());
                }
                this.linkGraph.get(fromUrl)!.add(normalizedUrl);
              } else if (normalizedUrl && this.visited.has(normalizedUrl)) {
                // 既に追加済み or フィルターされたが、リンク自体は存在する場合もグラフに追加
                const fromUrl = item.url;
                if (!this.linkGraph.has(fromUrl)) {
                  this.linkGraph.set(fromUrl, new Set());
                }
                // 既に訪問済みでもリンク関係は記録
                this.linkGraph.get(fromUrl)!.add(normalizedUrl);
              }
            }
          }
          // console.log(
          //   `    Added ${addedCount} new links to queue from ${item.url}`
          // );
        } else {
          console.log(`    Readable failed or no content for ${item.url}`);
        }
      } catch (error) {
        console.error(`[Error Processing Content] ${item.url}:`, error);
      }
    });

    // Wait for all steps to complete
    await Promise.all(processingPromises); // Use processingPromises

    // Increment total steps and action count by the number of actions processed in this step,
    // regardless of cache hits or errors. maxSteps now limits the total number of processed URLs.
    this.totalSteps += actions.length;
    this.actionCount += actions.length;

    // epoch チェック
    if (this.actionCount >= this.epochSize) {
      await this.writeEpochData();
      this.actionCount = 0; // カウンターリセット
    }
  }

  /**
   * 現在のリンクグラフと訪問済みリストをファイルに書き出す (上書き)。
   */
  private async writeEpochData(): Promise<void> {
    // this.epochCount++; // 上書きするため不要
    console.log(
      `\n[Meta Save] Writing metadata (overwrite). Total steps: ${this.totalSteps}` // Update log message
    );
    const metaDir = path.join(this.outputDir, "_meta"); // メタデータ用ディレクトリ
    try {
      await fsPromises.mkdir(metaDir, { recursive: true }); // 非同期 mkdir は fsPromises から

      // linkGraph を JSON シリアライズ可能な形式に変換
      const graphObj: { [key: string]: string[] } = {};
      for (const [key, value] of this.linkGraph.entries()) {
        graphObj[key] = Array.from(value).sort();
      }
      // ファイル名を固定して上書き
      const graphPath = path.join(metaDir, `link_graph.json`); // 保存先を _meta/ に変更
      await fsPromises.writeFile(graphPath, JSON.stringify(graphObj, null, 2)); // 非同期 writeFile は fsPromises から
      console.log(`  Link graph saved to ${graphPath}`);

      // ファイル名を固定して上書き
      const visitedArray = Array.from(this.visited).sort();
      const visitedPath = path.join(metaDir, `visited.json`); // 保存先を _meta/ に変更
      await fsPromises.writeFile(
        visitedPath,
        JSON.stringify(visitedArray, null, 2)
      ); // 非同期 writeFile は fsPromises から
      console.log(`  Visited list saved to ${visitedPath}`);

      // 失敗リストも保存
      const failedArray = Array.from(this.failedUrls).sort();
      const failedPath = path.join(metaDir, `failed.json`);
      await fsPromises.writeFile(
        failedPath,
        JSON.stringify(failedArray, null, 2)
      ); // 非同期 writeFile は fsPromises から
      console.log(`  Failed list saved to ${failedPath}`);
    } catch (error) {
      console.error(`[Meta Write Error] Failed to write metadata:`, error);
    }
  }

  /**
   * アクションログを meta/queue.jsonl に追記する。
   * @param url 処理した URL
   * @param cacheHit キャッシュヒットしたかどうか
   */
  private async logAction(url: string, cacheHit: boolean): Promise<void> {
    // _meta に変更
    const logEntry = {
      url,
      timestamp: new Date().toISOString(),
      cacheHit,
    };
    try {
      // ディレクトリが存在しない可能性があるので作成
      await fsPromises.mkdir(path.dirname(this.queueLogPath), {
        recursive: true,
      });
      await appendFile(
        this.queueLogPath,
        JSON.stringify(logEntry) + "\n",
        "utf-8"
      );
    } catch (error) {
      console.error(
        `[Log Action Error] Failed to write log for ${url}:`,
        error
      );
    }
  }

  // writeFinalData は不要になった (writeEpochData と saveQueueState で代替)

  /**
   * 現在のキューの状態をファイルに書き出す (上書き)。
   */
  public async saveQueueState(): Promise<void> {
    console.log(
      `\n[Queue Save] Writing queue state (${this.queue.length} items).`
    );
    const metaDir = path.join(this.outputDir, "_meta");
    const queueStatePath = path.join(metaDir, "queue_state.json");
    try {
      await fsPromises.mkdir(metaDir, { recursive: true });
      // キューをスコアでソートしてから保存 (任意だが、再開時の優先度確認に役立つ)
      const sortedQueue = [...this.queue].sort((a, b) => b.score - a.score);
      await fsPromises.writeFile(
        queueStatePath,
        JSON.stringify(sortedQueue, null, 2)
      );
      console.log(`  Queue state saved to ${queueStatePath}`);
    } catch (error) {
      console.error(`[Queue Save Error] Failed to write queue state:`, error);
    }
  }

  // 外部からグラフや訪問済みリストを取得するためのゲッター
  public getLinkGraph(): Map<string, Set<string>> {
    return this.linkGraph;
  }

  public getVisitedUrls(): Set<string> {
    return this.visited;
  }

  // このセッションで追加されたURL数を取得するゲッター
  public getSessionAddedUrlsCount(): number {
    return this.sessionAddedUrlsCount;
  }

  // Add getters for private properties used in main.ts logs
  public getMaxSteps(): number {
    return this.maxSteps;
  }

  public getTotalSteps(): number {
    return this.totalSteps;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Returns the top N items from the queue without removing them.
   * Items are sorted by score (descending) before peeking.
   * @param count The number of items to peek.
   * @returns An array of CrawlQueueItem.
   */
  public peekQueue(count: number): ActionQueueItem[] {
    // ★★★ CrawlQueueItem -> ActionQueueItem
    // Sort by score to show the highest priority items
    const sortedQueue = [...this.queue].sort((a, b) => b.score - a.score);
    return sortedQueue.slice(0, count);
  }

  public isFinished(): boolean {
    return (
      this.queue.length === 0 || this.totalSteps >= this.maxSteps // Check against totalSteps and maxSteps
    );
  }
}

// CrawlerOptions に epochSize を追加
declare module "./types.ts" {
  interface CrawlerOptions {
    maxSteps?: number; // Renamed from maxRequests
    epochSize?: number;
    outputDir?: string; // 出力ディレクトリ指定用
    // maxRequests?: number; // Removed
  }
}
