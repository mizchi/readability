#!/usr/bin/env node
import { toHTML, toMarkdown, extract, analyzePageStructure } from "./dist/index.js"; // Adjust path as needed, import PageType, remove toReadableAriaTree
import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";

// TODO: add puppeteer and lightpanda
/**
 *
 * @param {string} urlOrPath
 * @returns {Promise<string>}
 */
async function fetchLoader(urlOrPath) {
  // Check if it's a local file path
  if (!urlOrPath.startsWith("http://") && !urlOrPath.startsWith("https://")) {
    try {
      const fullPath = path.isAbsolute(urlOrPath) ? urlOrPath : path.join(process.cwd(), urlOrPath);
      return fs.readFileSync(fullPath, "utf-8");
    } catch (err) {
      throw new Error(`Failed to read file ${urlOrPath}: ${err.message}`);
    }
  }

  const res = await fetch(urlOrPath);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${urlOrPath}: ${res.statusText}`);
  }
  return res.text();
}

const helpText = `
Usage: @mizchi/readability [options] <url-or-file>
Options:
  -t, --threshold <number>   Character threshold for extraction (default: 250)
  -h, --help                 Show this help message
  -f, --format <format>      Output format (md, html, nav, or json)
  -o, --out <file>           Output file path (default: stdout)
  --mcp                      Start MCP server for Model Context Protocol
  --nav-type <type>          Filter navigation by type (global, breadcrumb, toc, pagination, social, footer, utility, local)
  --nav-location <location>  Filter navigation by location (header, sidebar, footer, inline)
  --nav-only                 Output only navigation structure (JSON format)
`;

if (process.argv.includes("--help") || process.argv.includes("-h") || process.argv.length === 2) {
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
      "nav-type": {
        type: "string",
      },
      "nav-location": {
        type: "string",
      },
      "nav-only": {
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
  const threshold = parsed.values.threshold ? Number(parsed.values.threshold) : 250;
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

  // Handle navigation-related options
  if (parsed.values["nav-only"] || format === "nav" || format === "json") {
    const pageStructure = analyzePageStructure(html);
    let navigations = pageStructure.navigations;

    // Filter by navigation type if specified
    if (parsed.values["nav-type"]) {
      navigations = navigations.filter((nav) => nav.type === parsed.values["nav-type"]);
    }

    // Filter by navigation location if specified
    if (parsed.values["nav-location"]) {
      navigations = navigations.filter((nav) => nav.location === parsed.values["nav-location"]);
    }

    // Create output object
    const navOutput = {
      url: url,
      navigations: navigations,
      summary: {
        total: navigations.length,
        byType: navigations.reduce((acc, nav) => {
          acc[nav.type] = (acc[nav.type] || 0) + 1;
          return acc;
        }, {}),
        mainNavigation: pageStructure.mainNavigation
          ? {
              items: pageStructure.mainNavigation.items.map((item) => item.label),
            }
          : null,
        breadcrumb: pageStructure.breadcrumb
          ? {
              path: pageStructure.breadcrumb.items.map((item) => item.label).join(" > "),
            }
          : null,
        toc: pageStructure.toc
          ? {
              items: pageStructure.toc.items.map((item) => ({
                label: item.label,
                href: item.href,
              })),
            }
          : null,
      },
    };

    content = JSON.stringify(navOutput, null, 2);
  } else if (format === "html") {
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
