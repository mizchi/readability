/**
 * Readability v3 - ARIA Snapshot Utilities
 *
 * Utility functions for generating ARIA snapshots
 */

import type {
  VElement,
  VNode,
  VText,
  AriaNode,
  AriaNodeType,
  AriaTree,
  VDocument,
} from "./types.ts";
import { getAttribute, isProbablyVisible, getInnerText } from "./dom.ts";

/**
 * 要素のARIAロールを取得する
 * 明示的なrole属性、または暗黙的なロール（タグ名に基づく）を返す
 */
export function getAriaRole(element: VElement): string {
  // 明示的なrole属性を優先
  const explicitRole = getAttribute(element, "role");
  if (explicitRole) {
    return explicitRole.toLowerCase();
  }

  // タグ名に基づく暗黙的なロール
  const tagName = element.tagName.toLowerCase();

  // 一般的なHTML要素の暗黙的なロールのマッピング
  const implicitRoles: Record<string, string> = {
    a: element.attributes.href ? "link" : "generic",
    article: "article",
    aside: "complementary",
    button: "button",
    footer: "contentinfo",
    form: "form",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    header: "banner",
    img: "img",
    input: (() => {
      const type = (element.attributes.type || "text").toLowerCase();
      switch (type) {
        case "checkbox":
          return "checkbox";
        case "radio":
          return "radio";
        case "button":
          return "button";
        case "search":
          return "searchbox";
        default:
          return "textbox";
      }
    })(),
    li: "listitem",
    main: "main",
    nav: "navigation",
    ol: "list",
    option: "option",
    progress: "progressbar",
    section: "region",
    select: "combobox",
    table: "table",
    textarea: "textbox",
    ul: "list",
  };

  return implicitRoles[tagName] || "generic";
}

/**
 * 要素のアクセシブルな名前を取得する
 * aria-label、aria-labelledby、alt、title、テキストコンテンツなどから取得
 */
export function getAccessibleName(element: VElement): string | undefined {
  // aria-label属性を優先
  const ariaLabel = getAttribute(element, "aria-label");
  if (ariaLabel) {
    return ariaLabel;
  }

  // alt属性（画像など）
  const alt = getAttribute(element, "alt");
  if (alt && element.tagName === "img") {
    return alt;
  }

  // title属性
  const title = getAttribute(element, "title");
  if (title) {
    return title;
  }

  // 見出し要素、リンク、ボタンなどはテキストコンテンツを名前として使用
  const isNameFromContent = [
    "a",
    "button",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "label",
  ].includes(element.tagName);

  if (isNameFromContent) {
    const text = getInnerText(element);
    if (text) {
      // 長すぎる場合は切り詰める
      return text.length > 50 ? text.substring(0, 47) + "..." : text;
    }
  }

  // 特定のパターンを持つテキスト（例：見出しのようなテキスト）
  if (element.tagName === "p" || element.tagName === "div") {
    const text = getInnerText(element);
    if (text && text.length < 100) {
      return text;
    }
  }

  // 名前が見つからない場合はundefined
  return undefined;
}

/**
 * 要素のAriaNodeTypeを決定する
 */
export function getAriaNodeType(element: VElement): AriaNodeType {
  const role = getAriaRole(element);

  // roleに基づいてAriaNodeTypeを決定
  const roleToType: Record<string, AriaNodeType> = {
    banner: "banner",
    complementary: "complementary",
    contentinfo: "contentinfo",
    form: "form",
    main: "main",
    navigation: "navigation",
    region: "region",
    search: "search",
    article: "article",
    button: "button",
    cell: "cell",
    checkbox: "checkbox",
    columnheader: "columnheader",
    combobox: "combobox",
    dialog: "dialog",
    figure: "figure",
    grid: "grid",
    gridcell: "gridcell",
    heading: "heading",
    img: "img",
    link: "link",
    list: "list",
    listitem: "listitem",
    menuitem: "menuitem",
    option: "option",
    progressbar: "progressbar",
    radio: "radio",
    radiogroup: "radiogroup",
    row: "row",
    rowgroup: "rowgroup",
    rowheader: "rowheader",
    searchbox: "searchbox",
    separator: "separator",
    slider: "slider",
    spinbutton: "spinbutton",
    switch: "switch",
    tab: "tab",
    table: "table",
    tablist: "tablist",
    tabpanel: "tabpanel",
    textbox: "textbox",
  };

  // テキストノードの子を持つ要素で、他のロールがない場合はテキストとして扱う
  if (
    role === "generic" &&
    element.children.some((child) => child.nodeType === "text")
  ) {
    return "text";
  }

  return roleToType[role] || "generic";
}

