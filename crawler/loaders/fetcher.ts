// loaders/fetcher.ts
import type { ILoader, LoadResult } from "./types.ts";

export interface FetcherLoaderOptions {
  interval?: number; // フェッチ間隔 (ms)
  userAgent?: string; // User-Agent 文字列
}

export class FetcherLoader implements ILoader {
  private lastFetchTime = 0;
  private interval: number;
  private userAgent: string;

  constructor(options: FetcherLoaderOptions = {}) {
    this.interval = options.interval ?? 1000; // デフォルト1秒
    this.userAgent =
      options.userAgent ??
      "RooCrawler/1.0 (+https://github.com/mozilla/readability)"; // デフォルトUA
  }

  async load(url: string): Promise<LoadResult> {
    await this.waitInterval();
    // console.log(`[Fetching] ${url}`);
    try {
      this.lastFetchTime = Date.now();
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
        redirect: "follow", // リダイレクトを追跡
      });

      const status = response.status;
      const finalUrl = response.url; // リダイレクト後のURL
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        console.error(`[Fetch Error] ${url}: Status ${status}`);
        return { content: null, status, contentType, finalUrl };
      }

      // Content-Type が HTML か確認 (より厳密に判定しても良い)
      if (!contentType || !contentType.toLowerCase().includes("text/html")) {
        console.warn(
          `[Fetch Skip] ${url}: Not HTML (Content-Type: ${contentType})`
        );
        // HTML以外でも内容は返すように変更（後段で処理するか判断できるように）
        // ただし、content は null にしておくか、あるいはそのまま返すか？ -> 一旦そのまま返す
        const content = await response.text();
        return { content, status, contentType, finalUrl };
        // return { content: null, status, contentType, finalUrl };
      }

      const html = await response.text();
      return { content: html, status, contentType, finalUrl };
    } catch (error) {
      console.error(`[Fetch Exception] ${url}:`, error);
      // エラー発生時も status や contentType は不明なため undefined のまま
      return { content: null };
    }
  }

  private async waitInterval() {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    if (this.interval > 0 && timeSinceLastFetch < this.interval) {
      const waitTime = this.interval - timeSinceLastFetch;
      console.log(`[Waiting] ${waitTime}ms before next fetch...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}
