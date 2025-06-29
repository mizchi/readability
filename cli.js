#!/usr/bin/env node
import {
  toHTML,
  toMarkdown,
  extract,
  analyzePageStructure,
  extractDocumentContent,
} from "./dist/index.js"; // Adjust path as needed, import PageType, remove toReadableAriaTree
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

Default behavior (extract main content):
  readability <url>                    Extract main content as markdown
  readability <url> -f html            Extract main content as HTML

Progressive analysis options:
  --analyze-structure                  Analyze page structure without content extraction
  --extract-nav                        Extract navigation elements only
  --extract-content --with-context     Extract content with structural context
  --full-analysis                      Complete analysis (structure + nav + content)

Output formats:
  -f, --format <format>                Output format:
                                       - md (markdown, default)
                                       - html
                                       - json
                                       - nav (navigation only)
                                       - doc (document mode)
                                       - ai-summary (AI-optimized summary)
                                       - ai-structured (AI-optimized structure)

Filtering options:
  --nav-type <type>                    Filter by navigation type
  --nav-location <location>            Filter by navigation location
  --with-context                       Include structural context

Other options:
  -t, --threshold <number>             Character threshold (default: 250)
  -o, --out <file>                     Output file path (default: stdout)
  -h, --help                           Show this help message
  --mcp                                Start MCP server

