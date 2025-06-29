# Crawl Workflow

このドキュメントは、readabilityを使用してウェブサイトをクロールし、コンテンツを抽出するワークフローを説明します。

## 基本的なクロールワークフロー

### 1. ページ構造の分析

まず、対象ページの構造を分析して、どのようなコンテンツが含まれているかを確認します：

```bash
# ページ構造を分析
readability --analyze-structure https://example.com/docs

# 出力例：
{
  "pageType": "documentation",
  "hasMainContent": true,
  "navigations": {
    "global": true,
    "breadcrumb": true,
    "toc": true,
    "sidebar": true,
    "pagination": false
  },
  "contentAreas": {
    "header": true,
    "mainContent": true,
    "sidebar": true,
    "footer": true
  }
}
```

### 2. ナビゲーション構造の抽出

ドキュメントサイトの場合、まずナビゲーション構造を抽出してサイト全体の構成を把握します：

```bash
# すべてのナビゲーションを抽出
readability --extract-nav https://example.com/docs

# サイドバーのナビゲーションのみ抽出
readability --extract-nav --nav-location sidebar https://example.com/docs

# グローバルナビゲーションのみ抽出
readability --extract-nav --nav-type global https://example.com/docs
```

### 3. コンテンツの抽出

#### 基本的なコンテンツ抽出

```bash
# デフォルト（本文のみ）
readability https://example.com/docs/getting-started

# HTMLフォーマットで抽出
readability -f html https://example.com/docs/getting-started
```

#### コンテキスト付きコンテンツ抽出

```bash
# パンくずリストやセクション情報を含む
readability --extract-content --with-context https://example.com/docs/getting-started
```

#### ドキュメントモード

```bash
# ナビゲーション構造と本文を統合
readability --doc-mode https://example.com/docs/getting-started
```

### 4. 完全な分析

```bash
# すべての情報を一度に取得
readability --full-analysis https://example.com/docs
```

## AI向けクロールワークフロー

### 1. サイト構造の把握

```bash
# AI向けサマリーフォーマットで概要を取得
readability -f ai-summary https://example.com/docs

# 出力例：
{
  "url": "https://example.com/docs",
  "type": "documentation",
  "title": "Documentation",
  "summary": "Welcome to our documentation...",
  "mainTopics": ["Getting Started", "API Reference", "Guides"],
  "navigationSummary": {
    "breadcrumb": "Home > Documentation",
    "sections": 5,
    "hasTableOfContents": true,
    "hasSidebar": true
  }
}
```

### 2. 構造化データの取得

```bash
# AI向け構造化フォーマット
readability -f ai-structured https://example.com/docs
```

### 3. 段階的な深堀り

```bash
# ステップ1: 構造分析
STRUCTURE=$(readability --analyze-structure https://example.com/docs)

# ステップ2: サイドバーナビゲーションからページリストを取得
NAV=$(readability --extract-nav --nav-location sidebar https://example.com/docs)

# ステップ3: 各ページをクロール（擬似コード）
for page in $(echo $NAV | jq -r '.navigations[].items[].href'); do
  readability --extract-content --with-context "https://example.com$page"
done
```

## 実践的な例

### Cloudflareドキュメントのクロール

```bash
# 1. トップページの構造を分析
readability --analyze-structure https://developers.cloudflare.com/workers/

# 2. サイドバーナビゲーションを抽出してページ一覧を取得
readability --extract-nav --nav-location sidebar https://developers.cloudflare.com/workers/ > workers-nav.json

# 3. 特定のセクションのコンテンツを抽出
readability --doc-mode https://developers.cloudflare.com/workers/get-started/guide/

# 4. AI向けに要約を生成
readability -f ai-summary https://developers.cloudflare.com/workers/runtime-apis/
```

### ブログサイトのクロール

```bash
# 1. 記事一覧ページから記事リンクを抽出
readability --extract-nav --nav-type local https://blog.example.com/

# 2. 個別記事を抽出
readability https://blog.example.com/2024/01/article-title

# 3. ページネーションを確認
readability --extract-nav --nav-type pagination https://blog.example.com/page/2
```

## 自動化スクリプトの例

### Bashスクリプト

