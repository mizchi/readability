// crawler/db.ts
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { CrawlQueueItem } from "./types.ts";

/**
 * データベースファイルを初期化し、テーブルを作成する。
 * @param outputDir 出力ディレクトリ
 * @returns DatabaseSync インスタンス
 */
export function initializeDb(outputDir: string): DatabaseSync {
  const metaDir = path.join(outputDir, "_meta");
  const dbPath = path.join(metaDir, "crawler_state.sqlite");

  try {
    // ディレクトリが存在しない場合のみ作成
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
      console.log(`[DB Init] Created directory: ${metaDir}`);
    }
    const db = new DatabaseSync(dbPath);
    createTables(db); // テーブル作成関数を呼び出す
    console.log(`[DB Init] Database initialized at ${dbPath}`);
    return db;
  } catch (error: any) {
    console.error(
      `[DB Init Error] Failed to initialize database:`,
      error.message
    );
    throw error;
  }
}

/**
 * 必要なテーブルを作成する。
 * @param db DatabaseSync インスタンス
 */
function createTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      url TEXT PRIMARY KEY,
      score REAL NOT NULL,
      depth INTEGER NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_queue_score ON queue (score DESC);

    -- visited テーブルを assets テーブルに変更
    CREATE TABLE IF NOT EXISTS assets (
      url TEXT PRIMARY KEY,                     -- 正規化済みURL
      originalUrl TEXT NOT NULL,                -- 元のURL
      method TEXT NOT NULL DEFAULT 'GET',       -- HTTPメソッド
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP NULL,                 -- 論理削除用
      title TEXT NULL,                          -- ページのタイトル
      markdownSummary TEXT NULL                 -- Markdownサマリー
    );
    -- updatedAt を自動更新するトリガー
    CREATE TRIGGER IF NOT EXISTS trigger_assets_updated_at AFTER UPDATE ON assets
    BEGIN
      UPDATE assets SET updatedAt = CURRENT_TIMESTAMP WHERE url = NEW.url;
    END;

    CREATE TABLE IF NOT EXISTS link_graph (
      from_url TEXT NOT NULL,
      to_url TEXT NOT NULL,
      PRIMARY KEY (from_url, to_url),
      FOREIGN KEY (from_url) REFERENCES assets(url) ON DELETE CASCADE, -- 参照整合性
      FOREIGN KEY (to_url) REFERENCES assets(url) ON DELETE CASCADE   -- 参照整合性
    );
    CREATE INDEX IF NOT EXISTS idx_link_graph_from ON link_graph (from_url);
    CREATE INDEX IF NOT EXISTS idx_link_graph_to ON link_graph (to_url); -- 追加: to_url にもインデックス

    CREATE TABLE IF NOT EXISTS failed (
      url TEXT PRIMARY KEY,
      failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (url) REFERENCES assets(url) ON DELETE CASCADE -- 参照整合性
    );

    CREATE TABLE IF NOT EXISTS actions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      cache_hit INTEGER NOT NULL, -- 0 or 1
      FOREIGN KEY (url) REFERENCES assets(url) ON DELETE CASCADE -- 参照整合性
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // 外部キー制約を有効にする (接続ごとに必要)
  db.exec("PRAGMA foreign_keys = ON;");
}

