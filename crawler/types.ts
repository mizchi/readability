// crawler/types.ts
export interface CrawlQueueItem {
  url: string;
  // priority: number; // スコアで代替するため不要に
  score: number; // リンクの種類と深さに基づくスコア (高いほど優先)
  depth: number; // クロール深度
}

export interface CrawlerOptions {
  maxDepth?: number;
  maxRequests?: number;
  concurrentRequests?: number;
  delayMs?: number;
}

/**
 * ローダーの取得結果を表すインターフェース
 */
export interface LoadResult {
  content: string | null; // 取得したコンテンツ、または失敗時に null
  cacheHit: boolean; // キャッシュから取得したかどうか
}

/**
 * ローダーのインターフェース定義
 */
export interface ILoader {
  /**
   * 指定されたURLからコンテンツを取得する。
   * キャッシュが存在すればキャッシュから、なければ外部から取得する。
   * @param url 取得対象のURL
   * @returns コンテンツ文字列、または取得失敗時に null
   */
  load(url: string): Promise<LoadResult>;

  /**
   * キャッシュから指定されたURLのコンテンツを取得する。
   * 外部へのフェッチは行わない。
   * @param url 取得対象のURL
   * @returns キャッシュされたコンテンツ文字列、またはキャッシュがない場合に null
   */
  get(url: string): Promise<LoadResult>;

  /**
   * 指定されたURLのコンテンツがキャッシュに存在するか確認する。
   * @param url 確認対象のURL
   * @returns キャッシュが存在すれば true、なければ false
   */
  has(url: string): Promise<boolean>;

  /**
   * 指定されたURLのコンテンツをキャッシュから削除する。
   * @param url 削除対象のURL
   */
  delete(url: string): Promise<void>;
}
