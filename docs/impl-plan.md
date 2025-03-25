# Readability 実装計画

## 1. 概要

Readabilityは、ウェブページから本文コンテンツを抽出するライブラリです。元々はArc90によって開発され、現在はMozillaのFirefox
Reader
Viewで使用されています。このドキュメントでは、DOM依存のない実装を目指すための計画を概説します。

## 2. 基本仕様

Readabilityは以下の主要機能を提供します：

### 2.1 メタデータ抽出

- タイトル（複数のソースから最適なものを選択）
- 著者情報（byline）
- 記事の概要（excerpt）
- サイト名
- 公開日時

### 2.2 本文コンテンツ抽出

- 不要な要素（広告、ナビゲーション、フッターなど）を除去
- 本文と思われる部分を特定
- 関連コンテンツの結合

### 2.3 コンテンツの整形

- 不要なスタイルの除去
- リンクの絶対URLへの変換
- 画像の修正（遅延読み込み対応など）

## 3. 本質的な部分

### 3.1 メタデータ抽出の本質

メタデータ抽出は以下の優先順位で行われます：

1. **JSON-LD**（Schema.orgのメタデータ）
2. **メタタグ**（OpenGraph, Twitter Cards, Dublin Core等）
3. **HTML構造からの推測**（title要素、h1要素など）

特に重要なのは：

- 複数のソースから最適なタイトルを選択するロジック
- 著者情報を特定するためのパターンマッチング
- 記事の概要を抽出または生成する機能

### 3.2 本文抽出の本質

本文抽出のコアアルゴリズムは以下の要素に基づいています：

#### 3.2.1 コンテンツスコアリング

```javascript
// 基本スコア
contentScore += 1;
// カンマの数に基づくスコア
contentScore += innerText.split(REGEXPS.commas).length;
// テキスト長に基づくスコア（100文字ごとに1点、最大3点）
contentScore += Math.min(Math.floor(innerText.length / 100), 3);
```

#### 3.2.2 要素の初期スコア（タグに基づく）

```javascript
switch (node.tagName) {
  case "DIV":
    score += 5;
    break;
  case "PRE":
  case "TD":
  case "BLOCKQUOTE":
    score += 3;
    break;
  // ネガティブスコア
  case "H1": // ... その他見出し
  case "FORM":
    score -= 3;
    break;
}
```

#### 3.2.3 クラス名とIDによる調整

```javascript
// ポジティブパターン（article, content, main等）
if (REGEXPS.positive.test(className)) weight += 25;
// ネガティブパターン（comment, sidebar, footer等）
if (REGEXPS.negative.test(className)) weight -= 25;
```

#### 3.2.4 リンク密度による調整

```javascript
// リンク密度が高いほどスコアが下がる
var candidateScore = contentScore * (1 - getLinkDensity(candidate));
```

#### 3.2.5 候補選定と兄弟ノードの追加

- トップ候補の選定
- 親ノードへの遡上（より良い候補を探す）
- 兄弟ノードの追加（関連コンテンツの取り込み）

### 3.3 本文抽出の判断基準

本文抽出の判断基準として特に重要なのは：

1. **テキスト密度**：テキスト量と要素の比率
2. **リンク密度**：テキスト全体に対するリンクテキストの比率
3. **コンマの数**：文章の複雑さの指標
4. **クラス名とID**：開発者が付けた意味的なヒント
5. **要素の階層関係**：親子関係や兄弟関係

## 4. 実装方針

本質的な部分を抽出した新しい実装では、以下の方針を採用します：

### 4.1 メタデータ抽出

`metadata.ts`の機能を維持しつつ、優先順位を明確にした統合ロジックを実装します：

```typescript
function getArticleMetadata(doc: VDocument): ReadabilityMetadata {
  // 1. JSON-LDからのメタデータ抽出
  const jsonLdMetadata = getJSONLD(doc);

  // 2. メタタグからのメタデータ抽出
  const metaTagMetadata = getMetaTagMetadata(doc);

  // 3. HTML構造からのメタデータ抽出
  const htmlMetadata = getHTMLMetadata(doc);

  // 4. 優先順位に基づいて統合
  return {
    title: jsonLdMetadata.title || metaTagMetadata.title ||
      htmlMetadata.title || null,
    byline: jsonLdMetadata.byline || metaTagMetadata.byline ||
      htmlMetadata.byline || null,
    // その他のメタデータ...
  };
}
```

### 4.2 本文抽出

テキスト密度とリンク密度を中心としたスコアリングを実装します：

