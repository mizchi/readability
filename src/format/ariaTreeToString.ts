import type { AriaTree, AriaNode } from "../types";
import {
  countLinks,
  assignWeightsToTree,
  filterNodesByWeight,
} from "../nav/links";

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
