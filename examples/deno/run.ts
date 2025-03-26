import { extract, toHTML } from "npm:@mizchi/readability@0.3.1";
import html2md from "npm:html-to-md@0.8.6";

const html = await fetch(
  "https://zenn.dev/mizchi/articles/ts-using-sampling-logger"
).then((res) => res.text());
const extracted = extract(html, { charThreshold: 100 });
// 結果を表示
console.log(`Title: ${extracted.title}`);
console.log(`Author: ${extracted.byline}`);
const htmlContent = toHTML(extracted.root);
const md = html2md(htmlContent);
console.log(md);
