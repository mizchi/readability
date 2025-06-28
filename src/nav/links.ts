/**
 * Readability v3 - Navigation Links Utilities
 *
 * リンクの重みづけと優先順位付けのためのユーティリティ関数
 */

import type { AriaNode } from "../types.ts";

/**
 * ノードの深さを計算する
 */
export function getNodeDepth(node: AriaNode, currentDepth: number = 0): number {
  let maxDepth = currentDepth;
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const childDepth = getNodeDepth(child, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

/**
 * ノード内のリンク数をカウントする
 */
export function countLinks(node: AriaNode): number {
  let count = node.type === "link" ? 1 : 0;
  if (node.children) {
    for (const child of node.children) {
      count += countLinks(child);
    }
  }
  return count;
}

/**
 * ノードに重みを付ける
 * - 浅い階層ほど高い点数
 * - 同種のデータが並んでるとき、上から順に高い点数
 * - 同種のデータが並んでる時、保持している件数に応じて、その親に高い点数
 */
export function calculateNodeWeight(
  node: AriaNode,
  depth: number = 0,
  indexInParent: number = 0,
  siblingCount: number = 1
): number {
  // 基本重み: 深さが浅いほど高い点数（逆数的な関係）
  const depthWeight = 1 / (depth + 1);

  // 位置重み: 上にあるほど高い点数
  const positionWeight = siblingCount > 1 ? (siblingCount - indexInParent) / siblingCount : 1;

  // コンテンツ重み: リンク数や子ノード数に基づく重み
  const linkCount = countLinks(node);
  const childCount = node.children ? node.children.length : 0;
  const contentWeight = linkCount * 0.5 + childCount * 0.3;

  // タイプ重み: 特定のタイプは重要度が高い
  const importantTypes = ["main", "article", "navigation", "heading", "link", "list"];
  const typeWeight = importantTypes.includes(node.type) ? 1.5 : 1;

  // 名前の有無による重み
  const nameWeight = node.name ? 1.2 : 0.8;

  // 総合重み
  return (depthWeight * 3 + positionWeight * 2 + contentWeight + typeWeight + nameWeight) / 8;
}

/**
 * ツリー内のすべてのノードに重みを付ける
 */
export function assignWeightsToTree(
  node: AriaNode,
  depth: number = 0,
  indexInParent: number = 0,
  siblingCount: number = 1
): AriaNode & { weight?: number } {
  // 現在のノードに重みを付ける
  const weightedNode = {
    ...node,
    weight: calculateNodeWeight(node, depth, indexInParent, siblingCount),
  };

  // 子ノードがある場合、再帰的に処理
  if (node.children && node.children.length > 0) {
    const childrenCount = node.children.length;
    weightedNode.children = node.children.map((child, index) =>
      assignWeightsToTree(child, depth + 1, index, childrenCount)
    );
  }

  return weightedNode;
}

/**
 * 重み付けされたツリーから、指定された最大リンク数に基づいてノードをフィルタリングする
 */
export function filterNodesByWeight(
  node: AriaNode & { weight?: number },
  maxLinks: number,
  currentLinkCount: { count: number } = { count: 0 }
): AriaNode | null {
  // リンク数が上限に達した場合、それ以上のノードは処理しない
  if (currentLinkCount.count >= maxLinks) {
    return null;
  }

  // 現在のノードがリンクの場合、カウントを増やす
  if (node.type === "link") {
    currentLinkCount.count++;
  }

  // 子ノードがある場合、重み順にソートしてフィルタリング
  if (node.children && node.children.length > 0) {
    // 重み順にソート
    const sortedChildren = [...node.children].sort(
      (a, b) => ((b as any).weight || 0) - ((a as any).weight || 0)
    );

    // フィルタリングした子ノードを格納する配列
    const filteredChildren: AriaNode[] = [];

    // 各子ノードを処理
    for (const child of sortedChildren) {
      // 現在のリンク数が上限に達した場合、処理を中断
      if (currentLinkCount.count >= maxLinks) {
        break;
      }

      // 子ノードをフィルタリング
      const filteredChild = filterNodesByWeight(
        child as AriaNode & { weight?: number },
        maxLinks,
        currentLinkCount
      );

      // フィルタリングした結果がnullでない場合、配列に追加
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    // フィルタリングした子ノードがある場合、元のノードの子を置き換える
    if (filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    } else {
      // 子ノードがない場合、childrenプロパティを削除
      const { children, ...rest } = node;
      return rest;
    }
  }

  // 子ノードがない場合、そのまま返す
  return node;
}