// --- メタデータ操作 ---
export function getMetadata(db: DatabaseSync, key: string): string | null {
  try {
    const row = db
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch (error: any) {
    console.error(
      `[DB Error getMetadata] Failed for key ${key}:`,
      error.message
    );
    return null;
  }
}

export function setMetadata(
  db: DatabaseSync,
  key: string,
  value: string
): void {
  try {
    db.prepare(
      "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)"
    ).run(key, value);
  } catch (error: any) {
    console.error(
      `[DB Error setMetadata] Failed for key ${key}:`,
      error.message
    );
  }
}

// --- キュー/アセット操作 ---
export function addToQueueAndAssets(
  db: DatabaseSync,
  url: string,
  originalUrl: string,
  method: string,
  score: number,
  depth: number
): boolean {
  try {
    db.exec("BEGIN");
    let addedToQueue = false; // キューに追加されたかどうかのフラグ
    try {
      // assets テーブルに追加または無視 (createdAt はデフォルト、updatedAt はトリガー)
      // このURLが assets に初めて記録される場合のみ true を返すように変更も可能だが、
      // addToQueue の呼び出し元は added フラグを直接利用していないため、ここでは queue への追加のみを追跡する。
      db.prepare(
        "INSERT OR IGNORE INTO assets (url, originalUrl, method) VALUES (?, ?, ?)"
      ).run(url, originalUrl, method);

      // queue テーブルに存在しない場合のみ追加
      const existingQueueItem = db
        .prepare("SELECT 1 FROM queue WHERE url = ?")
        .get(url);
      if (!existingQueueItem) {
        db.prepare(
          "INSERT INTO queue (url, score, depth) VALUES (?, ?, ?)"
        ).run(url, score, depth);
        addedToQueue = true; // 実際にキューに追加された
      }

      db.exec("COMMIT");
      // return true; // 常に true を返していたのを修正
      return addedToQueue; // 実際にキューに追加されたかどうかを返す
    } catch (e) {
      db.exec("ROLLBACK");
      throw e; // エラーを再スロー
    }
  } catch (error: any) {
    console.error(
      `[DB Error addToQueueAndAssets] Failed for ${url}:`,
      error.message
    );
    return false;
  }
} // ここに閉じ括弧を追加

export function setAssetMetadata(
  db: DatabaseSync,
  url: string,
  title: string | null,
  markdownSummary: string | null
): void {
  try {
    // title と markdownSummary を更新する (updatedAt はトリガーで更新される)
    db.prepare(
      "UPDATE assets SET title = ?, markdownSummary = ? WHERE url = ?"
    ).run(title, markdownSummary, url);
  } catch (error: any) {
    console.error(
      `[DB Error setAssetMetadata] Failed for ${url}:`,
      error.message
    );
  }
  // }
}

export function getNextActionsFromQueue(
  db: DatabaseSync,
  limit: number
): CrawlQueueItem[] {
  try {
    const rows = db
      .prepare(
        "SELECT url, score, depth FROM queue ORDER BY score DESC LIMIT ?"
      )
      .all(limit) as CrawlQueueItem[];

    if (rows.length > 0) {
      const urlsToDelete = rows.map((row) => row.url);
      const placeholders = urlsToDelete.map(() => "?").join(",");
      db.exec("BEGIN");
      try {
        db.prepare(`DELETE FROM queue WHERE url IN (${placeholders})`).run(
          ...urlsToDelete
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    return rows;
  } catch (error: any) {
    console.error(`[DB Error getNextActionsFromQueue]`, error.message);
    return [];
  }
}

export function getQueueCount(db: DatabaseSync): number {
  try {
    return (
      db.prepare("SELECT COUNT(*) as count FROM queue").get() as {
        count: number;
      }
    ).count;
  } catch (error: any) {
    console.error(`[DB Error getQueueCount]`, error.message);
    return -1;
  }
}

// --- Asset 操作 ---
export function isAssetExisting(db: DatabaseSync, url: string): boolean {
  try {
    // assets テーブルに URL が存在し、削除されていないか確認
    const assetCheck = db
      .prepare("SELECT 1 FROM assets WHERE url = ? AND deletedAt IS NULL")
      .get(url);
    return !!assetCheck; // 存在すれば true, しなければ false
  } catch (error: any) {
    console.error(
      `[DB Error isAssetExisting] Failed for ${url}:`,
      error.message
    );
    // エラー時（テーブルが存在しない場合など）は存在しないとみなす
    return false;
  }
}

// 必要に応じて論理削除用の関数を追加
export function markAssetAsDeleted(db: DatabaseSync, url: string): void {
  try {
    db.prepare(
      "UPDATE assets SET deletedAt = CURRENT_TIMESTAMP WHERE url = ? AND deletedAt IS NULL"
    ).run(url);
  } catch (error: any) {
    console.error(
      `[DB Error markAssetAsDeleted] Failed for ${url}:`,
      error.message
    );
  }
}

// --- Failed 操作 ---
export function addFailedUrl(db: DatabaseSync, url: string): void {
  try {
    db.prepare("INSERT OR IGNORE INTO failed (url) VALUES (?)").run(url);
  } catch (error: any) {
    console.error(`[DB Error addFailedUrl] Failed for ${url}:`, error.message);
  }
}

// --- Failed URL 取得 ---
export function getFailedUrlsSet(db: DatabaseSync): Set<string> {
  try {
    const rows = db.prepare("SELECT url FROM failed").all() as {
      url: string;
    }[];
    return new Set(rows.map((row) => row.url));
  } catch (error: any) {
    console.error(`[DB Error getFailedUrlsSet]`, error.message);
    return new Set(); // エラー時は空の Set を返す
  }
}

// --- アクションログ ---
export function logAction(
  db: DatabaseSync,
  url: string,
  cacheHit: boolean
): void {
  try {
    db.prepare(
      "INSERT INTO actions_log (url, timestamp, cache_hit) VALUES (?, ?, ?)"
    ).run(url, new Date().toISOString(), cacheHit ? 1 : 0);
  } catch (error: any) {
    console.error(`[DB Error logAction] Failed for ${url}:`, error.message);
  }
}

// --- リンクグラフ ---
export function addLinkGraphEdges(
  db: DatabaseSync,
  links: { from: string; to: string }[]
): void {
  if (links.length === 0) return;
  db.exec("BEGIN");
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO link_graph (from_url, to_url) VALUES (?, ?)"
    );
    for (const link of links) {
      stmt.run(link.from, link.to);
    }
    db.exec("COMMIT");
  } catch (e: any) {
    db.exec("ROLLBACK");
    console.error(`[DB Error addLinkGraphEdges Transaction]:`, e.message);
  }
}

// --- 統計情報/データ取得 ---
export function getStats(db: DatabaseSync): {
  assetCount: number;
  failedCount: number;
} {
  try {
    // assets テーブル (削除されていないもの) の件数を取得
    const assetCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM assets WHERE deletedAt IS NULL")
        .get() as { count: number }
    ).count;
    const failedCount = (
      db.prepare("SELECT COUNT(*) as count FROM failed").get() as {
        count: number;
      }
    ).count;
    return { assetCount, failedCount };
  } catch (error: any) {
    console.error(`[DB Error getStats]`, error.message);
    return { assetCount: 0, failedCount: 0 }; // エラー時は 0 を返す
  }
}

export function getGraphData(db: DatabaseSync): {
  linkGraph: Map<string, Set<string>>;
  visited: Set<string>;
} {
  const linkGraph = new Map<string, Set<string>>();
  const visited = new Set<string>();
  try {
    const links = db
      .prepare("SELECT from_url, to_url FROM link_graph")
      .all() as { from_url: string; to_url: string }[];
    for (const link of links) {
      if (!linkGraph.has(link.from_url)) {
        linkGraph.set(link.from_url, new Set());
      }
      linkGraph.get(link.from_url)!.add(link.to_url);
    }

    // assets テーブル (削除されていないもの) から全 URL を取得し、Set を構築
    const visitedUrls = db
      .prepare("SELECT url FROM assets WHERE deletedAt IS NULL")
      .all() as { url: string }[];
    for (const row of visitedUrls) {
      visited.add(row.url);
    }
  } catch (error: any) {
    console.error(`[DB Error getGraphData]`, error.message);
  }
  return { linkGraph, visited };
}

// --- 出力用データ取得 ---
export function getAssetsForOutput(db: DatabaseSync): {
  url: string;
  hostname: string;
  pathname: string;
  title: string | null;
  markdownSummary: string | null;
}[] {
  try {
    // 削除されていないアセットの情報を取得
    const rows = db
      .prepare(
        "SELECT url, title, markdownSummary FROM assets WHERE deletedAt IS NULL"
      )
      .all() as {
      url: string;
      title: string | null;
      markdownSummary: string | null;
    }[];
    // URLをパースして hostname と pathname を追加
    return rows
      .map((row) => {
        try {
          const parsed = new URL(row.url);
          return {
            ...row,
            hostname: parsed.hostname,
            pathname: parsed.pathname,
          };
        } catch (e) {
          console.warn(`[getAssetsForOutput] Failed to parse URL: ${row.url}`);
          // パース失敗時は hostname, pathname を空にするか、除外するか検討
          return {
            ...row,
            hostname: "",
            pathname: "",
          };
        }
      })
      .filter((row) => row.hostname); // パース失敗したものは除外 (hostnameが空)
  } catch (error: any) {
    console.error(`[DB Error getAssetsForOutput]`, error.message);
    return [];
  }
}

// --- DB クローズ ---
export function closeDb(db: DatabaseSync): void {
  try {
    db.close();
    console.log(`[DB Close] Database connection closed.`);
  } catch (error: any) {
    console.error(`[DB Close Error]`, error.message);
  }
}
