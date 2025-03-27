// crawler/loader.ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto"; // crypto モジュールをインポート
import type { ILoader, LoadResult } from "./types.ts"; // ILoader インターフェースと LoadResult をインポート

// --- 定数 ---
// const CACHE_DIR = "./.crawler_cache"; // キャッシュディレクトリ

// --- CacheLoader クラス ---
export class CacheLoader implements ILoader {
  private cache = new Map<string, string>();
  private cacheInitialized = false;
  private lastFetchTime = 0;
  private cacheDir: string; // キャッシュディレクトリを保持

  constructor(
    private interval = 1000,
    cacheDir: string // デフォルト値を削除し、必須引数にする
  ) {
    this.cacheDir = cacheDir; // 受け取ったディレクトリを使用
  }

  private async initializeCache() {
    if (this.cacheInitialized) return;
    try {
      await fs.mkdir(this.cacheDir, { recursive: true }); // this.cacheDir を使用
      // TODO: 必要であれば既存のキャッシュファイルを読み込む
      this.cacheInitialized = true;
      console.log(`[Cache Initialized] Directory: ${this.cacheDir}`); // this.cacheDir を表示
    } catch (error) {
      console.error("Failed to initialize cache directory:", error);
      // 初期化失敗しても処理は続行するが、ファイルキャッシュは利用不可
    }
  }

  private getCachePath(url: string): string {
    // URLからMD5ハッシュを計算してファイル名にする
    const md5Hash = crypto.createHash("md5").update(url).digest("hex");
    return path.join(this.cacheDir, `${md5Hash}.html`); // this.cacheDir を使用
  }

  // --- ILoader インターフェースの実装 ---

  async load(url: string): Promise<LoadResult> {
    await this.initializeCache();

    // 1. メモリキャッシュ確認
    if (this.cache.has(url)) {
      // console.log(`[Cache Hit (Memory)] ${url}`);
      return { content: this.cache.get(url)!, cacheHit: true };
    }

    // 2. ファイルキャッシュ確認 (初期化成功時のみ)
    if (this.cacheInitialized) {
      const cachePath = this.getCachePath(url);
      try {
        const cachedContent = await fs.readFile(cachePath, "utf-8");
        // console.log(`[Cache Hit (File)] ${url}`);
        this.cache.set(url, cachedContent); // メモリにもキャッシュ
        return { content: cachedContent, cacheHit: true };
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.warn(`[Cache Read Error] ${url}:`, error.message);
        }
        // ファイルが存在しない場合は続行
      }
    }

    // 3. インターバル待機後にフェッチ実行
    await this.waitInterval(); // ★ インターバル待機
    // console.log(`[Fetching] ${url}`);
    try {
      this.lastFetchTime = Date.now(); // ★ fetch 開始時刻を記録
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "RooCrawler/1.0 (+https://github.com/mozilla/readability)", // Be polite
        },
      });
      if (!response.ok) {
        console.error(`[Fetch Error] ${url}: Status ${response.status}`);
        return { content: null, cacheHit: false }; // エラー時は null を返す
      }
      // Content-Type が HTML か確認
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.toLowerCase().includes("text/html")) {
        console.warn(
          `[Fetch Skip] ${url}: Not HTML (Content-Type: ${contentType})`
        );
        return { content: null, cacheHit: false };
      }

      const html = await response.text();

      // 4. キャッシュに保存 (初期化成功時のみ)
      if (this.cacheInitialized) {
        this.cache.set(url, html); // メモリキャッシュ
        const cachePath = this.getCachePath(url);
        try {
          await fs.writeFile(cachePath, html, "utf-8"); // ファイルキャッシュ
          // console.log(`[Cache Saved] ${url}`);
        } catch (error) {
          console.error(`[Cache Write Error] ${url}:`, error);
        }
      } else {
        // 初期化失敗時はメモリキャッシュのみ
        this.cache.set(url, html);
        // console.log(`[Cache Saved (Memory Only)] ${url}`);
      }

      return { content: html, cacheHit: false };
    } catch (error) {
      console.error(`[Fetch Exception] ${url}:`, error);
      return { content: null, cacheHit: false }; // エラー時は null を返す
    }
  }

  // --- ヘルパーメソッド ---

  private async waitInterval() {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    if (this.interval > 0 && timeSinceLastFetch < this.interval) {
      const waitTime = this.interval - timeSinceLastFetch;
      // console.log(`[Waiting] ${waitTime}ms before next fetch...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  async get(url: string): Promise<LoadResult> {
    await this.initializeCache();

    // 1. メモリキャッシュ確認
    if (this.cache.has(url)) {
      return { content: this.cache.get(url)!, cacheHit: true };
    }

    // 2. ファイルキャッシュ確認 (初期化成功時のみ)
    if (this.cacheInitialized) {
      const cachePath = this.getCachePath(url);
      try {
        const cachedContent = await fs.readFile(cachePath, "utf-8");
        this.cache.set(url, cachedContent); // メモリにもキャッシュしておく
        return { content: cachedContent, cacheHit: true };
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.warn(`[Cache Read Error] ${url}:`, error.message);
        }
      }
    }

    return { content: null, cacheHit: false }; // キャッシュになければ null
  }

  async has(url: string): Promise<boolean> {
    await this.initializeCache();

    // 1. メモリキャッシュ確認
    if (this.cache.has(url)) {
      return true;
    }

    // 2. ファイルキャッシュ確認 (初期化成功時のみ)
    if (this.cacheInitialized) {
      const cachePath = this.getCachePath(url);
      try {
        await fs.access(cachePath); // ファイルの存在確認
        return true;
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.warn(`[Cache Access Error] ${url}:`, error.message);
        }
      }
    }

    return false;
  }

  async delete(url: string): Promise<void> {
    await this.initializeCache();

    // 1. メモリキャッシュ削除
    this.cache.delete(url);

    // 2. ファイルキャッシュ削除 (初期化成功時のみ)
    if (this.cacheInitialized) {
      const cachePath = this.getCachePath(url);
      try {
        await fs.unlink(cachePath);
        console.log(`[Cache Deleted] ${url}`);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          // ファイルが存在しない場合は何もしない
        } else {
          console.error(`[Cache Delete Error] ${url}:`, error);
        }
      }
    }
  }
}

// デフォルトのローダーインスタンスをエクスポート (オプション)
// export const defaultLoader = new CacheLoader();
