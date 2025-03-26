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
  let compressedRoot = compressAriaTree(rootNode);

  // ルートレベルでの入れ子も解消
  // ルートがtextで、子がある場合、意味のある子を直接ルートにする
  if (
    compressedRoot.type === "text" &&
    compressedRoot.children &&
    compressedRoot.children.length > 0
  ) {
    // 意味のある子ノードを探す（main, article, sectionなど）
    const significantChild = compressedRoot.children.find((child) =>
      [
        "main",
        "article",
        "section",
        "navigation",
        "banner",
        "contentinfo",
      ].includes(child.type)
    );

    // 意味のある子ノードがあれば、それをルートにする
    if (significantChild) {
      // 元のルートの名前を子ノードにマージ（必要な場合）
      if (compressedRoot.name && !significantChild.name) {
        significantChild.name = compressedRoot.name;
      }

      compressedRoot = significantChild;
    }
    // 意味のある子ノードがなく、子が1つだけの場合
    else if (compressedRoot.children.length === 1) {
      const child = compressedRoot.children[0];

      // 子の名前をマージ
      if (child.name) {
        compressedRoot.name = compressedRoot.name
          ? `${compressedRoot.name} ${child.name}`
          : child.name;
      }

      // 子の子をルートに移動
      if (child.children && child.children.length > 0) {
        compressedRoot.children = child.children;
      } else {
        delete compressedRoot.children;
      }
    }
  }

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
 * - 同じタイプの入れ子をたたむ（特にtextの入れ子）
 * - 連続するtextを一つにまとめる
 * - 空のtextノードを削除
 * - textの下がgenericのみの場合、親textにマージ
 * - 同じタイプのノードを配列化
 */
