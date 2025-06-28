#!/usr/bin/env node
import { toHTML, toMarkdown, extract } from "./dist/index.js"; // Adjust path as needed, import PageType, remove toReadableAriaTree
import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";

// TODO: add puppeteer and lightpanda
/**
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchLoader(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  return res.text();
}

const helpText = `
Usage: @mizchi/readability [options] <url>
Options:
  -t, --threshold <number>   Character threshold for extraction (default: 250)
  -h, --help                 Show this help message
  -f, --format <format>      Output format (md or html)
  -o, --out <file>           Output file path (default: stdout)
  --mcp                      Start MCP server for Model Context Protocol
`;

if (
  process.argv.includes("--help") ||
  process.argv.includes("-h") ||
  process.argv.length === 2
) {
  console.log(helpText);
  process.exit(0);
}

async function main() {
  // before parse
  if (process.argv.includes("--mcp") || process.argv.includes("-v")) {
    const { startMcpServer } = await import("./src/mcp-server.js");
    await startMcpServer();
    return;
  }

  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      threshold: {
        type: "string",
        short: "t",
      },
      loader: {
        type: "string",
      },
      format: {
        type: "string",
        short: "f",
      },
      out: {
        type: "string",
        short: "o",
      },
      mcp: {
        type: "boolean",
        default: false,
      },
    },
    allowPositionals: true,
  });
  if (parsed.values.mcp) {
    const { startMcpServer } = await import("./src/mcp-server.js");
    await startMcpServer();
    return;
  }

  const url = parsed.positionals[0];
  if (!url) {
    console.error("Please provide a URL.");
    process.exit(1);
  }
  // const format = parsed.values.format ?? "md";
  /**
   * @type {string}
   */
  let format = "md";
  /**
   * @type {string | undefined}
   */
  let output = undefined;
  const threshold = parsed.values.threshold
    ? Number(parsed.values.threshold)
    : 250;
  if (parsed.values.format) {
    format = parsed.values.format;
  } else if (parsed.values.out) {
    if (path.isAbsolute(parsed.values.out)) {
      output = parsed.values.out;
    } else {
      output = path.join(process.cwd(), parsed.values.out);
    }
    const ext = path.extname(url);
    if (ext === ".html") {
      format = "html";
    } else if (ext === ".md") {
      format = "md";
    }
  }
  const html = await fetchLoader(url);
  const result = extract(html, {
    charThreshold: threshold,
  });

  /**
   * @type {string}
   */
  let content;
  if (format === "html") {
    content = toHTML(result.root);
  } else {
    content = toMarkdown(result.root);
  }

  if (output) {
    fs.writeFileSync(output, content);
  } else {
    console.log(content);
  }
}
await main().catch(console.error);
