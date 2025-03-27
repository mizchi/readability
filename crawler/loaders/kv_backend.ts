// loaders/kv_backend.ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { KVBackend } from "./types.ts";

export class FileSystemKVBackend implements KVBackend {
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;

  constructor(private cacheDir: string) {}

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      try {
        await fs.mkdir(this.cacheDir, { recursive: true });
        this.initialized = true;
        console.log(`[KVBackend Initialized] Directory: ${this.cacheDir}`);
      } catch (error) {
        console.error("Failed to initialize KVBackend directory:", error);
        // 初期化失敗してもエラーはスローせず、後続の操作で失敗させる
      } finally {
        this.initializingPromise = null;
      }
    })();
    return this.initializingPromise;
  }

  private getKeyPath(key: string): string {
    // キー（URL想定）からMD5ハッシュを計算してファイル名にする
    const md5Hash = crypto.createHash("md5").update(key).digest("hex");
    return path.join(this.cacheDir, md5Hash);
  }

  async get(key: string): Promise<string | null> {
    await this.initialize();
    if (!this.initialized) return null; // 初期化失敗時は null

    const filePath = this.getKeyPath(key);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.warn(`[KVBackend Read Error] Key ${key}:`, error.message);
      }
      return null; // ファイルが存在しないか、読み取りエラー
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.initialize();
    if (!this.initialized) {
      console.error(
        `[KVBackend Write Error] Key ${key}: Backend not initialized.`
      );
      return; // 初期化失敗時は書き込まない
    }

    const filePath = this.getKeyPath(key);
    try {
      await fs.writeFile(filePath, value, "utf-8");
    } catch (error) {
      console.error(`[KVBackend Write Error] Key ${key}:`, error);
    }
  }

  async has(key: string): Promise<boolean> {
    await this.initialize();
    if (!this.initialized) return false; // 初期化失敗時は false

    const filePath = this.getKeyPath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.warn(`[KVBackend Access Error] Key ${key}:`, error.message);
      }
      return false; // ファイルが存在しないか、アクセスエラー
    }
  }

  async delete(key: string): Promise<void> {
    await this.initialize();
    if (!this.initialized) return; // 初期化失敗時は何もしない

    const filePath = this.getKeyPath(key);
    try {
      await fs.unlink(filePath);
      // console.log(`[KVBackend Deleted] Key: ${key}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error(`[KVBackend Delete Error] Key ${key}:`, error);
      }
      // ファイルが存在しない場合は何もしない
    }
  }
}
