// import { toHTML, extract } from "@mizchi/readability";
import {
  extract,
  ariaTreeToString,
  toMarkdown,
  extractAriaTree,
} from "../src/index.ts";
// import { toMarkdown } from "../src/markdown.ts";
import process from "node:process";

const html = await fetch(
  process.argv[2] ?? "https://zenn.dev/mizchi/articles/ts-using-sampling-logger"
).then((res) => res.text());
const extracted = extract(html, {
  charThreshold: 100,
});

const parsed = toMarkdown(extracted.root);
console.log(parsed);

{
  console.log("----- Aria Tree -----");
  const html = await fetch("https://zenn.dev").then((res) => res.text());
  const tree = extractAriaTree(html);
  // console.log(tree);
  const str = ariaTreeToString(tree);
  console.log(str);
}

// if (extracted.pageType === "article") {
//   // HTMLの構造を確認
//   const parsed = toMarkdown(extracted.root);
//   console.log(parsed);
// } else if (extracted.pageType === "other") {
//   console.log("This is not an article.");
//   const ariaSnapshot = extracted.ariaTree;
//   const str = ariaTreeToString(ariaSnapshot!);
//   console.log(str);
// }

// const parsed = toMarkdown(extracted.root);
// console.log(parsed);
