// loaders/caching_loader.ts
import type { ILoader, LoadResult, KVBackend } from "./types.ts";

/**
 * CachingLoader の取得結果。LoadResult に cacheHit プロパティを追加。
 */
export interface CachedLoadResult extends LoadResult {
  cacheHit: boolean;
}

/**
 * キャッシュ機能を提供するローダー。
 * 内部的に別の ILoader と KVBackend を利用する。
 */
export class CachingLoader {
  // 注意: ILoader インターフェースは実装しない (loadの戻り値型が異なるため)
  constructor(
    private innerLoader: ILoader, // 内部で使うローダー (e.g., FetcherLoader, PuppeteerLoader)
    private backend: KVBackend // キャッシュストレージ (e.g., FileSystemKVBackend)
  ) {}

  /**
   * 指定されたURLからコンテンツを取得する。
   * まずキャッシュを確認し、なければ内部ローダーで取得してキャッシュする。
   * @param url 取得対象のURL
   * @returns キャッシュヒット情報を含む取得結果
   */
  async load(url: string): Promise<CachedLoadResult> {
    // 1. キャッシュバックエンドを確認
    const cachedData = await this.backend.get(url);
    if (cachedData) {
      try {
        // キャッシュデータをパース (LoadResult全体を保存している想定)
        const result: LoadResult = JSON.parse(cachedData);
        // console.log(`[Cache Hit] ${url}`);
        return { ...result, cacheHit: true };
      } catch (error) {
        console.warn(`[Cache Parse Error] ${url}:`, error);
        // パースエラーの場合はキャッシュを削除してフォールバック
        await this.backend.delete(url);
      }
    }

    // 2. キャッシュがない場合、内部ローダーで取得
    // console.log(`[Cache Miss] ${url}`);
    const result = await this.innerLoader.load(url);

    // 3. 取得成功かつ content があればキャッシュに保存
    //    null content (e.g., fetchエラー) はキャッシュしない。
    //    HTML以外のコンテンツもキャッシュする（FetcherLoaderが返すため）。
    if (result.content !== null) {
      try {
        // LoadResult オブジェクト全体を JSON 文字列化して保存
        await this.backend.set(url, JSON.stringify(result));
        // console.log(`[Cache Saved] ${url}`);
      } catch (error) {
        console.error(`[Cache Write Error] ${url}:`, error);
      }
    }

    // 内部ローダーの結果に cacheHit: false を付与して返す
    return { ...result, cacheHit: false };
  }

  /**
   * キャッシュから指定されたURLのコンテンツを取得する。
   * 外部へのフェッチは行わない。
   * @param url 取得対象のURL
   * @returns キャッシュされたコンテンツ情報、またはキャッシュがない場合に null
   */
  async get(url: string): Promise<CachedLoadResult | null> {
    const cachedData = await this.backend.get(url);
    if (cachedData) {
      try {
        const result: LoadResult = JSON.parse(cachedData);
        return { ...result, cacheHit: true };
      } catch (error) {
        console.warn(`[Cache Parse Error] ${url}:`, error);
        await this.backend.delete(url); // 不正なキャッシュは削除
      }
    }
    return null; // キャッシュなし
  }

  /**
   * 指定されたURLのコンテンツがキャッシュに存在するか確認する。
   * @param url 確認対象のURL
   * @returns キャッシュが存在すれば true、なければ false
   */
  async has(url: string): Promise<boolean> {
    return this.backend.has(url);
  }

  /**
   * 指定されたURLのコンテンツをキャッシュから削除する。
   * @param url 削除対象のURL
   */
  async delete(url: string): Promise<void> {
    return this.backend.delete(url);
  }
}
