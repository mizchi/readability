// src/markdown.ts
import type { VElement, VNode, VText } from "./types";

/**
 * Markdown 特殊文字をエスケープする
 * @param text エスケープ対象のテキスト
 * @returns エスケープ後のテキスト
 */
function escapeMarkdown(text: string): string {
  // *, _, `, [, ], \ をエスケープ
  // HTMLエンティティもデコードしておく（例: & -> &）
  const decodedText = text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'");
  return decodedText.replace(/([*_`\[\]\\])/g, "\\$1");
}

/**
 * VNode を Markdown 文字列に変換する（再帰処理）
 * @param node 変換対象の VNode
 * @param parentTagName 親要素のタグ名（リストのネストなどで使用）
 * @param depth ネストの深さ（リストなどで使用）
 * @param isFirstChild 自身が親の最初の子要素かどうか
 * @returns Markdown 文字列
 */
function convertNodeToMarkdown(
  node: VNode,
  parentTagName?: string,
  depth: number = 0,
  isFirstChild: boolean = false // Add isFirstChild parameter
): string {
  if (node.nodeType === "text") {
    if (parentTagName === "pre" || parentTagName === "code") {
      return node.textContent; // Keep raw text in pre/code
    }
    // Collapse multiple whitespace chars into one, but preserve newlines somewhat?
    // For now, trim leading/trailing whitespace from text nodes unless they are significant (e.g., inside inline elements?)
    // Let's trim whitespace aggressively for now and see.
    const trimmedText = node.textContent.trim();
    if (!trimmedText) return ""; // Ignore empty text nodes
    // Escape the trimmed text
    return escapeMarkdown(trimmedText);
  }

  if (node.nodeType === "element") {
    const element = node as VElement;
    const tagName = element.tagName.toLowerCase();
    const isBlock = [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "pre",
      "blockquote",
      "hr",
      "table",
      "div", // Treat div as block for spacing
    ].includes(tagName);

    // Process children, passing context including isFirstChild
    let childrenMarkdown = "";
    let lastChildWasBlock = false;
    element.children.forEach((child, index) => {
      const isCurrentChildFirst = index === 0;
      const childResult = convertNodeToMarkdown(
        child,
        tagName,
        // Increment depth for lists and blockquotes
        tagName === "ul" || tagName === "ol" || tagName === "blockquote"
          ? depth + 1
          : depth,
        isCurrentChildFirst // Pass isFirstChild status
      );

      // Add spacing logic here? Or rely on element handlers?
      // Let's refine spacing within handlers for now.
      childrenMarkdown += childResult;

      // Update lastChildWasBlock for the next iteration (though not used currently)
      lastChildWasBlock =
        child.nodeType === "element" &&
        [
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "pre",
          "blockquote",
          "hr",
          "table",
          "div",
        ].includes(child.tagName.toLowerCase());
    });

    // Trim children's markdown ONLY if appropriate for the current tag
    // Most block elements should trim their content. Inline elements should not.
    const trimmedChildren = childrenMarkdown.trim();

    switch (tagName) {
      // Headings: Trim content, add block spacing
      case "h1":
        return `# ${trimmedChildren}\n\n`;
      case "h2":
        return `## ${trimmedChildren}\n\n`;
      case "h3":
        return `### ${trimmedChildren}\n\n`;
      case "h4":
        return `#### ${trimmedChildren}\n\n`;
      case "h5":
        return `##### ${trimmedChildren}\n\n`;
      case "h6":
        return `###### ${trimmedChildren}\n\n`;

      case "p":
        if (!trimmedChildren) return ""; // Ignore empty paragraphs
        // Add block spacing, unless it's the very first element in a list item or blockquote?
        // Let's add block spacing generally for now. Final cleanup might adjust.
        // If parent is li/blockquote and this p is the first child, maybe less spacing?
        // This gets complex. Default to standard block spacing.
        return `${trimmedChildren}\n\n`;

      // Inline elements: Use raw childrenMarkdown, do not trim or add spaces here.
      case "strong":
      case "b":
        return `**${childrenMarkdown}**`;
      case "em":
      case "i":
        return `*${childrenMarkdown}*`;
      case "code":
        if (parentTagName !== "pre") {
          // Inline code: Refined logic for delimiters and padding
          let codeContent = childrenMarkdown; // Use raw content from children
          const backtickSequences = codeContent.match(/`+/g) || [];
          const longestSequence = backtickSequences.reduce(
            (max, seq) => Math.max(max, seq.length),
            0
          );
          let delimiter = "`".repeat(longestSequence + 1);

          // If content is only backticks, ensure delimiter is longer
          if (
            codeContent.match(/^`+$/) &&
            codeContent.length >= delimiter.length
          ) {
            delimiter = "`".repeat(codeContent.length + 1);
          }

          // Determine if padding is needed:
          // - If content is empty or only whitespace.
          // - If content starts or ends with a backtick.
          // - If the chosen delimiter sequence appears within the content.
          const needsPadding =
            !codeContent.trim() ||
            codeContent.startsWith("`") ||
            codeContent.endsWith("`") ||
            (delimiter.length > 1 && codeContent.includes(delimiter)); // Check if delimiter itself is in content only if delimiter > 1

          const paddedContent = needsPadding ? ` ${codeContent} ` : codeContent;

          return `${delimiter}${paddedContent}${delimiter}`;
        }
        // Code inside pre: Return raw content
        return childrenMarkdown;
      case "pre": {
        // Find code block content, avoid trimming internal whitespace
        const codeChild = element.children.find(
          (c): c is VElement => c.nodeType === "element" && c.tagName === "code"
        );
        // Get raw text content, joining text nodes. If codeChild exists, use its content.
        const rawCodeContent = (codeChild || element).children
          .filter((c): c is VText => c.nodeType === "text") // Filter only text nodes
          .map((c) => c.textContent) // Get their text content
          .join("");

        const lang =
          codeChild?.attributes.class?.replace(/^language-/, "") || "";
        // Trim trailing newline/whitespace from content, add block spacing
        return `\`\`\`${lang}\n${rawCodeContent.replace(/\s+$/, "")}\n\`\`\`\n\n`;
      }
      case "blockquote": {
        // Process children's markdown (already includes spacing between blocks if any)
        // Trim leading/trailing whitespace from the whole blockquote content before processing lines
        const content = childrenMarkdown.trim();
        if (!content) return ""; // Ignore empty blockquotes

        const lines = content.split("\n");
        // Add "> " prefix. Handle empty lines (resulting from \n\n between paragraphs) correctly.
        const quotedLines = lines.map((line) =>
          line.trim() === "" ? ">" : `> ${line}`
        );
        // Join lines and add block spacing
        return quotedLines.join("\n") + "\n\n";
      }
      case "ul":
      case "ol":
        // Filter out empty results from children (e.g., whitespace text nodes processed earlier)
        const listItems = element.children
          .filter((c) => c.nodeType === "element" && c.tagName === "li") // Only process li elements directly
          .map((child, index) =>
            convertNodeToMarkdown(
              child,
              tagName,
              depth + 1, // Correct depth increment
              index === 0
            )
          )
          .filter((item) => item.trim() !== ""); // Filter truly empty items

        if (listItems.length === 0) return ""; // Ignore empty lists

        // Join list items with a single newline. Assume li handler does not add trailing newline.
        const listContent = listItems.join("\n");

        // Add block spacing around the entire list block
        return `${listContent}\n\n`; // Removed leading \n, added trailing \n\n

      case "li": {
        // Indentation for the marker itself
        const markerIndent = "  ".repeat(Math.max(0, depth - 1)); // depth is already incremented by ul/ol
        const marker = parentTagName === "ol" ? "1." : "-";
        // Indentation for subsequent lines of the list item content
        const contentIndent = "  ".repeat(depth);

        // Process children's markdown. Trim leading/trailing whitespace from the combined result.
        let content = childrenMarkdown.trim();
        if (!content) return ""; // Should not happen if ul/ol filters empty li, but good practice

        const lines = content.split("\n");
        // First line starts with the marker
        const firstLine = `${markerIndent}${marker} ${lines[0] || ""}`;

        // Indent subsequent lines
        const subsequentLines = lines
          .slice(1)
          .map((line) => (line.trim() ? `${contentIndent}${line}` : "")) // Indent non-empty lines
          .filter(Boolean) // Remove empty strings from map result
          .join("\n");

        // Join first and subsequent lines. No trailing newline needed here.
        return subsequentLines ? `${firstLine}\n${subsequentLines}` : firstLine;
      }
      case "a":
        const href = element.attributes.href || "";
        // Check for image link specifically
        if (
          element.children.length === 1 &&
          element.children[0].nodeType === "element" &&
          element.children[0].tagName === "img"
        ) {
          // Image link: childrenMarkdown already contains the formatted image
          return `[${childrenMarkdown}](${href})`; // No trim needed for image
        }
        // Regular link: Trim the link text
        return `[${childrenMarkdown.trim()}](${href})`;
      case "img":
        // Alt text should be escaped
        const alt = escapeMarkdown(element.attributes.alt || "");
        const src = element.attributes.src || "";
        // Title should also be escaped if present
        const title = element.attributes.title
          ? ` "${escapeMarkdown(element.attributes.title)}"`
          : "";
        return `![${alt}](${src}${title})`;

      case "hr":
        return "---\n\n"; // Ensure block spacing
      case "br":
        return "  \n"; // Keep hard line break

      case "table": {
        // Table logic refinement: Ensure cell content is processed correctly and add block spacing.
        let headerRow: string[] = [];
        const bodyRows: string[][] = [];
        let maxColumns = 0;

        const thead = element.children.find(
          (c): c is VElement =>
            c.nodeType === "element" && c.tagName === "thead"
        );
        const tbody = element.children.find(
          (c): c is VElement =>
            c.nodeType === "element" && c.tagName === "tbody"
        );

        // Function to process cell content (td/th)
        const processCell = (cell: VElement): string => {
          // Recursively convert cell content, then trim whitespace within the cell
          return convertNodeToMarkdown(cell, cell.tagName, depth + 1).trim();
        };

        // Process header row
        if (thead) {
          const headerTr = thead.children.find(
            (c): c is VElement => c.nodeType === "element" && c.tagName === "tr"
          );
          if (headerTr) {
            headerRow = headerTr.children
              .filter(
                (c): c is VElement =>
                  c.nodeType === "element" && c.tagName === "th"
              )
              .map(processCell);
            maxColumns = Math.max(maxColumns, headerRow.length);
          }
        }

        // Process body rows (use tbody if exists, otherwise direct children of table)
        const rowsContainer = tbody || element;
        rowsContainer.children
          .filter(
            (c): c is VElement => c.nodeType === "element" && c.tagName === "tr"
          )
          .forEach((tr) => {
            const row = tr.children
              .filter(
                (c): c is VElement =>
                  c.nodeType === "element" &&
                  (c.tagName === "td" || c.tagName === "th")
              )
              .map(processCell);
            bodyRows.push(row);
            maxColumns = Math.max(maxColumns, row.length);
          });

        // Build Markdown table string
        let tableMd = "";
        const separator = Array(maxColumns).fill("---").join(" | ");

        // Add header row and separator
        if (headerRow.length > 0) {
          while (headerRow.length < maxColumns) headerRow.push(""); // Pad header
          tableMd += `| ${headerRow.join(" | ")} |\n`;
          tableMd += `| ${separator} |\n`;
        } else if (bodyRows.length > 0 && maxColumns > 0) {
          // Add separator even without header for GFM compatibility if there are body rows
          tableMd += `| ${separator} |\n`;
        }

        // Add body rows
        bodyRows.forEach((row) => {
          while (row.length < maxColumns) row.push(""); // Pad row
          tableMd += `| ${row.join(" | ")} |\n`;
        });

        // Add block spacing only if tableMd is not empty
        return tableMd ? `${tableMd.trim()}\n\n` : ""; // Trim trailing newline from last row, add block spacing
      }
      // thead, tbody, tr, th, td are handled within table logic by processCell/processRow

      // Ignored tags
      case "script":
      case "style":
      case "nav":
      case "aside":
      case "header":
      case "footer":
      case "form":
      case "button":
      case "iframe":
      case "object":
      case "embed":
      case "applet":
      case "link":
      case "meta":
      case "title":
      case "svg":
        return "";

      // Default: Render children for unknown tags. Add block spacing if it seems block-like.
      default:
        // If it's not a known inline tag, assume block-like spacing.
        const knownInline = [
          "a",
          "strong",
          "b",
          "em",
          "i",
          "code",
          "img",
          "br",
          "span",
        ]; // span is typically inline
        if (knownInline.includes(tagName)) {
          return childrenMarkdown; // Return raw children for inline
        } else {
          // Assume block: trim content and add block spacing
          const trimmedDefaultContent = childrenMarkdown.trim();
          return trimmedDefaultContent ? `${trimmedDefaultContent}\n\n` : "";
        }
    }
  }

  return ""; // Should not happen for valid VNode
}

/**
 * VElement を Markdown 文字列に変換する
 * @param element 変換対象の VElement または VDocument
 * @returns Markdown 文字列
 */
export function toMarkdown(element: VElement | null): string {
  if (!element) return "";

  // Start conversion from the root element
  let markdown = convertNodeToMarkdown(element, undefined, 0, true);

  // Final cleanup:
  // 1. Trim leading/trailing whitespace from the entire output
  markdown = markdown.trim();

  // 2. Normalize block spacing: Replace 3 or more newlines with exactly two.
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // 3. Ensure consistency: Maybe remove space before newline?
  // markdown = markdown.replace(/ +\n/g, '\n');

  return markdown;
}
