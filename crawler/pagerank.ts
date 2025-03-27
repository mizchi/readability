/**
 * PageRank アルゴリズムを計算する関数
 * @param linkGraph リンクグラフ (Map<string, Set<string>>: fromUrl -> Set<toUrl>)
 * @param visited 訪問済み URL の Set<string>
 * @param iterations 計算の反復回数
 * @param dampingFactor ダンピングファクター (通常 0.85)
 * @returns 各ページの PageRank スコア (Map<string, number>)
 */
export function calculatePageRank(
  linkGraph: Map<string, Set<string>>,
  visited: Set<string>,
  iterations = 20,
  dampingFactor = 0.85
): Map<string, number> {
  const pages = Array.from(visited);
  const numPages = pages.length;
  if (numPages === 0) return new Map();

  let ranks = new Map<string, number>();
  pages.forEach((page) => ranks.set(page, 1 / numPages));

  const outgoingLinksCount = new Map<string, number>();
  linkGraph.forEach((links, page) => {
    // visited に含まれるリンクのみカウント
    const validLinks = Array.from(links).filter((link) => visited.has(link));
    outgoingLinksCount.set(page, validLinks.length);
  });

  // 逆リンクグラフを作成 (target -> [source1, source2, ...])
  const incomingLinks = new Map<string, string[]>();
  pages.forEach((targetPage) => incomingLinks.set(targetPage, []));
  linkGraph.forEach((links, sourcePage) => {
    links.forEach((targetPage) => {
      // visited に含まれるページからのリンクのみ考慮
      if (visited.has(targetPage) && visited.has(sourcePage)) {
        // targetPage が incomingLinks に存在するか確認
        if (incomingLinks.has(targetPage)) {
          incomingLinks.get(targetPage)!.push(sourcePage);
        } else {
          // visited に含まれているはずなので、通常ここには来ない
          console.warn(
            `[PageRank] Target page ${targetPage} not found in incomingLinks map, though it exists in visited set.`
          );
        }
      }
    });
  });

  for (let i = 0; i < iterations; i++) {
    const newRanks = new Map<string, number>();
    let totalRank = 0; // ランクの合計を保持 (正規化用)

    for (const page of pages) {
      let rank = (1 - dampingFactor) / numPages; // 基本スコア
      let linkSum = 0;

      const sources = incomingLinks.get(page) || [];
      for (const source of sources) {
        const sourceRank = ranks.get(source) || 0;
        const sourceOutgoingCount = outgoingLinksCount.get(source) || 0;
        if (sourceOutgoingCount > 0) {
          linkSum += sourceRank / sourceOutgoingCount;
        } else {
          // 袋小路ページからのランク分配 (全ページに均等分配)
          // visited に含まれるページのみ考慮するため、numPages で割る
          linkSum += sourceRank / numPages;
        }
      }
      rank += dampingFactor * linkSum;
      newRanks.set(page, rank);
      totalRank += rank;
    }

    // ランクを正規化 (合計が 1 になるように)
    // console.log(`Iteration ${i + 1}, Total Rank before norm: ${totalRank}`);
    if (totalRank > 0) {
      for (const page of pages) {
        newRanks.set(page, (newRanks.get(page) || 0) / totalRank);
      }
    } else {
      // グラフが空か、何らかの問題でランクが計算できなかった場合
      // 均等割り当てに戻す (あるいはエラー処理)
      console.warn(
        "[PageRank] Total rank is zero, resetting to uniform distribution."
      );
      pages.forEach((page) => newRanks.set(page, 1 / numPages));
      ranks = newRanks;
      break; // これ以上計算しても意味がないのでループを抜ける
    }
    ranks = newRanks;
  }

  return ranks;
}
