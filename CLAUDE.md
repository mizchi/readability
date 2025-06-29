# readability プロジェクト

HTMLから本文やナビゲーション要素を抽出するためのNode.js/TypeScriptライブラリです。

## プロジェクト概要

- **目的**: ウェブページから意味のあるコンテンツとナビゲーション構造を抽出
- **特徴**: 
  - ARIAツリーベースの解析
  - ナビゲーション要素の分類（global, breadcrumb, toc, pagination等）
  - ドキュメントサイト向け最適化
  - AI向け構造化出力フォーマット

## ビルドとテスト

```bash
# インストール
npm install

# ビルド
npm run build

# テスト
npm test

# リンターとタイプチェック
npm run lint
npm run typecheck
```

## CLIの使い方

### 基本的な使用方法
```bash
# 本文抽出（デフォルト）
readability <url>

# HTMLフォーマットで出力
readability -f html <url>

# 文字数閾値を変更
readability -t 100 <url>
```

### 段階的分析（AI向け）
```bash
# ページ構造の分析
readability --analyze-structure <url>

# ナビゲーション要素のみ抽出
readability --extract-nav <url>

# コンテキスト付きコンテンツ抽出
readability --extract-content --with-context <url>

# 完全な分析
readability --full-analysis <url>
```

### AI向けフォーマット
```bash
# 簡潔なサマリー
readability -f ai-summary <url>

# 構造化データ
readability -f ai-structured <url>
```

### ドキュメントモード
```bash
# ナビゲーションと本文を統合
readability --doc-mode <url>
```

## 主要ディレクトリ構成

```
src/
├── extract/          # コンテンツ抽出ロジック
├── detect/           # ナビゲーション・構造検出
│   ├── navigation.ts # ナビゲーション検出
│   └── document.ts   # ドキュメント構造解析
├── format/           # 出力フォーマット
├── aria/             # ARIAツリー構築
└── cli.ts           # CLIエントリーポイント
```

## 重要な型定義

### NavigationType
```typescript
type NavigationType = 
  | "global"      // サイト全体のナビゲーション
  | "breadcrumb"  // パンくずリスト
  | "toc"         // 目次
  | "pagination"  // ページネーション
  | "social"      // ソーシャルリンク
  | "footer"      // フッターナビゲーション
  | "utility"     // ユーティリティリンク
  | "local"       // ローカルナビゲーション
```

### NavigationLocation
```typescript
type NavigationLocation = 
  | "header"      // ヘッダー内
  | "sidebar"     // サイドバー内
  | "footer"      // フッター内
  | "inline"      // コンテンツ内
```

## テスト実行時の注意

以下のテストは除外されています（互換性の問題）：
- `src/test/nav-links.test.ts`
- `src/test/nav-hierarchy-snapshot.test.ts`
- `src/detect/header.test.ts`
- `src/format/markdown.test.ts`
- `src/test/readability-core.test.ts`
- `src/test/readability-compatibility.test.ts`

## リリース手順

1. バージョンを更新: `npm version patch/minor/major`
2. ビルドとテスト: `npm run build && npm test`
3. コミット作成
4. タグをプッシュ: `git push --tags`
5. GitHub Actionsが自動的にリリースを作成

## よくある使用例

### ドキュメントサイトのクロール
```bash
# 構造を分析
readability --analyze-structure https://docs.example.com

# サイドバーナビゲーションを抽出
readability --extract-nav --nav-location sidebar https://docs.example.com

# 個別ページをドキュメントモードで抽出
readability --doc-mode https://docs.example.com/getting-started
```

### ブログ記事の抽出
```bash
# シンプルに本文のみ
readability https://blog.example.com/article

# メタデータ付き
readability --extract-content --with-context https://blog.example.com/article
```

詳細なクロールワークフローについては `.claude/commands/crawl-workflow.md` を参照してください。