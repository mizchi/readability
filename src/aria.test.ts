import { describe, test, expect } from "vitest";
import {
  getAriaRole,
  getAccessibleName,
  getAriaNodeType,
  buildAriaNode,
  buildAriaTree,
  compressAriaTree,
  ariaTreeToString,
} from "./aria";
import type { VElement, AriaNode, VDocument } from "./types";

describe("ARIA Snapshot Utilities", () => {
  test("getAriaRole - 明示的なロールを取得", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "div",
      attributes: { role: "banner" },
      children: [],
    };

    expect(getAriaRole(element)).toBe("banner");
  });

  test("getAriaRole - 暗黙的なロールを取得", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "h1",
      attributes: {},
      children: [],
    };

    expect(getAriaRole(element)).toBe("heading");
  });

  test("getAccessibleName - 見出し要素の名前を取得", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "h2",
      attributes: {},
      children: [
        {
          nodeType: "text",
          textContent: "記事のタイトル",
          parent: undefined,
        },
      ],
    };

    expect(getAccessibleName(element)).toBe("記事のタイトル");
  });

  test("getAriaNodeType - 要素のタイプを決定", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "button",
      attributes: {},
      children: [],
    };

    expect(getAriaNodeType(element)).toBe("button");
  });

  test("buildAriaNode - 基本的なノード構築", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "h1",
      attributes: {},
      children: [
        {
          nodeType: "text",
          textContent: "ウェブサイトのタイトル",
          parent: undefined,
        },
      ],
    };

    const node = buildAriaNode(element);

    expect(node.type).toBe("heading");
    expect(node.name).toBe("ウェブサイトのタイトル");
    expect(node.level).toBe(1);
  });

  test("buildAriaNode - 属性を持つノード構築", () => {
    // 直接要素を作成してテスト
    const element: VElement = {
      nodeType: "element",
      tagName: "input",
      attributes: {
        type: "checkbox",
        "aria-checked": "true",
      },
      children: [],
    };

    const node = buildAriaNode(element);

    expect(node.type).toBe("checkbox");
    expect(node.checked).toBe(true);
  });

  test("buildAriaTree - ツリー構築", () => {
    // 簡単なドキュメント構造を作成
    const doc: VDocument = {
      documentElement: {
        nodeType: "element",
        tagName: "html",
        attributes: {},
        children: [],
      },
      body: {
        nodeType: "element",
        tagName: "body",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "header",
            attributes: { role: "banner" },
            children: [],
          },
          {
            nodeType: "element",
            tagName: "main",
            attributes: {},
            children: [],
          },
          {
            nodeType: "element",
            tagName: "footer",
            attributes: { role: "contentinfo" },
            children: [],
          },
        ],
      },
    };

    const tree = buildAriaTree(doc);

    expect(tree.root).toBeDefined();
    expect(tree.nodeCount).toBeGreaterThan(0);

    // ルートの子に banner, main, contentinfo が含まれているか
    const rootChildren = tree.root.children || [];
    const childTypes = rootChildren.map((child) => child.type);

    expect(childTypes).toContain("banner");
    expect(childTypes).toContain("main");
    expect(childTypes).toContain("contentinfo");
  });

  test("compressAriaTree - ツリー圧縮", () => {
    // 圧縮前のツリーを構築
    const uncompressedNode: AriaNode = {
      type: "generic",
      role: "generic",
      children: [
        {
          type: "text",
          name: "テキスト1",
          role: "generic",
        },
        {
          type: "text",
          name: "テキスト2",
          role: "generic",
        },
        {
          type: "generic",
          role: "generic",
        },
        {
          type: "text",
          role: "generic",
          children: [
            {
              type: "text",
              name: "ネストされたテキスト",
              role: "generic",
            },
          ],
        },
      ],
    };

    // ツリーを圧縮
    const compressedNode = compressAriaTree(uncompressedNode);

    // 連続するtextノードがマージされているか
    expect(compressedNode.children?.length || 0).toBeLessThan(
      uncompressedNode.children?.length || 0
    );

    // 意味のないノードが削除されているか
    const hasGenericWithoutName = compressedNode.children?.some(
      (child) =>
        child.type === "generic" &&
        !child.name &&
        (!child.children || child.children.length === 0)
    );
    expect(hasGenericWithoutName).toBeFalsy();

    // 子を一つしか持たないtextの入れ子がたたまれているか
    const nestedTextNode = compressedNode.children?.find(
      (child) =>
        child.type === "text" && child.name?.includes("ネストされたテキスト")
    );
    expect(nestedTextNode).toBeDefined();
    expect(nestedTextNode?.children).toBeUndefined();
  });

  test("ariaTreeToString - ツリーの文字列化", () => {
    // 簡単なツリーを作成
    const tree = {
      root: {
        type: "generic" as const,
        role: "generic",
        children: [
          {
            type: "banner" as const,
            role: "banner",
            name: "ヘッダー",
          },
          {
            type: "heading" as const,
            role: "heading",
            name: "タイトル",
            level: 1,
          },
          {
            type: "button" as const,
            role: "button",
            name: "送信",
            disabled: true,
          },
          {
            type: "checkbox" as const,
            role: "checkbox",
            name: "同意する",
            checked: true,
          },
          {
            type: "textbox" as const,
            role: "textbox",
            name: "名前",
            required: true,
          },
        ],
      },
      nodeCount: 6,
    };

    const treeString = ariaTreeToString(tree);

    // 基本的な形式チェック
    expect(treeString).toContain("- banner");
    expect(treeString).toContain("- heading");
    expect(treeString).toContain("- button");
    expect(treeString).toContain("- checkbox");
    expect(treeString).toContain("- textbox");

    // 属性チェック
    expect(treeString).toContain("[level=1]");
    expect(treeString).toContain("[disabled]");
    expect(treeString).toContain("[checked=true]");
    expect(treeString).toContain("[required]");
  });
});
