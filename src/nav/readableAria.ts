/**
 * Readability v3 - Readable ARIA Tree Utilities
 *
 * Functions for building and formatting a simplified, readable ARIA tree.
 */

import type {
  VElement,
  AriaNode,
  AriaNodeType,
  AriaTree,
  VDocument,
} from "../types.ts";
import { getAttribute, isProbablyVisible, getInnerText } from "../dom.ts";
import {
  getAriaRole,
  getAccessibleName,
  getAriaNodeType,
  buildAriaNode as buildBaseAriaNode, // Rename to avoid conflict
} from "./aria.ts";
import {
  getNodeDepth,
  countLinks,
  assignWeightsToTree,
  filterNodesByWeight,
} from "./links.ts";

/**
 * ドキュメントからAriaTreeを構築する
 */
export function buildAriaTree(doc: VDocument): AriaTree {
  // ドキュメントのbody要素からツリーを構築
  const rootNode = buildBaseAriaNode(doc.body); // Use renamed function

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

// Helper function to compact the AriaTree (内部ヘルパー)
function toCompact(node: AriaNode): AriaNode {
  // Helper function to determine if a node is insignificant
  function isInsignificantNode(node: AriaNode): boolean {
    // 名前がなく、特定のタイプでもなく、子ノードもない場合は意味がない
    return (
      !node.name &&
      node.type === "generic" &&
      (!node.children || node.children.length === 0)
    );
  }

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
    .map((child) => toCompact(child)) // Call toCompact recursively
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
 * AriaTreeを圧縮する (内部ヘルパー)
 * - 意味のあるノードだけを残す
 * - 同じタイプの入れ子をたたむ（特にtextの入れ子）
 * - 連続するtextを一つにまとめる
 * - 空のtextノードを削除
 * - textの下がgenericのみの場合、親textにマージ
 * - 同じタイプのノードを配列化
 */
function compressAriaTree(node: AriaNode): AriaNode {
  return toCompact(node);
}

/**
 * ノード数をカウント (内部ヘルパー)
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
 * AriaTreeを読みやすいYAML形式の文字列に変換する（Playwrightのスナップショット形式を参考）
 * @param doc VDocument オブジェクト
 * @param maxLinks 最大表示リンク数（デフォルト: 60）
 */
export function toReadableAriaTree(
  doc: VDocument,
  maxLinks: number = 60
): string {
  // AriaTreeを構築
  const tree = buildAriaTree(doc);

  // ツリーの最大深さを計算
  const maxDepth = getNodeDepth(tree.root);

  // ツリー内のリンク総数をカウント
  const totalLinks = countLinks(tree.root);

  // リンク数が上限を超える場合のみ、重み付けとフィルタリングを行う
  let processedRoot: AriaNode;
  if (totalLinks > maxLinks) {
    // ツリーに重みを付ける
    const weightedRoot = assignWeightsToTree(tree.root);

    // 重み付けされたツリーをフィルタリング
    processedRoot = filterNodesByWeight(weightedRoot, maxLinks) || tree.root;
  } else {
    processedRoot = tree.root;
  }

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
    const originalElement = node.originalElement?.deref();
    if (originalElement) {
      if (node.type === "link") {
        href = originalElement.attributes.href || "";
      } else if (node.type === "img") {
        src = originalElement.attributes.src || "";
        alt = originalElement.attributes.alt || "";
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

  // 元のツリーのルートではなく、処理済みのルートを使用
  const result = nodeToString(processedRoot);

  // リンク数が上限を超えた場合、フィルタリングされたことを示す情報を追加
  if (totalLinks > maxLinks) {
    return `# 注: 元のツリーには${totalLinks}個のリンクがありましたが、上限(${maxLinks})に基づいてフィルタリングされています\n${result}`;
  }

  return result;
}

/**
 * AriaTreeをYAML形式の文字列に変換する（Playwrightのスナップショット形式に準拠）
 * @param tree AriaTree オブジェクト
 * @param maxLinks 最大表示リンク数（デフォルト: 60）
 */
export function ariaTreeToString(
  tree: AriaTree,
  maxLinks: number = 60
): string {
  // ツリー内のリンク総数をカウント
  const totalLinks = countLinks(tree.root);

  // リンク数が上限を超える場合のみ、重み付けとフィルタリングを行う
  let processedRoot: AriaNode;
  if (totalLinks > maxLinks) {
    // ツリーに重みを付ける
    const weightedRoot = assignWeightsToTree(tree.root);

    // 重み付けされたツリーをフィルタリング
    processedRoot = filterNodesByWeight(weightedRoot, maxLinks) || tree.root;
  } else {
    processedRoot = tree.root;
  }

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
    const originalElement = node.originalElement?.deref();
    if (originalElement) {
      if (node.type === "link") {
        href = originalElement.attributes.href || "";
      } else if (node.type === "img") {
        src = originalElement.attributes.src || "";
        alt = originalElement.attributes.alt || "";
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

  // 元のツリーのルートではなく、処理済みのルートを使用
  const result = nodeToString(processedRoot);

  // リンク数が上限を超えた場合、フィルタリングされたことを示す情報を追加
  if (totalLinks > maxLinks) {
    return `# 注: 元のツリーには${totalLinks}個のリンクがありましたが、上限(${maxLinks})に基づいてフィルタリングされています\n${result}`;
  }

  return result;
}
