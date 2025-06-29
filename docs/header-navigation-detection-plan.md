# ヘッダー・ナビゲーション検出機能の実装計画

## 概要

本文抽出機能に加えて、Webページの構造的要素（ヘッダー、ナビゲーション）を検出・分類する機能を実装する。

## 現状分析

### 既存機能

- ✅ ARIAツリーによるページ構造解析（`src/nav/aria.ts`）
- ✅ リンク階層分析（`src/nav/hierarchy.ts`）
- ✅ リンクの重み付けとフィルタリング（`src/nav/links.ts`）
- ⚠️ 基本的なナビゲーション検出はあるが、分類・抽出が不十分
- ❌ 専用のヘッダー検出機能なし

## 実装計画

### Phase 1: ヘッダー検出機能（v0.8.0）

#### 1.1 ヘッダー要素の検出（`src/detect/header.ts`）

```typescript
interface HeaderInfo {
  element: AriaNode;
  type: "main" | "article" | "section";
  contains: {
    logo?: AriaNode;
    siteTitle?: AriaNode;
    navigation?: NavigationInfo;
    search?: AriaNode;
  };
  position: "fixed" | "static" | "sticky";
  bounds?: DOMRect; // 視覚的位置情報
}

function detectHeaders(root: AriaNode): HeaderInfo[];
```

**実装内容：**

- `<header>`、`role="banner"`要素の検出
- ヘッダー内の構成要素（ロゴ、サイトタイトル、ナビゲーション、検索）の識別
- 固定ヘッダー、スティッキーヘッダーの判定（CSSプロパティ解析）
- ページヘッダー vs 記事ヘッダーの区別

#### 1.2 ロゴ・サイトタイトル検出

```typescript
function detectLogo(header: AriaNode): AriaNode | null;
function detectSiteTitle(header: AriaNode): string | null;
```

**実装内容：**

- ロゴ画像の検出（alt属性、クラス名パターン）
- サイトタイトルの抽出（h1、ブランド名を含むテキスト）

### Phase 2: ナビゲーション分類機能（v0.9.0）

#### 2.1 ナビゲーションタイプの分類（`src/detect/navigation.ts`）

```typescript
interface NavigationInfo {
  element: AriaNode;
  type: "global" | "local" | "breadcrumb" | "pagination" | "toc" | "social";
  location: "header" | "sidebar" | "footer" | "inline";
  items: NavigationItem[];
  structure: "flat" | "nested" | "dropdown";
}

interface NavigationItem {
  label: string;
  href?: string;
  level: number;
  children?: NavigationItem[];
  isCurrent?: boolean;
  isActive?: boolean;
}

function classifyNavigation(nav: AriaNode): NavigationInfo;
```

**実装内容：**

- グローバルナビゲーション：サイト全体のメインメニュー
- ローカルナビゲーション：セクション内のサブメニュー
- パンくずリスト：階層構造を示すナビゲーション
- ページネーション：ページ送りナビゲーション
- 目次（TOC）：ページ内リンクのナビゲーション
- ソーシャルリンク：SNSへのリンク集

#### 2.2 ナビゲーションパターン認識

```typescript
function detectNavigationPattern(element: AriaNode): NavigationPattern;
```

**パターン例：**

- メニューバー（`<ul>`/`<li>`構造）
- ドロップダウンメニュー（ネストされたリスト）
- ハンバーガーメニュー（モバイル用）
- タブナビゲーション
- サイドバーナビゲーション

### Phase 3: 統合API（v1.0.0）

#### 3.1 ページ構造解析API

```typescript
interface PageStructure {
  headers: HeaderInfo[];
  navigations: NavigationInfo[];
  mainContent: AriaNode;
  sidebar?: AriaNode;
  footer?: FooterInfo;
}

function analyzePageStructure(html: string, options?: AnalyzeOptions): PageStructure;
```

#### 3.2 使用例

```typescript
// ページ全体の構造解析
const structure = analyzePageStructure(html);

// ヘッダー情報の取得
const mainHeader = structure.headers.find((h) => h.type === "main");
const globalNav = mainHeader?.contains.navigation;

// ナビゲーション情報の取得
const breadcrumbs = structure.navigations.find((n) => n.type === "breadcrumb");
const toc = structure.navigations.find((n) => n.type === "toc");

// 本文とサイドバーの取得
const { mainContent, sidebar } = structure;
```

## 実装優先順位

1. **ヘッダー検出**（最優先）

   - Webページの基本構造理解に必要
   - ナビゲーション検出の前提となる

2. **グローバルナビゲーション検出**

   - 最も一般的なナビゲーションタイプ
   - ユーザビリティへの影響大

3. **パンくずリスト・TOC検出**

   - コンテンツの階層構造理解に有用
   - 記事系サイトで重要

4. **その他のナビゲーションタイプ**
   - ユースケースに応じて順次実装

## テスト計画

### ユニットテスト

- 各検出関数の個別テスト
- エッジケースの処理（ヘッダーなし、複数ヘッダー等）

### 統合テスト

- 実際のWebサイトでの検証
  - ニュースサイト
  - ブログ
  - ECサイト
  - ドキュメントサイト
  - SPAサイト

### パフォーマンステスト

- 大規模ページでの処理速度
- メモリ使用量の測定

## 技術的考慮事項

1. **視覚的情報の活用**

   - getBoundingClientRect相当の情報が必要
   - CSSプロパティ（position、z-index等）の解析

2. **セマンティックHTML優先**

   - HTML5セマンティック要素を優先的に利用
   - ARIAロールでの補完

3. **ヒューリスティックな判定**

   - クラス名パターン（header、nav、menu等）
   - 一般的なHTML構造パターンの認識

4. **国際化対応**
   - 多言語でのナビゲーションラベル認識
   - RTL（右から左）レイアウトの考慮

## 期待される成果

1. **構造化データの抽出**

   - ページ構造の完全な理解
   - セマンティックな要素分類

2. **アクセシビリティ向上**

   - スクリーンリーダー向けの構造情報提供
   - キーボードナビゲーションの改善

3. **応用可能性**
   - Webスクレイピングの精度向上
   - 自動テストでのナビゲーション要素特定
   - コンテンツ変換（モバイルビュー生成等）
