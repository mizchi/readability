#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  extract,
  toMarkdown,
  ariaTreeToString,
  analyzeLinkHierarchy,
  classifyPageType,
} from "./dist/index.js";

// Create MCP server instance
const server = new McpServer({
  name: "readability-mcp",
  version: "1.0.0",
  description: "Extract readable content from URLs and convert to markdown",
});

// Define the extract tool
server.tool(
  "read_url_content_as_markdown",
  {
    url: z
      .string()
      .url()
      .describe("The URL to fetch and extract readable content from"),
    charThreshold: z
      .number()
      .optional()
      .default(100)
      .describe("Character threshold for content extraction"),
  },
  async ({ url, options = {} }) => {
    try {
      // Fetch the HTML content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();

      // Extract content using the lower-level extract function
      const extracted = extract(html, {
        url: url,
        charThreshold: options.charThreshold ?? 100,
      });
      // Convert to markdown
      const markdown = toMarkdown(extracted.root);
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error processing URL: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Define a resource to get server info
server.resource("info", "readability://info", async () => ({
  contents: [
    {
      uri: "readability://info",
      mimeType: "text/plain",
      text: `Readability MCP Server v0.5.8

This server provides tools to extract readable content from web pages and convert them to markdown.

Available tools:
- read_url_content_as_markdown: Fetch a URL and extract readable content as markdown

Usage example:
{
  "tool": "read_url_content_as_markdown",
  "arguments": {
    "url": "https://example.com/article",
    "options": {
      "includeAriaTree": true,
      "includeLinkHierarchy": true,
      "compact": true
    }
  }
}`,
    },
  ],
}));

// Start the server
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP server is running. Waiting for requests...");
}