```bash
#!/bin/bash

# ドキュメントサイトクローラー
BASE_URL="https://docs.example.com"
OUTPUT_DIR="./crawled-docs"

mkdir -p "$OUTPUT_DIR"

# ナビゲーション構造を取得
echo "Extracting navigation structure..."
readability --extract-nav "$BASE_URL" > "$OUTPUT_DIR/navigation.json"

# 各ページをクロール
cat "$OUTPUT_DIR/navigation.json" | jq -r '.navigations[].items[].href' | while read -r path; do
  # URLを構築
  if [[ "$path" =~ ^https?:// ]]; then
    URL="$path"
  else
    URL="${BASE_URL}${path}"
  fi

  # ファイル名を生成
  FILENAME=$(echo "$path" | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g')

  echo "Crawling: $URL"

  # コンテンツを抽出
  readability --doc-mode "$URL" > "$OUTPUT_DIR/${FILENAME}.md"

  # AI向けサマリーも生成
  readability -f ai-summary "$URL" > "$OUTPUT_DIR/${FILENAME}-summary.json"

  sleep 1  # Be nice to the server
done
```

### Node.jsスクリプト

```javascript
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

async function crawlDocumentation(baseUrl, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  // Step 1: Extract navigation
  console.log("Extracting navigation structure...");
  const { stdout: navJson } = await execAsync(`readability --extract-nav ${baseUrl}`);
  const navigation = JSON.parse(navJson);

  await fs.writeFile(path.join(outputDir, "navigation.json"), JSON.stringify(navigation, null, 2));

  // Step 2: Crawl each page
  const pages = navigation.navigations.flatMap((nav) => nav.items).map((item) => item.href);

  for (const pagePath of pages) {
    const url = pagePath.startsWith("http") ? pagePath : `${baseUrl}${pagePath}`;

    console.log(`Crawling: ${url}`);

    try {
      // Extract content with context
      const { stdout: content } = await execAsync(
        `readability --extract-content --with-context "${url}"`
      );

      const filename = pagePath.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");

      await fs.writeFile(path.join(outputDir, `${filename}.json`), content);

      // Wait between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error.message);
    }
  }

  console.log("Crawling completed!");
}

// Usage
crawlDocumentation("https://docs.example.com", "./output").catch(console.error);
```

## ベストプラクティス

### 1. レート制限の考慮

```bash
# クロール間隔を設ける
for url in "${urls[@]}"; do
  readability "$url"
  sleep 2  # 2秒待機
done
```

### 2. エラーハンドリング

```bash
# エラーを記録しながらクロール
readability "$url" 2>> errors.log || echo "Failed: $url" >> failed-urls.txt
```

### 3. 増分クロール

```bash
# 既存ファイルをチェックしてスキップ
if [ ! -f "$OUTPUT_FILE" ]; then
  readability "$url" > "$OUTPUT_FILE"
fi
```

### 4. 並列クロール（慎重に）

```bash
# GNU Parallelを使用（同時実行数を制限）
cat urls.txt | parallel -j 3 'readability {} > output/{#}.md'
```

## トラブルシューティング

### コンテンツが抽出されない場合

```bash
# 閾値を下げて再試行
readability -t 100 https://example.com/page

# 構造を確認
readability --analyze-structure https://example.com/page
```

### ナビゲーションが検出されない場合

```bash
# すべてのナビゲーションタイプを確認
readability --extract-nav https://example.com/page | jq '.navigations[].type'

# ドキュメントモードで再試行
readability --doc-mode https://example.com/page
```

### メモリ使用量が多い場合

```bash
# 個別ページごとに処理
# 大きなバッチ処理は避ける
```

## 高度な使用例

### サイトマップからのクロール

```bash
# サイトマップをダウンロード
curl https://example.com/sitemap.xml -o sitemap.xml

# URLを抽出してクロール
xmllint --xpath "//*[local-name()='loc']/text()" sitemap.xml | while read -r url; do
  readability "$url" > "$(echo "$url" | md5sum | cut -d' ' -f1).md"
done
```

### 差分検出

```bash
# 前回のクロール結果と比較
OLD_CONTENT=$(cat old-content.md)
NEW_CONTENT=$(readability https://example.com/page)

if [ "$OLD_CONTENT" != "$NEW_CONTENT" ]; then
  echo "Content has changed!"
  echo "$NEW_CONTENT" > new-content.md
fi
```

### メタデータ付きクロール

```bash
# フルアナリシスでメタデータも保存
readability --full-analysis https://example.com/page > page-full.json

# 必要な部分だけ抽出
jq '{
  title: .metadata.title,
  content: .content.main,
  lastCrawled: now | strftime("%Y-%m-%d %H:%M:%S")
}' page-full.json > page-processed.json
```