Legacy options (backward compatibility):
  --nav-only                           Same as --extract-nav
  --doc-mode                           Same as --format doc
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
      "doc-mode": {
        type: "boolean",
        default: false,
      },
      "analyze-structure": {
        type: "boolean",
        default: false,
      },
      "extract-nav": {
        type: "boolean",
        default: false,
      },
      "extract-content": {
        type: "boolean",
        default: false,
      },
      "with-context": {
        type: "boolean",
        default: false,
      },
      "full-analysis": {
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

  // Handle progressive analysis options
  if (parsed.values["analyze-structure"]) {
    // Structure analysis without content extraction
    const structure = analyzePageStructure(html);
    const analysis = {
      url: url,
      pageType: result.nodeCount > 0 ? "article" : "other", // Simple heuristic
      hasMainContent: result.nodeCount > 0,
      navigations: {
        global: structure.navigations.some((n) => n.type === "global"),
        breadcrumb: structure.navigations.some((n) => n.type === "breadcrumb"),
        toc: structure.navigations.some((n) => n.type === "toc"),
        sidebar: structure.navigations.some((n) => n.location === "sidebar"),
        pagination: structure.navigations.some((n) => n.type === "pagination"),
      },
      contentAreas: {
        header: structure.headers.length > 0,
        mainContent: !!structure.mainContent,
        sidebar: !!structure.sidebar,
        footer: !!structure.footer,
      },
      stats: {
        navigationCount: structure.navigations.length,
        headerCount: structure.headers.length,
        contentLength: result.nodeCount,
      },
    };
    content = JSON.stringify(analysis, null, 2);
  } else if (parsed.values["extract-nav"] || parsed.values["nav-only"]) {
    // Navigation extraction (enhanced version of nav-only)
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
  } else if (parsed.values["extract-content"]) {
    // Content extraction with optional context
    const withContext = parsed.values["with-context"];
    if (withContext) {
      const structure = analyzePageStructure(html);
      const contentWithContext = {
        url: url,
        title: result.metadata?.title || "",
        content: toMarkdown(result.root),
        context: {
          breadcrumb: structure.breadcrumb?.items.map((i) => i.label).join(" > ") || null,
          section: structure.mainContent ? "main" : "unknown",
          surroundingNavigation: structure.navigations
            .filter((n) => n.location === "inline" || n.type === "toc")
            .map((n) => ({
              type: n.type,
              location: n.location,
              itemCount: n.items.length,
            })),
        },
        metadata: result.metadata,
      };
      content = JSON.stringify(contentWithContext, null, 2);
    } else {
      content = toMarkdown(result.root);
    }
  } else if (parsed.values["full-analysis"]) {
    // Complete analysis
    const structure = analyzePageStructure(html);
    const docContent = extractDocumentContent(html);
    const fullAnalysis = {
      url: url,
      structure: {
        pageType: result.nodeCount > 0 ? "article" : "other",
        navigations: structure.navigations.map((n) => ({
          type: n.type,
          location: n.location,
          itemCount: n.items.length,
          label: n.label,
        })),
        headers: structure.headers.map((h) => ({
          type: h.type,
          text: h.contains.siteTitle?.text || "",
        })),
        contentAreas: {
          main: !!structure.mainContent,
          sidebar: !!structure.sidebar,
          footer: !!structure.footer,
        },
      },
      navigation: {
        breadcrumb: docContent.breadcrumb || null,
        tableOfContents: docContent.toc || null,
        sidebarNav: docContent.sidebarNav || null,
      },
      content: {
        main: docContent.content,
        outline: docContent.outline || null,
      },
      metadata: result.metadata,
    };
    content = JSON.stringify(fullAnalysis, null, 2);
  } else if (format === "ai-summary") {
    // AI-optimized summary format
    const structure = analyzePageStructure(html);
    const summary = {
      url: url,
      type: structure.navigations.some((n) => n.type === "toc" && n.location === "sidebar")
        ? "documentation"
        : result.nodeCount > 500
          ? "article"
          : "other",
      title: result.metadata?.title || "",
      summary: result.root ? toMarkdown(result.root).substring(0, 200) + "..." : "",
      mainTopics: structure.sections?.map((s) => s.title).slice(0, 5) || [],
      navigationSummary: {
        breadcrumb: structure.breadcrumb?.items.map((i) => i.label).join(" > ") || null,
        sections: structure.sections?.length || 0,
        hasTableOfContents: structure.navigations.some((n) => n.type === "toc"),
        hasSidebar: !!structure.sidebar,
      },
      contentStats: {
        wordCount: result.root ? toMarkdown(result.root).split(/\s+/).length : 0,
        hasCode: result.root ? toMarkdown(result.root).includes("```") : false,
      },
    };
    content = JSON.stringify(summary, null, 2);
  } else if (format === "ai-structured") {
    // AI-optimized structured format
    const structure = analyzePageStructure(html);
    const structured = {
      metadata: {
        url: url,
        ...result.metadata,
      },
      structure: {
        header: structure.mainHeader
          ? {
              logo: structure.mainHeader.contains.logo ? "present" : "absent",
              title: structure.mainHeader.contains.siteTitle?.text || null,
              navigation: structure.mainHeader.contains.navigation ? "present" : "absent",
            }
          : null,
        navigation: {
          types: structure.navigations.map((n) => n.type),
          main:
            structure.mainNavigation?.items.map((i) => ({
              label: i.label,
              href: i.href,
            })) || [],
          breadcrumb: structure.breadcrumb?.items || [],
        },
        content: {
          main: {
            present: !!result.root,
            markdown: result.root ? toMarkdown(result.root) : "",
          },
          sections:
            structure.sections?.map((s) => ({
              id: s.id,
              title: s.title,
              level: s.level,
              children: s.children?.length || 0,
            })) || [],
        },
        sidebar: structure.sidebar
          ? {
              present: true,
              navigation: structure.sidebarNavigation?.items.length || 0,
            }
          : null,
      },
    };
    content = JSON.stringify(structured, null, 2);
  } else if (parsed.values["doc-mode"] || format === "doc") {
    // ドキュメントモード：本文とナビゲーション構造を統合
    const docContent = extractDocumentContent(html);

    // マークダウン形式で出力
    content = "# Document Content\n\n";

    if (docContent.breadcrumb) {
      content += `**Breadcrumb:** ${docContent.breadcrumb}\n\n`;
    }

    if (docContent.toc) {
      content += "## Table of Contents\n\n" + docContent.toc + "\n";
    }

    if (docContent.sidebarNav) {
      content += "## Sidebar Navigation\n\n" + docContent.sidebarNav + "\n";
    }

    if (docContent.outline) {
      content += "## Document Outline\n\n" + docContent.outline + "\n";
    }

    content += "## Main Content\n\n" + docContent.content;
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
