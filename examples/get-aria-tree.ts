// examples/run-aria-tree.ts
import { extractAriaTree, ariaTreeToString } from "../src/index.ts";
import process from "node:process";

async function main() {
  // コマンドライン引数を処理
  const args = process.argv.slice(2);

  // オプションを抽出
  const noCompressIndex = args.indexOf("--no-compress");
  const compress = noCompressIndex === -1;

  // オプションを除いた最初の引数をURLとして使用
  let url = "https://zenn.dev/mizchi";
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      url = arg;
      break;
    }
  }

  console.log(`Fetching HTML from ${url}...`);
  const html = await fetch(url).then((res) => res.text());

  console.log(`Extracting AriaTree (compress: ${compress})...`);
  const ariaTree = extractAriaTree(html, { compress });

  console.log("AriaTree:");
  console.log(ariaTreeToString(ariaTree));

  console.log(`Total nodes: ${ariaTree.nodeCount}`);
}

main().catch(console.error);
