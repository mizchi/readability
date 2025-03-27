// loaders/types.ts

/**
 * ローダーの取得結果を表すインターフェース
 */
export interface LoadResult {
  content: string | null; // 取得したコンテンツ、または失敗時に null
  status?: number; // HTTPステータスコードなど
  contentType?: string | null; // Content-Typeヘッダー
  finalUrl?: string; // リダイレクト後の最終的なURL
  // cacheHit は CachingLoader が付与するため、基本の Loader インターフェースからは削除
}

/**
 * ローダーの基本的なインターフェース定義
 */
export interface ILoader {
  /**
   * 指定されたURLからコンテンツを取得する。
   * @param url 取得対象のURL
   * @returns 取得結果
   */
  load(url: string): Promise<LoadResult>;
}

/**
 * Key-Valueストアの基本的なインターフェース
 */
export interface KVBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