#### 4.2.1 テキスト密度の計算

```typescript
function getTextDensity(element: VElement): number {
  const text = getInnerText(element);
  const textLength = text.length;
  if (textLength === 0) return 0;

  // 文字数 / 要素数 = 密度
  const childElements = getAllElements(element);
  return textLength / (childElements.length || 1);
}
```

#### 4.2.2 リンク密度の計算

```typescript
function getLinkDensity(element: VElement): number {
  const text = getInnerText(element);
  const textLength = text.length;
  if (textLength === 0) return 0;

  let linkLength = 0;
  const links = getElementsByTagName(element, "a");

  for (const link of links) {
    // 内部リンク（#で始まるもの）は重みを下げる
    const href = getAttribute(link, "href");
    const coefficient = href && href.startsWith("#") ? 0.3 : 1;
    linkLength += getInnerText(link).length * coefficient;
  }

  return linkLength / textLength;
}
```

#### 4.2.3 スコアリングアルゴリズム

```typescript
function scoreNode(node: VElement): number {
  let score = 0;

  // 1. タグに基づく基本スコア
  const tagScores: Record<string, number> = {
    "DIV": 5,
    "P": 5,
    "BLOCKQUOTE": 3,
    "PRE": 3,
    "TD": 3,
    "H1": -5,
    "H2": -5,
    // その他のタグ...
  };
  score += tagScores[node.tagName] || 0;

  // 2. クラス名とIDに基づくスコア
  score += getClassWeight(node);

  // 3. テキスト内容に基づくスコア
  const text = getInnerText(node);
  score += Math.min(Math.floor(text.length / 100), 3);
  score += text.split(",").length;

  // 4. リンク密度に基づく調整
  score *= 1 - getLinkDensity(node);

  return score;
}
```

### 4.3 セマンティックHTML5タグの活用

HTML5のセマンティックタグを優先的に使用します：

```typescript
function findArticleNode(doc: VDocument): VElement | null {
  // 1. まずセマンティックタグを探す
  const semanticTags = ["ARTICLE", "MAIN"];
  for (const tag of semanticTags) {
    const elements = getElementsByTagName(doc.documentElement, tag);
    if (elements.length === 1) {
      return elements[0];
    }
  }

  // 2. セマンティックタグがない場合は従来のスコアリングを使用
  // ...

  return null;
}
```

### 4.4 文脈理解の強化

段落間の関連性や見出しと本文の関係性を分析します：

```typescript
function analyzeContext(nodes: VElement[]): void {
  // 見出しの下にある段落は関連性が高い
  for (let i = 0; i < nodes.length; i++) {
    if (isHeading(nodes[i]) && i + 1 < nodes.length) {
      if (nodes[i + 1].readability) {
        nodes[i + 1].readability.contentScore += 5; // 見出しの直後の段落にボーナス
      }
    }
  }

  // 連続する段落は関連性が高い
  let consecutiveParagraphs = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].tagName === "P") {
      consecutiveParagraphs++;
      if (consecutiveParagraphs > 1 && nodes[i].readability) {
        nodes[i].readability.contentScore += consecutiveParagraphs - 1; // 連続する段落にボーナス
      }
    } else {
      consecutiveParagraphs = 0;
    }
  }
}
```

## 5. モジュール構造

新しい実装では、以下のモジュール構造を採用します：

### 5.1 コアモジュール

- `v2/readability/index.ts`: メインエントリーポイント
- `v2/readability/metadata.ts`: メタデータ抽出
- `v2/readability/scorer.ts`: 要素のスコアリングロジック
- `v2/readability/extractor.ts`: 本文抽出のコアロジック
- `v2/readability/postprocessor.ts`: 抽出後の整形処理

### 5.2 ユーティリティモジュール

- `v2/vdom.ts`: 仮想DOMの実装
- `v2/html_parser.ts`: HTML解析
- `v2/constants.ts`: 定数定義
- `v2/types.ts`: 型定義

### 5.3 テストモジュール

- `v2/test/`: テストケース

## 6. 実装の優先順位

1. 仮想DOM（VDOM）の実装
2. HTMLパーサーの実装
3. メタデータ抽出の実装
4. 本文抽出の実装
5. 後処理の実装
6. テストケースの作成

## 7. パフォーマンス考慮事項

- 大きなドキュメントの処理時間を最適化
- メモリ使用量の最適化
- 再帰的な処理の最適化

## 8. 今後の拡張可能性

- 多言語対応の強化
- 画像の最適化
- 読みやすさの向上のための追加機能
