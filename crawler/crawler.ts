// crawler/crawler.ts
import { readable, type LinkInfo } from "../src/index.ts";
import { URL } from "node:url";
import path from "node:path";
import fsPromises from "node:fs/promises"; // promises API 用
import { appendFile } from "node:fs/promises"; // appendFile をインポート
import fs from "node:fs"; // 同期 API 用
import { CacheLoader } from "./loader.ts"; // CacheLoader をインポート
import type { CrawlQueueItem, CrawlerOptions, ILoader } from "./types.ts";

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
  private queue: CrawlQueueItem[] = [];
  private visited = new Set<string>();
  private linkGraph = new Map<string, Set<string>>();
  private maxDepth: number;
  private maxRequests: number; // これはアクション数の上限として使う
  private concurrentRequests: number;
  private delayMs: number;
  private loader: ILoader; // 内部で生成する Loader
  private filter: (url: string) => boolean;
  private failedUrls = new Set<string>(); // クロール失敗 URL を記録
  private epochSize: number;
  private actionCount = 0; // 実行した step 内のアクション数
  private totalRequestCount = 0; // 累計リクエスト数
  // private epochCount = 0; // 上書きするため不要
  private outputDir: string; // epoch ファイルの出力先
  private queueLogPath: string; // アクションログファイルのパス

  constructor(
    private startUrl: string,
    options: CrawlerOptions & { outputDir?: string } = {}
  ) {
    this.maxDepth = options.maxDepth ?? 5;
    this.maxRequests = options.maxRequests ?? 100;
    this.concurrentRequests = options.concurrentRequests ?? 3;
    this.delayMs = options.delayMs ?? 200;
    this.epochSize = options.epochSize ?? 10;
    this.outputDir = options.outputDir ?? "./crawler_output";
    this.queueLogPath = path.join(this.outputDir, "_meta", "queue.jsonl"); // ログパス初期化 (_meta に変更)
    const cacheDir = path.join(this.outputDir, "_meta", "cache"); // キャッシュディレクトリを更新 (_meta に変更)
    this.loader = new CacheLoader(this.delayMs, cacheDir);

    const allowedDomain = new URL(startUrl).hostname;
    this.filter = createUrlFilter(allowedDomain);

    // --- 状態復元の試行 (同期的に行う) ---
    const metaDir = path.join(this.outputDir, "_meta"); // _meta に変更
    const visitedPath = path.join(metaDir, "visited.json");
    const graphPath = path.join(metaDir, "link_graph.json");
    const failedPath = path.join(metaDir, "failed.json");

    let restored = false;
    try {
      // 同期的にファイルが存在するか確認し、読み込む (fs から呼び出す)
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

        // visited に含まれる URL 数を totalRequestCount の初期値とする (概算)
        this.totalRequestCount = this.visited.size;

        console.log(
          `[Restore State] Successfully restored state from ${metaDir}. Visited: ${this.visited.size}, Failed: ${this.failedUrls.size}`
        );
        restored = true;
        // キューの復元は行わない。未訪問のリンクが step で追加されるのを待つ。
      } else {
        console.log(
          `[Restore State] No previous state found in ${metaDir}. Starting fresh.`
        );
      }
    } catch (error: any) {
      console.warn(`[Restore State] Error reading state files:`, error.message);
      // エラーが発生した場合も新規開始
    }

    if (!restored) {
      // 復元できなかった場合のみ開始URLをキューに追加
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

    // フィルター実行
    if (
      this.visited.has(normalizedUrl) ||
      !this.filter(normalizedUrl) ||
      currentDepth > this.maxDepth
    ) {
      return { added: false, normalizedUrl }; // 追加しなくても正規化URLは返す
    }

    this.queue.push({ url: normalizedUrl, score, depth: currentDepth });
    this.visited.add(normalizedUrl); // キュー追加時に visited に入れる
    // console.log(`[Queue Add] Depth: ${currentDepth}, URL: ${normalizedUrl}`);
    return { added: true, normalizedUrl };
  }

  /**
   * 次に実行すべきアクション(URL)のリストを取得する。
   * @returns 次に処理する CrawlQueueItem の配列
   */
  public getNextActions(): CrawlQueueItem[] {
    if (this.queue.length === 0 || this.totalRequestCount >= this.maxRequests) {
      return [];
    }
    // スコアに基づいてソート (score が大きい方が先頭)
    this.queue.sort((a, b) => b.score - a.score); // 降順ソート

    // concurrentRequests 分だけ取り出す
    const count = Math.min(
      this.queue.length,
      this.concurrentRequests,
      this.maxRequests - this.totalRequestCount // 残りリクエスト数も考慮
    );
    const actions = this.queue.splice(0, count);
    this.totalRequestCount += actions.length; // リクエスト数を加算
    return actions;
  }

  /**
   * 指定されたアクション(URL)を処理する。
   * @param actions 処理する CrawlQueueItem の配列
   */
  public async step(actions: CrawlQueueItem[]): Promise<void> {
    if (actions.length === 0) return;

    console.log(
      `\n[Step Start] Processing ${actions.length} actions. Total requests: ${this.totalRequestCount}/${this.maxRequests}`
    );

    const processingPromises = actions.map(async (item) => {
      // console.log(
      //   `  [Crawling] Depth: ${item.depth}, Score: ${item.score}, URL: ${item.url}`
      // );
      const loadResult = await this.loader.load(item.url);
      const html = loadResult.content; // content を取り出す
      const cacheHit = loadResult.cacheHit; // cacheHit を取り出す

      // アクションログを記録
      await this.logAction(item.url, cacheHit);

      if (!html) {
        this.failedUrls.add(item.url); // 失敗リストに追加
        return;
      }

      try {
        const result = readable(html, { url: item.url }); // html (content) を渡す

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

    await Promise.all(processingPromises);

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
      `\n[Meta Save] Writing metadata (overwrite). Total requests: ${this.totalRequestCount}`
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

  // writeFinalData は writeEpochData が上書きするため不要になった

  // 外部からグラフや訪問済みリストを取得するためのゲッター
  public getLinkGraph(): Map<string, Set<string>> {
    return this.linkGraph;
  }

  public getVisitedUrls(): Set<string> {
    return this.visited;
  }

  public isFinished(): boolean {
    return (
      this.queue.length === 0 || this.totalRequestCount >= this.maxRequests
    );
  }
}

// CrawlerOptions に epochSize を追加
declare module "./types.ts" {
  interface CrawlerOptions {
    epochSize?: number;
    outputDir?: string; // 出力ディレクトリ指定用
  }
}
