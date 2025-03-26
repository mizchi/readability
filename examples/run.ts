// import { toHTML, extract } from "@mizchi/readability";
import { toHTML, extract } from "../dist/index.js";
import html2md from "html-to-md";
import process from "node:process";

const html = await fetch(
  process.argv[2] ?? "https://zenn.dev/mizchi/articles/ts-using-sampling-logger"
).then((res) => res.text());
const extracted = extract(html, { charThreshold: 100 });
// 結果を表示
console.log(`Title: ${extracted.title}`);
console.log(`Author: ${extracted.byline}`);
if (!extracted.root) {
  process.exit(1);
}
const htmlContent = toHTML(extracted.root);
// console.log(htmlContent);
const md = html2md(htmlContent);
console.log(md);