/**
 * 要素からAriaNodeを構築する
 */
export function buildAriaNode(element: VElement): AriaNode {
  const type = getAriaNodeType(element);
  const name = getAccessibleName(element);
  const role = getAriaRole(element);

  // 基本的なAriaNode
  const node: AriaNode = {
    type,
    role,
    originalElement: element,
  };

  // 名前があれば追加
  if (name) {
    node.name = name;
  }

  // 見出しレベルを追加
  if (type === "heading") {
    const headingMatch = element.tagName.match(/h([1-6])/i);
    if (headingMatch) {
      node.level = parseInt(headingMatch[1], 10);
    }
  }

  // チェックボックスや選択状態
  if (type === "checkbox" || type === "radio") {
    node.checked =
      element.attributes.checked !== undefined ||
      getAttribute(element, "aria-checked") === "true";
  }

  if (type === "option" || type === "tab") {
    node.selected =
      element.attributes.selected !== undefined ||
      getAttribute(element, "aria-selected") === "true";
  }

  // 展開状態
  if (getAttribute(element, "aria-expanded") !== null) {
    node.expanded = getAttribute(element, "aria-expanded") === "true";
  }

  // 無効状態
  if (
    element.attributes.disabled !== undefined ||
    getAttribute(element, "aria-disabled") === "true"
  ) {
    node.disabled = true;
  }

  // 必須項目
  if (
    element.attributes.required !== undefined ||
    getAttribute(element, "aria-required") === "true"
  ) {
    node.required = true;
  }

  // 値の範囲（スライダーなど）
  const valuemin =
    getAttribute(element, "aria-valuemin") || element.attributes.min;
  if (valuemin) {
    node.valuemin = parseFloat(valuemin);
  }

  const valuemax =
    getAttribute(element, "aria-valuemax") || element.attributes.max;
  if (valuemax) {
    node.valuemax = parseFloat(valuemax);
  }

  const valuetext =
    getAttribute(element, "aria-valuetext") || element.attributes.value;
  if (valuetext) {
    node.valuetext = valuetext;
  }

  // 子ノードを再帰的に構築
  const childNodes: AriaNode[] = [];

  // 要素の子のみを処理
  for (const child of element.children) {
    if (child.nodeType === "element") {
      // 非表示要素はスキップ
      if (!isProbablyVisible(child)) {
        continue;
      }

      const childNode = buildAriaNode(child);
      // 意味のある子ノードのみ追加（名前がある、または特定のタイプ）
      if (
        childNode.name ||
        childNode.type !== "generic" ||
        (childNode.children && childNode.children.length > 0)
      ) {
        childNodes.push(childNode);
      }
    }
  }

  // 子ノードがあれば追加
  if (childNodes.length > 0) {
    node.children = childNodes;
  }

  return node;
}

/**
 * ドキュメントからAriaTreeを構築する
 */
export function buildAriaTree(doc: VDocument): AriaTree {
  // ドキュメントのbody要素からツリーを構築
  const rootNode = buildAriaNode(doc.body);

  // ツリーを圧縮
  const compressedRoot = compressAriaTree(rootNode);

  // ノード数をカウント
  const nodeCount = countNodes(compressedRoot);

  return {
    root: compressedRoot,
    nodeCount,
  };
}

/**
 * AriaTreeを圧縮する
 * - 意味のあるノードだけを残す
 * - 子を一つしか持たないtextの入れ子をたたむ
 * - 連続するtextを一つにまとめる
 */
