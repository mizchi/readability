// examples/run-aria-tree.ts
import { extractAriaTree, ariaTreeToString } from "../src/index.ts";
import process from "node:process";

async function main() {
  // コマンドライン引数を処理
  const args = process.argv.slice(2);

  // オプションを抽出
  const noCompressIndex = args.indexOf("--no-compress");
  const compress = noCompressIndex === -1;

  // maxLinksオプションを抽出
  const maxLinksIndex = args.indexOf("--max-links");
  let maxLinks = 60; // デフォルト値
  if (maxLinksIndex !== -1 && maxLinksIndex + 1 < args.length) {
    const maxLinksValue = parseInt(args[maxLinksIndex + 1], 10);
    if (!isNaN(maxLinksValue) && maxLinksValue > 0) {
      maxLinks = maxLinksValue;
    }
  }

  // オプションを除いた最初の引数をURLとして使用
  // より大きなARIAツリーを持つWebサイトのデフォルトを設定
  let url = "https://news.yahoo.co.jp/";
  for (const arg of args) {
    if (!arg.startsWith("--") && arg !== args[maxLinksIndex + 1]) {
      url = arg;
      break;
    }
  }

  console.log(`Fetching HTML from ${url}...`);
  const html = await fetch(url).then((res) => res.text());

  console.log(`Extracting AriaTree (compress: ${compress})...`);
  const ariaTree = extractAriaTree(html, { compress });

  console.log(`Total nodes: ${ariaTree.nodeCount}`);
  console.log(`Applying maxLinks: ${maxLinks}`);

  console.log("AriaTree:");
  console.log(ariaTreeToString(ariaTree, maxLinks));
}

main().catch(console.error);
