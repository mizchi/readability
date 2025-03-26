// Mozilla/Readability v3 - ドメインベースのARIAスナップショット生成
// AIに渡すためのページ要約を生成し、特定ドメインのリンク構造に焦点を当てる

import { extract } from "../src/index.ts";
import type { AriaNode, AriaTree } from "../src/types.ts";
import fs from "fs";
import path from "path";
import { URL } from "url";

// ドメイン情報を抽出する関数
function extractDomainFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (e) {
    // URLの解析に失敗した場合は空文字列を返す
    return "";
  }
}

// HTMLからベースURLを抽出する関数
function extractBaseUrlFromHtml(html: string): string {
  // <base href="..."> タグからURLを抽出
  const baseMatch = html.match(/<base[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (baseMatch && baseMatch[1]) {
    return baseMatch[1];
  }

  // <meta property="og:url" content="..."> からURLを抽出
  const ogUrlMatch = html.match(
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  if (ogUrlMatch && ogUrlMatch[1]) {
    return ogUrlMatch[1];
  }

  // <link rel="canonical" href="..."> からURLを抽出
  const canonicalMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );
  if (canonicalMatch && canonicalMatch[1]) {
    return canonicalMatch[1];
  }

  // URLが見つからない場合は空文字列を返す
  return "";
}

// ドメインまたはサブドメインかどうかをチェックする
function isDomainOrSubdomain(testDomain: string, baseDomain: string): boolean {
  return testDomain === baseDomain || testDomain.endsWith(`.${baseDomain}`);
}

// URLが外部リンクかどうかを判定する
function isExternalLink(url: string, domain: string): boolean {
  // 絶対URLの場合
  if (url.startsWith("http")) {
    try {
      const linkDomain = extractDomainFromUrl(url);
      return !isDomainOrSubdomain(linkDomain, domain);
    } catch (e) {
      // URLの解析に失敗した場合は内部リンクとみなす
      return false;
    }
  }

  // 相対URLの場合は内部リンク
  return false;
}

// ドメインに基づいてAriaTreeを圧縮する
function compressAriaTreeByDomain(tree: AriaTree, domain: string): AriaTree {
  // ドメインに基づいてリンクをフィルタリングする再帰関数
  function filterNodesByDomain(node: AriaNode): AriaNode | null {
    // リンクノードの場合、ドメインに基づいてフィルタリング
    if (node.type === "link" && node.name) {
      // リンクがURLの場合、ドメインをチェック
      if (node.name.startsWith("http")) {
        try {
          const linkDomain = extractDomainFromUrl(node.name);
          // 同じドメインまたはサブドメインの場合は保持、それ以外は除外
          if (!linkDomain || !isDomainOrSubdomain(linkDomain, domain)) {
            return null;
          }
        } catch (e) {
          // URLの解析に失敗した場合は保持
        }
      }
    }

    // 子ノードを再帰的に処理
    if (node.children) {
      const filteredChildren = node.children
        .map((child) => filterNodesByDomain(child))
        .filter((child): child is AriaNode => child !== null);

      // 子ノードが残っている場合は更新、なくなった場合はnullを返す
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      } else if (node.type === "navigation" || node.type === "list") {
        // ナビゲーションやリストで子ノードがなくなった場合は除外
        return null;
      } else {
        // その他のノードで子ノードがなくなった場合は子ノードなしで保持
        const { children, ...rest } = node;
        return rest;
      }
    }

    return node;
  }

  // ルートノードを処理
  const filteredRoot = filterNodesByDomain(tree.root);

  // ノード数を再計算
  const nodeCount = countNodes(filteredRoot || tree.root);

  return {
    root: filteredRoot || tree.root,
    nodeCount,
  };
}

// ノード数をカウントする
function countNodes(node: AriaNode): number {
  let count = 1; // 自分自身

  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }

  return count;
}

