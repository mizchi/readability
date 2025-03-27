import type { VElement, Parser } from "../types.ts"; // VElement, Parser をインポート
import type { AriaTree } from "../nav/types.ts"; // AriaTree をインポート
import { PageType } from "../classify/types.ts"; // PageType をインポート (import type から変更)

// Readability result
export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  root: VElement | null; // メインコンテンツのルート要素 (閾値以上の場合)
  nodeCount: number;
  pageType: PageType;
  // 構造要素 (pageTypeがARTICLEだがrootがnullの場合などに設定される)
  header?: VElement | null;
  footer?: VElement | null;
  otherSignificantNodes?: VElement[];
  // 本文抽出に失敗した場合のフォールバックとしてのAriaツリー
  ariaTree?: AriaTree;
}

// 新しいインターフェース定義（pageTypeに応じたデータ構造）

// Article type result (pageType === ARTICLE)
export interface ArticleContent {
  title: string | null;
  byline: string | null;
  root: VElement | null; // メインコンテンツのルート要素
}

// Other type result (pageType === OTHER)
export interface OtherContent {
  title: string | null;
  header?: VElement | null;
  footer?: VElement | null;
  otherSignificantNodes?: VElement[];
  ariaTree?: AriaTree; // 圧縮済みのAriaTree
}

// pageTypeに応じたデータを取得する関数
export function getContentByPageType(
  result: ReadabilityArticle
): ArticleContent | OtherContent {
  if (result.pageType === PageType.ARTICLE) {
    // ARTICLEの場合、title, byline, rootを返す
    return {
      title: result.title,
      byline: result.byline,
      root: result.root,
    };
  } else {
    // OTHERの場合、ariaTree, otherSignificantNodes, header, footerを返す
    return {
      title: result.title,
      header: result.header,
      footer: result.footer,
      otherSignificantNodes: result.otherSignificantNodes,
      ariaTree: result.ariaTree,
    };
  }
}

// Readability options
export interface ReadabilityOptions {
  charThreshold?: number;
  nbTopCandidates?: number;
  parser?: Parser; // Optional custom HTML parser
  generateAriaTree?: boolean; // aria treeを生成するかどうか
  forcedPageType?: PageType; // 強制的に設定するページタイプ
  url?: string; // Add url property
}
