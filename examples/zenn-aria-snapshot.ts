// Mozilla/Readability v3 - Zenn.devのナビゲーション構造分析
// 外部URLからHTMLを取得し、階層構造に基づいてリンクを分類

import { extract } from "../src/index.ts";
import type { AriaNode, AriaTree } from "../src/types.ts";
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

// URLからパス階層を抽出する関数
function extractPathHierarchy(urlString: string): string[] {
  try {
    const url = new URL(urlString);
    // パスを分割して空の要素を除去
    return url.pathname.split('/').filter(segment => segment.length > 0);
  } catch (e) {
    // URLの解析に失敗した場合は空配列を返す
    return [];
  }
}

// 相対パスを絶対URLに変換する関数
function resolveRelativeUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    // 解析に失敗した場合は元の相対URLを返す
    return relativeUrl;
  }
}

// HTMLからベースURLを抽出する関数
function extractBaseUrlFromHtml(html: string, defaultUrl: string): string {
  // <base href="..."> タグからURLを抽出
  const baseMatch = html.match(/<base[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (baseMatch && baseMatch[1]) {
    return baseMatch[1];
  }
  
  // <meta property="og:url" content="..."> からURLを抽出
  const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (ogUrlMatch && ogUrlMatch[1]) {
    return ogUrlMatch[1];
  }
  
  // <link rel="canonical" href="..."> からURLを抽出
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (canonicalMatch && canonicalMatch[1]) {
    return canonicalMatch[1];
  }
  
  // URLが見つからない場合はデフォルトURLを返す
  return defaultUrl;
}

// ドメインまたはサブドメインかどうかをチェックする
function isDomainOrSubdomain(testDomain: string, baseDomain: string): boolean {
  return testDomain === baseDomain || testDomain.endsWith(`.${baseDomain}`);
}

// 階層関係を判定する関数
function determineHierarchyRelation(
  basePathSegments: string[],
  targetPathSegments: string[]
): "inner" | "same" | "outer" | "different" {
  // 共通のプレフィックスの長さを計算
  let commonPrefixLength = 0;
  const minLength = Math.min(basePathSegments.length, targetPathSegments.length);
  
  for (let i = 0; i < minLength; i++) {
    if (basePathSegments[i] === targetPathSegments[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }
  
  // 共通プレフィックスがない場合は別パス
  if (commonPrefixLength === 0) {
    return "different";
  }
  
  // 共通プレフィックス以降の比較
  if (targetPathSegments.length > basePathSegments.length) {
    // ターゲットパスが長い場合は内側
    return "inner";
  } else if (targetPathSegments.length < basePathSegments.length) {
    // ターゲットパスが短い場合は外側
    return "outer";
  } else {
    // 同じ長さの場合
    if (commonPrefixLength === basePathSegments.length) {
      // 完全に一致する場合は同レベル
      return "same";
    } else {
      // 一部だけ一致する場合は別パス
      return "different";
    }
  }
}

// リンク構造を階層に基づいて分析する
function analyzeLinksHierarchy(root: AriaNode, baseUrl: string, domain: string) {
  // 基準となるURLの階層構造を抽出
  const basePathSegments = extractPathHierarchy(baseUrl);
  
  // 階層ごとのリンクを格納するオブジェクト
  const hierarchyLinks: {
    inner: string[];    // 内側（現在のページより深い階層）
    same: string[];     // 同レベル（現在のページと同じ階層）
    outer: string[];    // 外側（現在のページより浅い階層）
    different: string[]; // 別パス（現在のページとは異なるパス体系）
    external: string[]; // 外部リンク（別ドメイン）
  } = {
    inner: [],
    same: [],
    outer: [],
    different: [],
    external: []
  };
  
  // ナビゲーションメニューごとの階層分布
  const navigationMenus: { 
    name: string; 
    type: string;
    linkCount: number;
    hierarchyDistribution: {
      inner: number;
      same: number;
      outer: number;
      different: number;
      external: number;
    };
    links: {
      url: string;
      text: string;
      hierarchy: "inner" | "same" | "outer" | "different" | "external";
    }[];
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
      if (navName.toLowerCase().includes("main") || 
          navName.toLowerCase().includes("primary") ||
          navName.toLowerCase().includes("global")) {
        navType = "メインナビゲーション";
      } else if (navName.toLowerCase().includes("footer") || 
                navName.toLowerCase().includes("bottom")) {
        navType = "フッターナビゲーション";
      } else if (navName.toLowerCase().includes("sidebar") || 
                navName.toLowerCase().includes("side")) {
        navType = "サイドナビゲーション";
      } else if (navName.toLowerCase().includes("social")) {
        navType = "ソーシャルリンク";
      } else if (navName.toLowerCase().includes("breadcrumb")) {
        navType = "パンくずリスト";
      } else if (navName.toLowerCase().includes("language") || 
                navName.toLowerCase().includes("lang")) {
        navType = "言語選択";
      } else if (navName.toLowerCase().includes("tool") || 
                navName.toLowerCase().includes("utility")) {
        navType = "ツールメニュー";
      } else if (navName.toLowerCase().includes("header")) {
        navType = "ヘッダーナビゲーション";
      } else if (navName.toLowerCase().includes("tag") || 
                navName.toLowerCase().includes("category")) {
        navType = "タグ/カテゴリナビゲーション";
      } else if (navName.toLowerCase().includes("user") || 
                navName.toLowerCase().includes("account") ||
                navName.toLowerCase().includes("profile")) {
        navType = "ユーザーナビゲーション";
      }
      
      const navMenu = {
        name: `${navName} (${navType})`,
        type: navType,
        linkCount: 0,
        hierarchyDistribution: {
          inner: 0,
          same: 0,
          outer: 0,
          different: 0,
          external: 0
        },
        links: [] as {
          url: string;
          text: string;
          hierarchy: "inner" | "same" | "outer" | "different" | "external";
        }[]
      };
      
      // ナビゲーション内のリンクを収集
      function collectNavLinks(navNode: AriaNode) {
        if (navNode.type === "link") {
          navMenu.linkCount++;
          
          // リンクURLを取得（href属性がある場合）
          let linkUrl = "";
          let linkText = navNode.name || "";
          
          if (navNode.originalElement?.attributes.href) {
            linkUrl = navNode.originalElement.attributes.href;
          }
          
          // 相対URLを絶対URLに変換
          if (linkUrl && !linkUrl.startsWith('http') && !linkUrl.startsWith('#')) {
            linkUrl = resolveRelativeUrl(baseUrl, linkUrl);
          }
          
          // 階層関係を判定
          let hierarchy: "inner" | "same" | "outer" | "different" | "external" = "different";
          
          if (linkUrl) {
            if (linkUrl.startsWith('#')) {
              // アンカーリンクは同レベル
              hierarchy = "same";
            } else if (linkUrl.startsWith('http')) {
              try {
                const linkDomain = extractDomainFromUrl(linkUrl);
                if (!isDomainOrSubdomain(linkDomain, domain)) {
                  // 外部ドメインの場合
                  hierarchy = "external";
                } else {
                  // 同じドメインの場合は階層関係を判定
                  const linkPathSegments = extractPathHierarchy(linkUrl);
                  hierarchy = determineHierarchyRelation(basePathSegments, linkPathSegments);
                }
              } catch (e) {
                // URL解析に失敗した場合は別パス扱い
                hierarchy = "different";
              }
            } else {
              // 相対パスの場合
              try {
                const absoluteUrl = resolveRelativeUrl(baseUrl, linkUrl);
                const linkPathSegments = extractPathHierarchy(absoluteUrl);
                hierarchy = determineHierarchyRelation(basePathSegments, linkPathSegments);
              } catch (e) {
                // 解析に失敗した場合は別パス扱い
                hierarchy = "different";
              }
            }
            
            // 階層ごとのカウントを更新
            navMenu.hierarchyDistribution[hierarchy]++;
            
            // リンクを追加
            navMenu.links.push({
              url: linkUrl,
              text: linkText,
              hierarchy
            });
            
            // グローバルな階層リンクリストにも追加
            if (linkUrl) {
              hierarchyLinks[hierarchy].push(linkUrl);
            }
          }
        }
        
        if (navNode.children) {
          navNode.children.forEach(child => collectNavLinks(child));
        }
      }
      
      collectNavLinks(node);
      
      if (navMenu.linkCount > 0) {
        navigationMenus.push(navMenu);
      }
      
      // このナビゲーションの子ノードは既に処理したのでスキップ
      return;
    }
    
    // リンクの処理
    if (node.type === "link") {
      // リンクURLを取得（href属性がある場合）
      let linkUrl = "";
      
      if (node.originalElement?.attributes.href) {
        linkUrl = node.originalElement.attributes.href;
      }
      
      if (linkUrl) {
        // 相対URLを絶対URLに変換
        if (!linkUrl.startsWith('http') && !linkUrl.startsWith('#')) {
          linkUrl = resolveRelativeUrl(baseUrl, linkUrl);
        }
        
        // 階層関係を判定
        let hierarchy: "inner" | "same" | "outer" | "different" | "external";
        
        if (linkUrl.startsWith('#')) {
          // アンカーリンクは同レベル
          hierarchy = "same";
        } else if (linkUrl.startsWith('http')) {
          try {
            const linkDomain = extractDomainFromUrl(linkUrl);
            if (!isDomainOrSubdomain(linkDomain, domain)) {
              // 外部ドメインの場合
              hierarchy = "external";
            } else {
              // 同じドメインの場合は階層関係を判定
              const linkPathSegments = extractPathHierarchy(linkUrl);
              hierarchy = determineHierarchyRelation(basePathSegments, linkPathSegments);
            }
          } catch (e) {
            // URL解析に失敗した場合は別パス扱い
            hierarchy = "different";
          }
        } else {
          // 相対パスの場合
          try {
            const absoluteUrl = resolveRelativeUrl(baseUrl, linkUrl);
            const linkPathSegments = extractPathHierarchy(absoluteUrl);
            hierarchy = determineHierarchyRelation(basePathSegments, linkPathSegments);
          } catch (e) {
            // 解析に失敗した場合は別パス扱い
            hierarchy = "different";
          }
        }
        
        // 階層ごとのリンクリストに追加
        hierarchyLinks[hierarchy].push(linkUrl);
      }
    }
    
    // 子ノードを再帰的に処理
    if (node.children) {
      node.children.forEach(child => collectLinks(child, context));
    }
  }
  
  collectLinks(root);
  
  // ナビゲーションメニューをリンク数でソート
  navigationMenus.sort((a, b) => b.linkCount - a.linkCount);
  
  // 階層ごとのリンク数を集計
  const hierarchyCounts = {
    inner: hierarchyLinks.inner.length,
    same: hierarchyLinks.same.length,
    outer: hierarchyLinks.outer.length,
    different: hierarchyLinks.different.length,
    external: hierarchyLinks.external.length
  };
  
  // 階層ごとのリンク例を取得（最大5件）
  const hierarchyExamples = {
    inner: hierarchyLinks.inner.slice(0, 5),
    same: hierarchyLinks.same.slice(0, 5),
    outer: hierarchyLinks.outer.slice(0, 5),
    different: hierarchyLinks.different.slice(0, 5),
    external: hierarchyLinks.external.slice(0, 5)
  };
  
  return {
    hierarchyLinks,
    hierarchyCounts,
    hierarchyExamples,
    navigationMenus
  };
}

// メイン処理
async function main() {
  // 分析対象のURL
  const targetUrl = "https://zenn.dev/";
  
  try {
    console.log(`分析対象URL: ${targetUrl}`);
    
    // URLからHTMLを取得
    const response = await fetch(targetUrl);
    const html = await response.text();
    
    // HTMLからベースURLを抽出
    const baseUrl = extractBaseUrlFromHtml(html, targetUrl);
    const baseDomain = extractDomainFromUrl(baseUrl);
    console.log(`検出されたURL: ${baseUrl}`);
    console.log(`検出されたドメイン: ${baseDomain}`);
    console.log(`URL階層: /${extractPathHierarchy(baseUrl).join('/')}`);
    
    // 本文抽出とaria tree生成を同時に行う
    const result = extract(html, { generateAriaTree: true });
    
    console.log("\n=== ページ基本情報 ===");
    console.log(`タイトル: ${result.title}`);
    console.log(`本文抽出: ${result.root ? "成功" : "失敗"}`);
    console.log(`ノード数: ${result.nodeCount}`);
    console.log(`ページタイプ: ${result.pageType}`);
    
    // AriaTreeが生成されているか確認
    if (result.ariaTree) {
      // 階層構造に基づいてリンクを分析
      console.log("\n=== リンク階層構造分析 ===");
      const hierarchyAnalysis = analyzeLinksHierarchy(result.ariaTree.root, baseUrl, baseDomain);
      
      // 階層ごとのリンク数
      console.log("\n階層ごとのリンク数:");
      console.log(`- 内側（より深い階層）: ${hierarchyAnalysis.hierarchyCounts.inner}件`);
      console.log(`- 同レベル（同じ階層）: ${hierarchyAnalysis.hierarchyCounts.same}件`);
      console.log(`- 外側（より浅い階層）: ${hierarchyAnalysis.hierarchyCounts.outer}件`);
      console.log(`- 別パス（異なるパス体系）: ${hierarchyAnalysis.hierarchyCounts.different}件`);
      console.log(`- 外部（別ドメイン）: ${hierarchyAnalysis.hierarchyCounts.external}件`);
      
      // 階層ごとのリンク例
      if (hierarchyAnalysis.hierarchyExamples.inner.length > 0) {
        console.log("\n内側の階層のリンク例:");
        hierarchyAnalysis.hierarchyExamples.inner.forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }
      
      if (hierarchyAnalysis.hierarchyExamples.outer.length > 0) {
        console.log("\n外側の階層のリンク例:");
        hierarchyAnalysis.hierarchyExamples.outer.forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }
      
      // ナビゲーションメニューの階層分布
      console.log("\n主要ナビゲーションの階層分布:");
      hierarchyAnalysis.navigationMenus.forEach((menu, i) => {
        console.log(`${i + 1}. ${menu.name} - ${menu.linkCount}リンク`);
        console.log(`   階層分布: 内側=${menu.hierarchyDistribution.inner}, 同レベル=${menu.hierarchyDistribution.same}, 外側=${menu.hierarchyDistribution.outer}, 別パス=${menu.hierarchyDistribution.different}, 外部=${menu.hierarchyDistribution.external}`);
        
        // 各階層の最初のリンクを表示
        const innerLinks = menu.links.filter(link => link.hierarchy === "inner").slice(0, 2);
        const outerLinks = menu.links.filter(link => link.hierarchy === "outer").slice(0, 2);
        
        if (innerLinks.length > 0) {
          console.log(`   内側リンク例: ${innerLinks.map(l => `${l.text} (${l.url})`).join(", ")}`);
        }
        
        if (outerLinks.length > 0) {
          console.log(`   外側リンク例: ${outerLinks.map(l => `${l.text} (${l.url})`).join(", ")}`);
        }
      });
      
      // 階層構造の要約
      console.log("\n=== 階層構造の要約 ===");
      const totalLinks = Object.values(hierarchyAnalysis.hierarchyCounts).reduce((a, b) => a + b, 0);
      const innerRatio = totalLinks > 0 ? Math.round((hierarchyAnalysis.hierarchyCounts.inner / totalLinks) * 100) : 0;
      const outerRatio = totalLinks > 0 ? Math.round((hierarchyAnalysis.hierarchyCounts.outer / totalLinks) * 100) : 0;
      
      console.log(`このページは全${totalLinks}リンクのうち、内側の階層へのリンクが${innerRatio}%、外側の階層へのリンクが${outerRatio}%を占めています。`);
      
      if (innerRatio > outerRatio) {
        console.log("内側へのリンクが多いため、このページは階層の入り口（ハブページ）である可能性が高いです。");
      } else if (outerRatio > innerRatio) {
        console.log("外側へのリンクが多いため、このページは階層の末端（リーフページ）である可能性が高いです。");
      } else {
        console.log("内側と外側へのリンクがバランスしているため、このページは階層の中間に位置していると考えられます。");
      }
      
      // ナビゲーションの役割分析
      const navRoles = hierarchyAnalysis.navigationMenus.map(menu => {
        const { inner, outer, same, different, external } = menu.hierarchyDistribution;
        const total = inner + outer + same + different + external;
        
        if (inner > outer && inner > same && inner > different && inner > external) {
          return { name: menu.name, role: "下位階層ナビゲーション", count: menu.linkCount };
        } else if (outer > inner && outer > same && outer > different && outer > external) {
          return { name: menu.name, role: "上位階層ナビゲーション", count: menu.linkCount };
        } else if (same > inner && same > outer && same > different && same > external) {
          return { name: menu.name, role: "同階層ナビゲーション", count: menu.linkCount };
        } else if (different > inner && different > outer && different > same && different > external) {
          return { name: menu.name, role: "クロスナビゲーション", count: menu.linkCount };
        } else if (external > inner && external > outer && external > same && external > different) {
          return { name: menu.name, role: "外部リンクナビゲーション", count: menu.linkCount };
        } else {
          return { name: menu.name, role: "混合ナビゲーション", count: menu.linkCount };
        }
      });
      
      console.log("\nナビゲーションの役割分析:");
      navRoles.forEach((nav, i) => {
        console.log(`${i + 1}. ${nav.name}: ${nav.role} (${nav.count}リンク)`);
      });
      
      // Zenn.dev特有の構造分析
      console.log("\n=== Zenn.dev特有の構造分析 ===");
      
      // トピックやタグの分析
      const topicLinks = hierarchyAnalysis.hierarchyLinks.inner.filter(link => 
        link.includes("/topics/") || link.includes("/tags/")
      );
      
      if (topicLinks.length > 0) {
          .filter((link) => link.hierarchy === "outer")
          .slice(0, 2);

        if (innerLinks.length > 0) {
          console.log(
            `   内側リンク例: ${innerLinks.map((l) => `${l.text} (${l.url})`).join(", ")}`
          );
        }

        if (outerLinks.length > 0) {
          console.log(
            `   外側リンク例: ${outerLinks.map((l) => `${l.text} (${l.url})`).join(", ")}`
          );
        }
      });

      // 階層構造の要約
      console.log("\n=== 階層構造の要約 ===");
      const totalLinks = Object.values(
        hierarchyAnalysis.hierarchyCounts
      ).reduce((a, b) => a + b, 0);
      const innerRatio =
        totalLinks > 0
          ? Math.round(
              (hierarchyAnalysis.hierarchyCounts.inner / totalLinks) * 100
            )
          : 0;
      const outerRatio =
        totalLinks > 0
          ? Math.round(
              (hierarchyAnalysis.hierarchyCounts.outer / totalLinks) * 100
            )
          : 0;

      console.log(
        `このページは全${totalLinks}リンクのうち、内側の階層へのリンクが${innerRatio}%、外側の階層へのリンクが${outerRatio}%を占めています。`
      );

      if (innerRatio > outerRatio) {
        console.log(
          "内側へのリンクが多いため、このページは階層の入り口（ハブページ）である可能性が高いです。"
        );
      } else if (outerRatio > innerRatio) {
        console.log(
          "外側へのリンクが多いため、このページは階層の末端（リーフページ）である可能性が高いです。"
        );
      } else {
        console.log(
          "内側と外側へのリンクがバランスしているため、このページは階層の中間に位置していると考えられます。"
        );
      }

      // ナビゲーションの役割分析
      const navRoles = hierarchyAnalysis.navigationMenus.map((menu) => {
        const { inner, outer, same, different, external } =
          menu.hierarchyDistribution;
        const total = inner + outer + same + different + external;

        if (
          inner > outer &&
          inner > same &&
          inner > different &&
          inner > external
        ) {
          return {
            name: menu.name,
            role: "下位階層ナビゲーション",
            count: menu.linkCount,
          };
        } else if (
          outer > inner &&
          outer > same &&
          outer > different &&
          outer > external
        ) {
          return {
            name: menu.name,
            role: "上位階層ナビゲーション",
            count: menu.linkCount,
          };
        } else if (
          same > inner &&
          same > outer &&
          same > different &&
          same > external
        ) {
          return {
            name: menu.name,
            role: "同階層ナビゲーション",
            count: menu.linkCount,
          };
        } else if (
          different > inner &&
          different > outer &&
          different > same &&
          different > external
        ) {
          return {
            name: menu.name,
            role: "クロスナビゲーション",
            count: menu.linkCount,
          };
        } else if (
          external > inner &&
          external > outer &&
          external > same &&
          external > different
        ) {
          return {
            name: menu.name,
            role: "外部リンクナビゲーション",
            count: menu.linkCount,
          };
        } else {
          return {
            name: menu.name,
            role: "混合ナビゲーション",
            count: menu.linkCount,
          };
        }
      });

      console.log("\nナビゲーションの役割分析:");
      navRoles.forEach((nav, i) => {
        console.log(`${i + 1}. ${nav.name}: ${nav.role} (${nav.count}リンク)`);
      });

      // Zenn.dev特有の構造分析
      console.log("\n=== Zenn.dev特有の構造分析 ===");

      // トピックやタグの分析
      const topicLinks = hierarchyAnalysis.hierarchyLinks.inner.filter(
        (link) => link.includes("/topics/") || link.includes("/tags/")
      );

      if (topicLinks.length > 0) {
        console.log(`\nトピック/タグリンク: ${topicLinks.length}件`);
        topicLinks.slice(0, 5).forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }

      // ユーザープロフィールリンクの分析
      const userLinks = hierarchyAnalysis.hierarchyLinks.inner.filter(
        (link) =>
          link.match(/\/[^\/]+$/) &&
          !link.includes("/topics/") &&
          !link.includes("/tags/")
      );

      if (userLinks.length > 0) {
        console.log(`\nユーザープロフィールリンク: ${userLinks.length}件`);
        userLinks.slice(0, 5).forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }

      // 記事リンクの分析
      const articleLinks = hierarchyAnalysis.hierarchyLinks.inner.filter(
        (link) => link.includes("/articles/")
      );

      if (articleLinks.length > 0) {
        console.log(`\n記事リンク: ${articleLinks.length}件`);
        articleLinks.slice(0, 5).forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }

      // 本/スクラップリンクの分析
      const bookLinks = hierarchyAnalysis.hierarchyLinks.inner.filter(
        (link) => link.includes("/books/") || link.includes("/scraps/")
      );

      if (bookLinks.length > 0) {
        console.log(`\n本/スクラップリンク: ${bookLinks.length}件`);
        bookLinks.slice(0, 5).forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`);
        });
      }
    }
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main().catch(console.error);