// リンク構造を分析する
function analyzeLinks(root: AriaNode, domain: string) {
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const categories: Record<string, string[]> = {
    navigation: [],
    content: [],
    footer: [],
    social: [],
    other: [],
  };

  const navigationMenus: {
    name: string;
    type: string;
    linkCount: number;
    links: string[];
  }[] = [];

  // リンクを収集する再帰関数
  function collectLinks(node: AriaNode, context: string = "other") {
    // ナビゲーションコンテキストの検出
    if (node.type === "navigation") {
      // ナビゲーションの名前を決定
      let navName = node.name || "";
      let navType = "一般";

      // 名前がない場合は子要素から推測
      if (!navName) {
        // 1. 最初の見出し要素を探す
        if (node.children) {
          for (const child of node.children) {
            if (child.type === "heading" && child.name) {
              navName = child.name;
              break;
            }
          }
        }

        // 2. 見出しがない場合は、最初の数個のリンクテキストを連結
        if (!navName && node.children) {
          const linkTexts: string[] = [];
          let count = 0;

          function collectLinkTexts(n: AriaNode) {
            if (count >= 3) return;

            if (n.type === "link" && n.name) {
              linkTexts.push(n.name);
              count++;
            }

            if (n.children && count < 3) {
              for (const child of n.children) {
                collectLinkTexts(child);
                if (count >= 3) break;
              }
            }
          }

          collectLinkTexts(node);

          if (linkTexts.length > 0) {
            navName = linkTexts.join(" ");
            if (navName.length > 50) {
              navName = navName.substring(0, 47) + "...";
            }
          }
        }

        // 3. それでも名前がない場合はデフォルト名
        if (!navName) {
          navName = "ナビゲーション";
        }
      }

      // ナビゲーションの種類を推測
      if (
        navName.toLowerCase().includes("main") ||
        navName.toLowerCase().includes("primary")
      ) {
        navType = "メインナビゲーション";
      } else if (navName.toLowerCase().includes("footer")) {
        navType = "フッターナビゲーション";
      } else if (navName.toLowerCase().includes("sidebar")) {
        navType = "サイドナビゲーション";
      } else if (navName.toLowerCase().includes("social")) {
        navType = "ソーシャルリンク";
      } else if (navName.toLowerCase().includes("tool")) {
        navType = "ツールメニュー";
      }

      const navMenu = {
        name: `${navName} (${navType})`,
        type: navType,
        linkCount: 0,
        links: [] as string[],
      };

      // ナビゲーション内のリンクを収集
      function collectNavLinks(navNode: AriaNode) {
        if (navNode.type === "link" && navNode.name) {
          navMenu.linkCount++;
          navMenu.links.push(navNode.name);
          categories.navigation.push(navNode.name);

          // 内部リンクか外部リンクかの判定
          const isExternal = isExternalLink(navNode.name, domain);
          if (isExternal) {
            if (!externalLinks.includes(navNode.name)) {
              externalLinks.push(navNode.name);
            }
          } else {
            if (!internalLinks.includes(navNode.name)) {
              internalLinks.push(navNode.name);
            }
          }
        }

        if (navNode.children) {
          navNode.children.forEach((child) => collectNavLinks(child));
        }
      }

      collectNavLinks(node);

      if (navMenu.linkCount > 0) {
        navigationMenus.push(navMenu);
      }

      // このナビゲーションの子ノードは既に処理したのでスキップ
      return;
    }

    // コンテキストの更新
    let currentContext = context;
    if (node.type === "contentinfo") currentContext = "footer";
    else if (node.type === "main" || node.type === "article")
      currentContext = "content";

    // リンクの処理
    if (node.type === "link" && node.name) {
      // 内部リンクか外部リンクかの判定
      const isExternal = isExternalLink(node.name, domain);

      if (isExternal) {
        if (!externalLinks.includes(node.name)) {
          externalLinks.push(node.name);
        }
      } else {
        if (!internalLinks.includes(node.name)) {
          internalLinks.push(node.name);
        }
      }

      // カテゴリに追加
      categories[currentContext]?.push(node.name) ||
        categories.other.push(node.name);

      // ソーシャルメディアリンクの検出
      if (
        node.name.toLowerCase().includes("twitter") ||
        node.name.toLowerCase().includes("facebook") ||
        node.name.toLowerCase().includes("instagram")
      ) {
        categories.social.push(node.name);
      }
    }

    // 子ノードを再帰的に処理
    if (node.children) {
      node.children.forEach((child) => collectLinks(child, currentContext));
    }
  }

  collectLinks(root);

  // ナビゲーションメニューをリンク数でソート
  navigationMenus.sort((a, b) => b.linkCount - a.linkCount);

  // ナビゲーションメニューの種類を分析
  const navTypes = navigationMenus.reduce(
    (acc: Record<string, number>, menu) => {
      acc[menu.type] = (acc[menu.type] || 0) + 1;
      return acc;
    },
    {}
  );

  return {
    internalLinks,
    externalLinks,
    categories,
    navigationMenus,
    navTypes,
  };
}

// メイン処理
async function main() {
  // テスト用のHTMLファイルを読み込む
  const htmlPath = path.join(
    import.meta.dirname,
    "../test/test-pages/wikipedia/source.html"
  );
  const html = fs.readFileSync(htmlPath, "utf-8");

  // HTMLからベースURLを抽出
  const baseUrl = extractBaseUrlFromHtml(html);
  const baseDomain = extractDomainFromUrl(
    baseUrl || "https://en.wikipedia.org"
  );
  console.log(`検出されたドメイン: ${baseDomain}`);

  // 本文抽出とaria tree生成を同時に行う
  const result = extract(html, { generateAriaTree: true });

  console.log("=== ページ基本情報 ===");
  console.log(`タイトル: ${result.title}`);
  console.log(`本文抽出: ${result.root ? "成功" : "失敗"}`);
  console.log(`ノード数: ${result.nodeCount}`);
  console.log(`ページタイプ: ${result.pageType}`);

  // AriaTreeが生成されているか確認
  if (result.ariaTree) {
    // ドメインに基づいてAriaTreeを圧縮
    const compressedTree = compressAriaTreeByDomain(
      result.ariaTree,
      baseDomain
    );

    // リンク構造の分析
    console.log("\n=== リンク構造分析（ドメインフィルタリング後）===");
    const linkAnalysis = analyzeLinks(compressedTree.root, baseDomain);

    // 内部リンクと外部リンクの数
    console.log(`内部リンク数: ${linkAnalysis.internalLinks.length}`);
    console.log(`外部リンク数: ${linkAnalysis.externalLinks.length}`);

    // リンクのカテゴリ分類
    console.log("\nリンクカテゴリ:");
    Object.entries(linkAnalysis.categories).forEach(([category, links]) => {
      console.log(`- ${category}: ${links.length}件`);
    });

    // 主要なナビゲーションメニュー
    console.log("\n主要ナビゲーション:");
    linkAnalysis.navigationMenus.forEach((menu, i) => {
      console.log(`${i + 1}. ${menu.name} - ${menu.linkCount}リンク`);
      // 各ナビゲーションの最初の数個のリンクを表示
      if (menu.links.length > 0) {
        console.log(
          `   主なリンク: ${menu.links.slice(0, 3).join(", ")}${menu.links.length > 3 ? "..." : ""}`
        );
      }
    });
  }
}

main().catch(console.error);
