// import { toHTML, extract } from "@mizchi/readability";
import { toHTML, extract, ariaTreeToString, toMarkdown } from "../src/index.ts";
import { PageType } from "../src/types.ts";
import html2md from "html-to-md";
import process from "node:process";

const html = await fetch(
  process.argv[2] ?? "https://zenn.dev/mizchi/articles/ts-using-sampling-logger"
).then((res) => res.text());
const extracted = extract(html, {
  charThreshold: 100,
  // forcedPageType: PageType.OTHER,
});
// 結果を表示
// console.log(`Title: ${extracted.title}`);
// console.log(`Author: ${extracted.byline}`);
// console.log(`pageType: ${extracted.pageType}`);

if (extracted.pageType === "article") {
  // const htmlContent = toHTML(extracted.root);
  const md = toMarkdown(extracted.root);
  console.log(md);
  // console.log(htmlContent);
  // const md = html2md(htmlContent);
  // console.log(md);
} else if (extracted.pageType === "other") {
  console.log("This is not an article.");
  const ariaSnapshot = extracted.ariaTree;
  const str = ariaTreeToString(ariaSnapshot!);
  console.log(str);
}
