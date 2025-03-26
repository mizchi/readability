import puppeteer from "puppeteer-core";
import html2md from "html-to-md";
// import process from "node:process";
import { toHTML, extract } from "../dist/index.js";

// use browserWSEndpoint to pass the Lightpanda's CDP server address.
const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222",
});

try {
  // The rest of your script remains the same.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  // Dump all the links from the page.
  await page.goto("https://en.wikipedia.org/wiki/Gradual_typing");

  const html = await page.content();
  const ex = extract(html);
  const md = html2md(toHTML(ex.root!));
  console.log(md);
  await page.close();
  await context.close();
  await browser.disconnect();
} catch (err) {
  console.error(err);
} finally {
  await browser.close();
}
