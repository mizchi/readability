import type { VElement } from "../types.ts"; // VElement をインポート

// AriaSnapshot関連の型定義
// Playwrightのaria snapshotを参考にした構造

// Ariaノードの種類
export type AriaNodeType =
  | "banner"
  | "complementary"
  | "contentinfo"
  | "form"
  | "main"
  | "navigation"
  | "region"
  | "search"
  | "article"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "dialog"
  | "figure"
  | "grid"
  | "gridcell"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listitem"
  | "menuitem"
  | "option"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "textbox"
  | "text"
  | "generic"; // その他のロール

// Ariaノードの基本構造
export interface AriaNode {
  type: AriaNodeType;
  name?: string; // アクセシブルな名前
  role?: string; // 明示的なARIAロール
  level?: number; // 見出しレベルなど
  checked?: boolean; // チェックボックスの状態
  selected?: boolean; // 選択状態
  expanded?: boolean; // 展開状態
  disabled?: boolean; // 無効状態
  required?: boolean; // 必須項目
  valuemin?: number; // 最小値
  valuemax?: number; // 最大値
  valuetext?: string; // 値のテキスト表現
  children?: AriaNode[]; // 子ノード
  originalElement?: WeakRef<VElement>; // 元のDOM要素への参照 (WeakRef)
}

// Ariaツリー全体の構造
export interface AriaTree {
  root: AriaNode;
  nodeCount: number;
}
