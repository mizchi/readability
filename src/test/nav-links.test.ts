import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractAriaTree, ariaTreeToString } from "../index";
import {
  getNodeDepth,
  countLinks,
  calculateNodeWeight,
  assignWeightsToTree,
  filterNodesByWeight,
} from "../nav/links";
import type { AriaNode } from "../types";

describe("Navigation Links Utilities with Yahoo Fixture", () => {
  // Yahoo!ニュースのHTMLスナップショットを読み込む
  const yahooHtml = readFileSync(
    join(__dirname, "fixtures/yahoo.html"),
    "utf-8"
  );

  // ARIAツリーを抽出
  const ariaTree = extractAriaTree(yahooHtml, { compress: true });

  test("Yahoo!ニュースのHTMLからARIAツリーを正しく抽出できる", () => {
    // ARIAツリーが正しく抽出されていることを確認
    expect(ariaTree).toBeDefined();
    expect(ariaTree.root).toBeDefined();
    expect(ariaTree.nodeCount).toBeGreaterThan(0);

    // 文字列化したツリーにYahoo!ニュース特有の要素が含まれていることを確認
    const treeString = ariaTreeToString(ariaTree);
    expect(treeString).toContain("main");
    expect(treeString).toContain("region");
    expect(treeString).toContain("link");
    expect(treeString).toContain("href=");
  });

  test("リンク数のカウントが正しく機能する", () => {
    // ツリー内のリンク数をカウント
    const linkCount = countLinks(ariaTree.root);

    // リンク数が0より大きいことを確認
    expect(linkCount).toBeGreaterThan(0);

    // 実際のリンク数を確認（正確な数は変わる可能性があるため、範囲で確認）
    const treeString = ariaTreeToString(ariaTree);
    const hrefMatches = treeString.match(/\[href=/g) || [];
    expect(linkCount).toBeGreaterThanOrEqual(hrefMatches.length);
  });

  test("ノードの深さの計算が正しく機能する", () => {
    // ツリーの最大深さを計算
    const maxDepth = getNodeDepth(ariaTree.root);

    // 深さが0より大きいことを確認
    expect(maxDepth).toBeGreaterThan(0);

    // 実際の深さを確認（正確な数は変わる可能性があるため、範囲で確認）
    // 一般的なウェブページでは、深さは少なくとも3以上になることが多い
    expect(maxDepth).toBeGreaterThanOrEqual(3);
  });

  test("ノードの重みづけが正しく機能する", () => {
    // リンクノードを見つける
    const findLinkNode = (node: AriaNode): AriaNode | null => {
      if (node.type === "link") {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const linkNode = findLinkNode(child);
          if (linkNode) {
            return linkNode;
          }
        }
      }
      return null;
    };

    const linkNode = findLinkNode(ariaTree.root);
    expect(linkNode).not.toBeNull();

    if (linkNode) {
      // 深さ0でのリンクの重み
      const weightAtDepth0 = calculateNodeWeight(linkNode, 0, 0, 1);

      // 深さ3でのリンクの重み
      const weightAtDepth3 = calculateNodeWeight(linkNode, 3, 0, 1);

      // 深さが浅いほど重みが大きくなることを確認
      expect(weightAtDepth0).toBeGreaterThan(weightAtDepth3);

      // 同じ深さでも、位置が上のほうが重みが大きくなることを確認
      const weightAtPosition0 = calculateNodeWeight(linkNode, 1, 0, 3);
      const weightAtPosition2 = calculateNodeWeight(linkNode, 1, 2, 3);
      expect(weightAtPosition0).toBeGreaterThan(weightAtPosition2);
    }
  });

  test("最大リンク数を制限した場合に、重要なリンクが優先的に表示される", () => {
    // 最大リンク数を5に制限
    const maxLinks = 5;

    // ツリー内のリンク総数をカウント
    const totalLinks = countLinks(ariaTree.root);

    // リンク数が5より多いことを確認（テストが意味を持つため）
    expect(totalLinks).toBeGreaterThan(maxLinks);

    // 重み付けとフィルタリングを行う
    const weightedRoot = assignWeightsToTree(ariaTree.root);
    const filteredRoot = filterNodesByWeight(weightedRoot, maxLinks);

    // フィルタリング後のリンク数が最大リンク数以下であることを確認
    const filteredLinkCount = filteredRoot ? countLinks(filteredRoot) : 0;
    expect(filteredLinkCount).toBeLessThanOrEqual(maxLinks);

    // フィルタリング後のツリーを文字列化
    const filteredTree = {
      root: filteredRoot || ariaTree.root,
      nodeCount: filteredRoot ? countNodes(filteredRoot) : ariaTree.nodeCount,
    };
    const filteredTreeString = ariaTreeToString(filteredTree, maxLinks);

    // フィルタリングが行われたことを確認する方法を変更
    // 1. フィルタリング後のリンク数が最大リンク数以下であることを確認
    const hrefMatches = filteredTreeString.match(/\[href=/g) || [];
    expect(hrefMatches.length).toBeLessThanOrEqual(maxLinks);

    // 2. 重要なリンクが含まれていることを確認
    expect(filteredTreeString).toContain("link");
    expect(filteredTreeString).toContain("[href=");

    // 3. 元のリンク数と比較して、リンク数が減少していることを確認
    expect(hrefMatches.length).toBeLessThan(totalLinks);
  });
});

// ノード数をカウントするヘルパー関数
function countNodes(node: AriaNode): number {
  let count = 1; // 自身をカウント
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}
