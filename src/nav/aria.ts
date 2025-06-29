/**
 * Readability v3 - ARIA Snapshot Utilities
 *
 * Utility functions for generating ARIA snapshots
 */

import type { VElement, VNode, VText } from "../types.ts";
import type { AriaNodeType } from "./types.ts";
export type { AriaNode } from "./types.ts";
import { getAttribute, isProbablyVisible, getInnerText } from "../dom.ts";

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
    body: "generic",
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

  // 見出し要素、リンク、ボタン、リストアイテムなどはテキストコンテンツを名前として使用
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
    "li",
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
  if (role === "generic" && element.children.some((child) => child.type === "text")) {
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
    originalElement: new WeakRef(element), // Use WeakRef
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
      element.attributes.checked !== undefined || getAttribute(element, "aria-checked") === "true";
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
  const valuemin = getAttribute(element, "aria-valuemin") || element.attributes.min;
  if (valuemin) {
    node.valuemin = parseFloat(valuemin);
  }

  const valuemax = getAttribute(element, "aria-valuemax") || element.attributes.max;
  if (valuemax) {
    node.valuemax = parseFloat(valuemax);
  }

  const valuetext = getAttribute(element, "aria-valuetext") || element.attributes.value;
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
