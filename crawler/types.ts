// crawler/types.ts
// export interface CrawlQueueItem { // 古い定義をコメントアウトまたは削除
//   url: string;
//   score: number;
//   depth: number;
// }

// 新しいキューアイテムの型定義
export type ActionQueueItem = {
  type: "fetch"; // アクションの種類 (将来的に他のタイプを追加可能)
  url: string;
  score: number; // 優先度スコア
  depth: number; // クロール深度
  init?: unknown; // 初期化パラメータ (オプション)
};

export interface CrawlerOptions {
  maxDepth?: number;
  maxRequests?: number;
  concurrentRequests?: number;
  delayMs?: number;
}

// ILoader と LoadResult は loaders/types.ts に移動しました