export function compressAriaTree(node: AriaNode): AriaNode {
  // 子ノードがない場合はそのまま返す
  if (!node.children || node.children.length === 0) {
    // 要件1: textの中身が空のとき、これを削除
    if (node.type === "text" && (!node.name || node.name.trim() === "")) {
      return {
        type: "generic",
        role: "generic",
        originalElement: node.originalElement,
      };
    }
    return node;
  }

  // まず、子ノードを再帰的に圧縮
  const processedChildren = node.children
    .map((child) => compressAriaTree(child))
    .filter((child) => !isInsignificantNode(child))
    // 要件1: textの中身が空のノードを削除
    .filter(
      (child) =>
        !(child.type === "text" && (!child.name || child.name.trim() === ""))
    );

  // 特殊ケース: textノードが意味のあるノードを1つだけ含む場合、そのノードを直接返す
  if (node.type === "text" && processedChildren.length === 1) {
    const significantChild = processedChildren[0];
    const significantTypes = [
      "main",
      "article",
      "section",
      "navigation",
      "banner",
      "contentinfo",
    ];

    if (significantTypes.includes(significantChild.type)) {
      // 親の名前を子にマージ（必要な場合）
      if (node.name && !significantChild.name) {
        significantChild.name = node.name;
      }
      return significantChild;
    }
  }

  // 要件2: textの下がgenericのみの場合、親textにマージ
  if (
    node.type === "text" &&
    processedChildren.length > 0 &&
    processedChildren.every((child) => child.type === "generic")
  ) {
    // genericの子を持つtextノードの場合、子ノードの子をすべて自分の子にする
    const newChildren: AriaNode[] = [];
    for (const child of processedChildren) {
      if (child.children && child.children.length > 0) {
        newChildren.push(...child.children);
      }
    }
    if (newChildren.length > 0) {
      return { ...node, children: newChildren };
    }
  }

  // 一般ケース: 子要素が1つしかない場合、親にマージ
  if (processedChildren.length === 1) {
    const child = processedChildren[0];

    // 親がgenericで名前がない場合、または親と子が同じタイプの場合
    if ((node.type === "generic" && !node.name) || node.type === child.type) {
      // 親の名前を子にマージ（必要な場合）
      if (node.name && !child.name) {
        child.name = node.name;
      } else if (node.name && child.name) {
        // 両方に名前がある場合は結合
        child.name = `${node.name} ${child.name}`;
      }
      return child;
    }
  }

  // 意味のある階層かどうかを判定
  const isSignificantNode = [
    "main",
    "article",
    "section",
    "navigation",
    "banner",
    "contentinfo",
    "region",
    "form",
    "search",
  ].includes(node.type);

  // 子要素がすべてgenericの場合、または意味のある階層の下にgenericがある場合、親にマージ
  if (
    processedChildren.length > 0 &&
    (processedChildren.every((child) => child.type === "generic") ||
      (isSignificantNode &&
        processedChildren.some((child) => child.type === "generic")))
  ) {
    // genericの子を持つノードの場合、子ノードの子をすべて自分の子にする
    const newChildren: AriaNode[] = [];

    for (const child of processedChildren) {
      if (child.type === "generic") {
        // genericノードの子を直接追加
        if (child.children && child.children.length > 0) {
          newChildren.push(...child.children);
        }
      } else {
        // generic以外のノードはそのまま追加
        newChildren.push(child);
      }
    }

    if (newChildren.length > 0) {
      return { ...node, children: newChildren };
    }
  }

  // 同じタイプの連続するノードをマージする
  const mergedChildren: AriaNode[] = [];
  let currentGroup: AriaNode | null = null;

  // 要件3: 同じ属性のノードを配列化するための処理
  const groupByType: Record<string, AriaNode[]> = {};

  for (const child of processedChildren) {
    // 特定のタイプのノードをグループ化
    if (["article", "section", "listitem", "img"].includes(child.type)) {
      if (!groupByType[child.type]) {
        groupByType[child.type] = [];
      }
      groupByType[child.type].push(child);
      continue;
    }

    // 現在のグループがない、または現在のグループと異なるタイプの場合
    if (!currentGroup || currentGroup.type !== child.type) {
      // 新しいグループを開始
      currentGroup = { ...child };
      mergedChildren.push(currentGroup);
      continue;
    }

    // 同じタイプのノードを見つけた場合、マージする
    // 名前をマージ
    if (child.name) {
      currentGroup.name = currentGroup.name
        ? `${currentGroup.name} ${child.name}`
        : child.name;
    }

    // 子ノードをマージ
    if (child.children && child.children.length > 0) {
      if (!currentGroup.children) {
        currentGroup.children = [];
      }
      currentGroup.children.push(...child.children);
    }
  }

  // グループ化したノードを追加
  for (const type in groupByType) {
    if (groupByType[type].length > 1) {
      // 同じタイプのノードが複数ある場合、親ノードを作成してそれらを子として追加
      const parentNode: AriaNode = {
        type: type as AriaNodeType,
        role: type,
        originalElement: node.originalElement,
        children: groupByType[type],
      };
      mergedChildren.push(parentNode);
    } else if (groupByType[type].length === 1) {
      // 1つしかない場合はそのまま追加
      mergedChildren.push(groupByType[type][0]);
    }
  }

  // 入れ子構造を解消する
  for (let i = 0; i < mergedChildren.length; i++) {
    const child = mergedChildren[i];

    // 子を一つしか持たないノードの入れ子をたたむ
    if (child.children && child.children.length === 1) {
      const grandchild = child.children[0];

      // 親と子が同じタイプの場合、または親がtextで子が意味のあるノードの場合、マージする
      if (
        child.type === grandchild.type ||
        (child.type === "text" &&
          ["main", "article", "section"].includes(grandchild.type))
      ) {
        // 孫ノードの名前を親ノードにマージ
        if (grandchild.name) {
          child.name = child.name
            ? `${child.name} ${grandchild.name}`
            : grandchild.name;
        }

        // 孫ノードの子を親ノードに移動
        if (grandchild.children && grandchild.children.length > 0) {
          child.children = grandchild.children;
          // 再度このノードを処理するために、インデックスを戻す
          i--;
          continue;
        } else {
          delete child.children;
        }
      }
    }

    // 子ノードが複数あり、その中に親と同じタイプのノードがある場合
    if (child.children && child.children.length > 1) {
      const sameTypeChildren = child.children.filter(
        (c) => c.type === child.type
      );

      if (sameTypeChildren.length > 0) {
        // 同じタイプの子ノードの内容を親にマージし、それらを削除
        const otherChildren = child.children.filter(
          (c) => c.type !== child.type
        );
        const newChildren: AriaNode[] = [];

        // 同じタイプの子ノードの名前をマージ
        for (const sameChild of sameTypeChildren) {
          if (sameChild.name) {
            child.name = child.name
              ? `${child.name} ${sameChild.name}`
              : sameChild.name;
          }

          // 同じタイプの子ノードの子を新しい子リストに追加
          if (sameChild.children && sameChild.children.length > 0) {
            newChildren.push(...sameChild.children);
          }
        }

        // 異なるタイプの子ノードを新しい子リストに追加
        newChildren.push(...otherChildren);

        // 新しい子リストを設定
        child.children = newChildren;

        // 再度このノードを処理するために、インデックスを戻す
        i--;
        continue;
      }
    }
  }

  // 圧縮した子ノードを設定
  const result = { ...node };
  if (mergedChildren.length > 0) {
    result.children = mergedChildren;
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
 * AriaTreeをYAML形式の文字列に変換する（Playwrightのスナップショット形式に準拠）
 */
export function ariaTreeToString(tree: AriaTree): string {
  const nodeToString = (node: AriaNode, indent: number = 0): string => {
    const indentStr = "  ".repeat(indent);
    let result = "";

    // 空のノードはスキップ
    if (
      // 名前がなく、子ノードもない汎用ノード
      (!node.name && !node.children && node.type === "generic") ||
      // 名前が空文字列
      node.name === "" ||
      // 空のリスト（子ノードがない、または空の子ノードしかない）
      (node.type === "list" &&
        (!node.children ||
          node.children.length === 0 ||
          node.children.every(
            (child) =>
              !child.name && (!child.children || child.children.length === 0)
          )))
    ) {
      return "";
    }

    // ノードのタイプを出力
    result += `${indentStr}- ${node.type}`;

    // リンクの場合、href属性を取得、画像の場合はsrc属性とalt属性を取得
    let href = "";
    let src = "";
    let alt = "";
    if (node.originalElement) {
      if (node.type === "link") {
        href = node.originalElement.attributes.href || "";
      } else if (node.type === "img") {
        src = node.originalElement.attributes.src || "";
        alt = node.originalElement.attributes.alt || "";
      }
    }

    // 名前があれば追加（Playwrightの2つの形式に対応）
    if (node.name) {
      // 名前に正規表現パターンが含まれているかチェック
      if (node.name.startsWith("/") && node.name.endsWith("/")) {
        // 正規表現パターンはそのまま表示
        result += ` ${node.name}`;
      } else if (
        // テキストノードやパラグラフなど、一部のノードタイプはコロン形式で表示
        ["text", "paragraph", "listitem", "textbox"].includes(node.type)
      ) {
        // コロン形式（role: name）
        result += `: ${node.name}`;
      } else {
        // 引用符形式（role "name"）
        result += ` "${node.name}"`;
      }
    }

    // リンクのhrefや画像のsrcとaltを表示
    if (href) {
      result += ` [href="${href}"]`;
    }
    if (src) {
      result += ` [src="${src}"]`;
    }
    if (alt) {
      result += ` [alt="${alt}"]`;
    }

    // 属性を追加
    const attributes: string[] = [];

    // 見出しレベル
    if (node.level) {
      attributes.push(`level=${node.level}`);
    }

    // チェック状態
    if (node.checked !== undefined) {
      attributes.push(`checked=${node.checked}`);
    }

    // 選択状態
    if (node.selected !== undefined) {
      attributes.push(`selected=${node.selected}`);
    }

    // 展開状態
    if (node.expanded !== undefined) {
      attributes.push(`expanded=${node.expanded}`);
    }

    // 無効状態
    if (node.disabled) {
      attributes.push("disabled");
    }

    // 必須項目
    if (node.required) {
      attributes.push("required");
    }

    // 値の範囲
    if (node.valuemin !== undefined || node.valuemax !== undefined) {
      const min = node.valuemin !== undefined ? node.valuemin : "";
      const max = node.valuemax !== undefined ? node.valuemax : "";
      attributes.push(`range=${min}-${max}`);
    }

    // 値のテキスト表現
    if (node.valuetext) {
      attributes.push(`value="${node.valuetext}"`);
    }

    // 属性があれば追加
    if (attributes.length > 0) {
      result += ` [${attributes.join(", ")}]`;
    }

    result += "\n";

    // 子ノードを再帰的に処理
    if (node.children && node.children.length > 0) {
      // 子が1つだけで、親と同じタイプの場合は特別な形式で表示
      if (
        node.children.length === 1 &&
        node.children[0].type === node.type &&
        node.type !== "generic"
      ) {
        const child = node.children[0];
        // 親の名前と子の名前を結合
        const combinedName =
          node.name && child.name
            ? `${node.name} ${child.name}`
            : node.name || child.name || "";

        // 一時的に名前を変更して出力
        const tempNode = { ...node, name: combinedName };
        if (child.children && child.children.length > 0) {
          tempNode.children = child.children;
        } else {
          delete tempNode.children;
        }

        // 再帰的に処理
        return nodeToString(tempNode, indent);
      }

      // 通常の子ノード処理
      for (const child of node.children) {
        const childString = nodeToString(child, indent + 1);
        if (childString) {
          result += childString;
        }
      }
    }

    return result;
  };

  return nodeToString(tree.root);
}