export function compressAriaTree(node: AriaNode): AriaNode {
  // 子ノードがない場合はそのまま返す
  if (!node.children || node.children.length === 0) {
    return node;
  }

  // 子ノードを圧縮
  let compressedChildren: AriaNode[] = [];

  // 連続するtextノードをマージするための変数
  let currentTextNode: AriaNode | null = null;

  for (const child of node.children) {
    // 子ノードを再帰的に圧縮
    const compressedChild = compressAriaTree(child);

    // 意味のないノードはスキップ
    if (isInsignificantNode(compressedChild)) {
      continue;
    }

    // textノードの場合
    if (compressedChild.type === "text") {
      // 前のノードもtextの場合はマージ
      if (currentTextNode && currentTextNode.type === "text") {
        // 名前をマージ
        if (compressedChild.name) {
          currentTextNode.name = currentTextNode.name
            ? `${currentTextNode.name} ${compressedChild.name}`
            : compressedChild.name;
        }

        // 子ノードがあれば追加
        if (compressedChild.children && compressedChild.children.length > 0) {
          currentTextNode.children = currentTextNode.children || [];
          currentTextNode.children.push(...compressedChild.children);
        }
      } else {
        // 新しいtextノードとして追加
        currentTextNode = compressedChild;
        compressedChildren.push(currentTextNode);
      }
    } else {
      // text以外のノードはそのまま追加
      currentTextNode = null;
      compressedChildren.push(compressedChild);
    }
  }

  // 子ノードを一つしか持たないtextの入れ子をたたむ
  compressedChildren = compressedChildren.map((child) => {
    if (
      child.type === "text" &&
      child.children &&
      child.children.length === 1
    ) {
      const grandchild = child.children[0];
      // 孫ノードの名前を親ノードにマージ
      if (grandchild.name) {
        child.name = child.name
          ? `${child.name} ${grandchild.name}`
          : grandchild.name;
      }
      // 孫ノードの子を親ノードに移動
      if (grandchild.children && grandchild.children.length > 0) {
        child.children = grandchild.children;
      } else {
        delete child.children;
      }
    }
    return child;
  });

  // 圧縮した子ノードを設定
  const result = { ...node };
  if (compressedChildren.length > 0) {
    result.children = compressedChildren;
  } else {
    delete result.children;
  }

  return result;
}

/**
 * ノードが意味のないノードかどうかを判定する
 */
function isInsignificantNode(node: AriaNode): boolean {
  // 名前がなく、特定のタイプでもなく、子ノードもない場合は意味がない
  return (
    !node.name &&
    node.type === "generic" &&
    (!node.children || node.children.length === 0)
  );
}

/**
 * ノード数をカウント
 */
function countNodes(node: AriaNode): number {
  let count = 1; // 自身をカウント
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * AriaTreeをYAML形式の文字列に変換する（Playwrightのスナップショット形式に近い）
 */
export function ariaTreeToString(tree: AriaTree): string {
  const nodeToString = (node: AriaNode, indent: number = 0): string => {
    const indentStr = "  ".repeat(indent);
    let result = "";

    // ノードのタイプと名前を出力
    result += `${indentStr}- ${node.type}`;

    // 名前があれば追加
    if (node.name) {
      // 名前に正規表現パターンが含まれているかチェック
      if (node.name.startsWith("/") && node.name.endsWith("/")) {
        result += ` ${node.name}`;
      } else {
        result += ` "${node.name}"`;
      }
    }

    // 見出しレベルがあれば追加
    if (node.level) {
      result += ` [level=${node.level}]`;
    }

    // チェック状態があれば追加
    if (node.checked !== undefined) {
      result += ` [checked=${node.checked}]`;
    }

    // 選択状態があれば追加
    if (node.selected !== undefined) {
      result += ` [selected=${node.selected}]`;
    }

    // 展開状態があれば追加
    if (node.expanded !== undefined) {
      result += ` [expanded=${node.expanded}]`;
    }

    // 無効状態があれば追加
    if (node.disabled) {
      result += " [disabled]";
    }

    // 必須項目であれば追加
    if (node.required) {
      result += " [required]";
    }

    // 値の範囲があれば追加
    if (node.valuemin !== undefined || node.valuemax !== undefined) {
      const min = node.valuemin !== undefined ? node.valuemin : "";
      const max = node.valuemax !== undefined ? node.valuemax : "";
      result += ` [range=${min}-${max}]`;
    }

    // 値のテキスト表現があれば追加
    if (node.valuetext) {
      result += ` [value="${node.valuetext}"]`;
    }

    result += "\n";

    // 子ノードを再帰的に処理
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        result += nodeToString(child, indent + 1);
      }
    }

    return result;
  };

  return nodeToString(tree.root);
}
