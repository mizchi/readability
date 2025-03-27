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
    this.delayMs = options.delayMs ?? 1000;
    this.epochSize = options.epochSize ?? 10;
    this.outputDir = options.outputDir ?? "./crawler_output";
    this.queueLogPath = path.join(this.outputDir, "_meta", "queue.jsonl"); // ログパス初期化 (_meta に変更)
    const cacheDir = path.join(this.outputDir, "_meta", "cache"); // キャッシュディレクトリを更新 (_meta に変更)
    const fetcher = new FetcherLoader({ interval: this.delayMs });
    const backend = new FileSystemKVBackend(cacheDir);
    this.loader = new CachingLoader(fetcher, backend);

    const allowedDomain = new URL(startUrl).hostname;
    this.filter = createUrlFilter(allowedDomain);

    // --- 状態復元の呼び出し ---
    // Note: コンストラクタは async にできないため、IIFE などを使うか、
    //       呼び出し元 (main.ts) でロードメソッドを呼び出す必要がある。
    //       ここでは main.ts で呼び出す前提とし、コンストラクタ内の呼び出しはコメントアウト。
    // await this.loadEpochData();
    // await this.loadQueueState();

    // 状態復元後にキューが空で、かつ visited も空の場合のみ開始URLを追加
    // (loadEpochData/loadQueueState が同期的に実行される前提の仮実装)
    // if (this.queue.length === 0 && this.visited.size === 0) {
    //   console.log("[Initial Queue] No state restored or queue empty. Adding start URL.");
    //   this.addToQueue(this.startUrl, 0, this.startUrl);
    // }
    // --- 状態復元ここまで ---
  }

  // addToQueue は main.ts からほぼそのまま移動
  // addToQueue のシグネチャから score を削除し、isNew を返すように変更
  private addToQueue(
    relativeOrAbsoluteUrl: string,
    currentDepth: number,
    // score: number, // 削除
    baseUrl: string
  ): { added: boolean; normalizedUrl: string | null; isNew: boolean } {
    let absoluteUrl: URL;
    try {
      absoluteUrl = new URL(relativeOrAbsoluteUrl, baseUrl);
    } catch (e) {
      console.warn(
        `[addToQueue Invalid URL] Url: ${relativeOrAbsoluteUrl}, Base: ${baseUrl}`
      );
      return { added: false, normalizedUrl: null, isNew: false };
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

    // フィルター実行 (先に実行して不要な処理をスキップ)
    if (!this.filter(normalizedUrl) || currentDepth > this.maxDepth) {
      return { added: false, normalizedUrl, isNew: false };
    }

    // 既にキューにあるかチェック
    const existingItemIndex = this.queue.findIndex(
      (item) => item.url === normalizedUrl
    );

    if (existingItemIndex !== -1) {
      // 既にキューにあれば count をインクリメント
      this.queue[existingItemIndex].count++;
      // console.log(`[Queue Increment] Count: ${this.queue[existingItemIndex].count}, URL: ${normalizedUrl}`);
      return { added: false, normalizedUrl, isNew: false }; // キューには追加しないが、カウントは増やした
    }

    // 訪問済みかチェック (キューになくても訪問済みなら追加しない)
    if (this.visited.has(normalizedUrl)) {
      return { added: false, normalizedUrl, isNew: false };
    }

    // queuedUrls にも存在するかチェック (getNextActions で取り出されたがまだ step が完了していない場合)
    if (this.queuedUrls.has(normalizedUrl)) {
      // このケースは通常発生しにくいが、念のためカウントアップだけ行うか検討
      // 今回はシンプルにするため、何もしない (重複追加は避ける)
      return { added: false, normalizedUrl, isNew: false };
    }

    // 新しいキューアイテムを作成 (count は初期値 1)
    const newItem: ActionQueueItem = {
      type: "fetch",
      url: normalizedUrl,
      count: 1, // 初期カウントは 1
      depth: currentDepth,
    };

    // フィルター実行は上に移動済み

    this.queue.push(newItem); // ★★★ newItem を追加
    this.queuedUrls.add(normalizedUrl); // ★★★ Add to queuedUrls instead of visited
    this.sessionAddedUrlsCount++; // ★★★ Increment session added count
    // console.log(`[Queue Add] Depth: ${currentDepth}, URL: ${normalizedUrl}`);
    return { added: true, normalizedUrl, isNew: true }; // 新規追加
  }

  /**
   * キューを指定された優先度ルールでソートする。
   * 1. count (被リンク数) の降順
   * 2. count が同じ場合は depth (深度) の昇順
   */
  private _sortQueue(): void {
    this.queue.sort((a, b) => {
      // 1. count の降順
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // 2. depth の昇順
      return a.depth - b.depth;
    });
  }

  /**
   * 次に実行すべきアクション(URL)のリストを取得する。
   * @returns 次に処理する ActionQueueItem の配列
   */
  public getNextActions(): ActionQueueItem[] {
    if (this.queue.length === 0 || this.totalSteps >= this.maxSteps) {
      return [];
    }
    // ソート処理を呼び出す
    this._sortQueue();

    const count = Math.min(
      this.queue.length,
      this.concurrentRequests,
      this.maxSteps - this.totalSteps
    );
    const actions = this.queue.splice(0, count);
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
              // score は使わない
              // const score = linkInfo.element.readability?.contentScore ?? 0;
              const urlWithoutFragment = linkInfo.href.split("#")[0];

              // addToQueue の呼び出しから score を削除し、isNew を受け取る
              const { added, normalizedUrl, isNew } = this.addToQueue(
                urlWithoutFragment,
                item.depth + 1,
                // score, // 削除
                item.url // baseUrl は現在のページの URL
              );

              // リンクグラフの記録ロジックは isNew フラグに関わらず実行する
              // (カウントアップした場合もリンク元としては記録したい)
              if (normalizedUrl) {
                // normalizedUrl が null でないことを確認
                const fromUrl = item.url;
                if (!this.linkGraph.has(fromUrl)) {
                  this.linkGraph.set(fromUrl, new Set());
                }
                // 訪問済みかどうかに関わらず、リンク関係は記録
                this.linkGraph.get(fromUrl)!.add(normalizedUrl);

                // added フラグはログ出力などに使える (今回はコメントアウト)
                // if (added) {
                //     addedCount++;
                // }
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
  public async writeEpochData(): Promise<void> {
    // public に変更
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

      // 失敗リストの保存は writeEpochData から削除 (requeueFailedUrls で管理)
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
      // ソート処理を呼び出す
      this._sortQueue();
      // ソート済みのキューを保存
      await fsPromises.writeFile(
        queueStatePath,
        JSON.stringify(this.queue, null, 2) // sortedQueue ではなく直接 this.queue を使う
      );
      console.log(`  Queue state saved to ${queueStatePath}`);
    } catch (error) {
      console.error(`[Queue Save Error] Failed to write queue state:`, error);
    }
  }

  /**
   * エポックデータ (visited, graph, failed) をファイルから読み込む。
   * @returns 状態が復元されたかどうか
   */
  public async loadEpochData(): Promise<boolean> {
    const metaDir = path.join(this.outputDir, "_meta");
    const visitedPath = path.join(metaDir, "visited.json");
    const graphPath = path.join(metaDir, "link_graph.json");
    const failedPath = path.join(metaDir, "failed.json");
    let restoredState = false;

    try {
      // fs.existsSync は同期的なので、先にチェック
      const filesExist =
        fs.existsSync(visitedPath) &&
        fs.existsSync(graphPath) &&
        fs.existsSync(failedPath);

      if (filesExist) {
        const [visitedData, graphData, failedData] = await Promise.all([
          fsPromises.readFile(visitedPath, "utf-8"),
          fsPromises.readFile(graphPath, "utf-8"),
          fsPromises.readFile(failedPath, "utf-8"),
        ]);

        const visitedUrls: string[] = JSON.parse(visitedData);
        const graphObj: { [key: string]: string[] } = JSON.parse(graphData);
        const failedUrls: string[] = JSON.parse(failedData);

        this.visited = new Set(visitedUrls);
        this.linkGraph = new Map();
        for (const fromUrl in graphObj) {
          this.linkGraph.set(fromUrl, new Set(graphObj[fromUrl]));
        }
        this.failedUrls = new Set(failedUrls);

        console.log(
          `[Restore State] Successfully restored state (visited, graph, failed) from ${metaDir}. Visited: ${this.visited.size}, Failed: ${this.failedUrls.size}`
        );
        restoredState = true;
      } else {
        console.log(
          `[Restore State] No previous state (visited, graph, failed) found in ${metaDir}.`
        );
      }
    } catch (error: any) {
      console.warn(`[Restore Error] Error reading state files:`, error.message);
      // エラー時も処理を続ける
    }
    return restoredState;
  }

  /**
   * キューの状態をファイルから読み込む。
   * @returns キューが復元されたかどうか
   */
  public async loadQueueState(): Promise<boolean> {
    const metaDir = path.join(this.outputDir, "_meta");
    const queueStatePath = path.join(metaDir, "queue_state.json");
    let restoredQueue = false;

    try {
      // fs.existsSync は同期的なので、先にチェック
      const queueFileExists = fs.existsSync(queueStatePath);

      if (queueFileExists) {
        const queueData = await fsPromises.readFile(queueStatePath, "utf-8");
        const queueItems: ActionQueueItem[] = JSON.parse(queueData);
        this.queue = queueItems;
        this.queuedUrls.clear(); // queuedUrls もクリアしてから再構築
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
        `[Restore Error] Error reading queue state file:`,
        error.message
      );
      // エラー時も処理を続ける
    }

    // 初期キュー追加ロジックは main.ts に移動

    return restoredQueue;
  }

  // 外部からグラフや訪問済みリストを取得するためのゲッター
  public getLinkGraph(): Map<string, Set<string>> {
    return this.linkGraph;
  }

  public getVisitedUrls(): Set<string> {
    return this.visited;
  }

  /**
   * 失敗したURLのセットを取得する。
   * @returns 失敗したURLの Set
   */
  public getFailedUrls(): Set<string> {
    return this.failedUrls;
  }

  /**
   * 失敗したURLを再度キューに追加し、失敗リストをクリアする。
   */
  public async requeueFailedUrls(): Promise<void> {
    const urlsToRequeue = Array.from(this.failedUrls);
    if (urlsToRequeue.length === 0) {
      console.log("[Requeue Failed] No failed URLs to requeue.");
      return;
    }

    console.log(
      `[Requeue Failed] Attempting to requeue ${urlsToRequeue.length} failed URLs...`
    );
    let requeuedCount = 0;
    for (const url of urlsToRequeue) {
      // depth 0, baseUrl は url 自身として追加を試みる
      // 既に visited や queuedUrls に含まれていないか再チェック
      if (!this.visited.has(url) && !this.queuedUrls.has(url)) {
        const { added } = this.addToQueue(url, 0, url);
        if (added) {
          requeuedCount++;
          // console.log(`  Requeued: ${url}`);
        } else {
          // addToQueue でフィルターされた等の理由で追加されなかった場合
          // console.log(`  Skipped (filtered or other reason): ${url}`);
        }
      } else {
        // console.log(`  Skipped (already visited or queued): ${url}`);
      }
    }

    if (requeuedCount > 0) {
      console.log(
        `[Requeue Failed] Successfully requeued ${requeuedCount} URLs.`
      );
      this.failedUrls.clear(); // 再キューイング成功後、失敗リストをクリア
      console.log("[Requeue Failed] Cleared the failed URL list.");

      // 状態を保存 (キューと空になった失敗リスト)
      await this.saveQueueState();
      await this.writeFailedUrlsToFile(); // ★★★ 失敗リストをファイルに書き込む
    } else {
      console.log(
        "[Requeue Failed] No URLs were actually requeued (might be already visited/queued or filtered). Failed list remains unchanged."
      );
      // 失敗リストに変更がない場合、ファイルへの書き込みは不要
    }
  }

  /**
   * 現在の失敗リストを failed.json に書き込む (上書き)。
   * requeueFailedUrls から呼び出されることを想定。
   */
  private async writeFailedUrlsToFile(): Promise<void> {
    const metaDir = path.join(this.outputDir, "_meta");
    const failedPath = path.join(metaDir, "failed.json");
    console.log(`[Meta Save] Writing failed URL list to ${failedPath}`);
    try {
      await fsPromises.mkdir(metaDir, { recursive: true });
      const failedArray = Array.from(this.failedUrls).sort();
      await fsPromises.writeFile(
        failedPath,
        JSON.stringify(failedArray, null, 2)
      );
    } catch (error) {
      console.error(`[Meta Write Error] Failed to write failed URLs:`, error);
    }
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
    // ソート処理を呼び出す
    this._sortQueue();
    // ソート済みのキューの先頭からコピーを返す
    return this.queue.slice(0, count);
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
