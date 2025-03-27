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
    .replace(/&/g, "&") // Decode common entities first
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " "); // Treat non-breaking space as regular space
  return decodedText.replace(/([*_`\[\]\\])/g, "\\$1");
}

/**
 * Joins an array of markdown strings, adding spaces where needed between inline elements/text.
 * @param parts Array of markdown strings (results from processing child nodes).
 * @returns Joined markdown string with appropriate spacing.
 */
function joinMarkdownParts(parts: string[]): string {
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const currentPart = parts[i];
    // Skip parts that are effectively empty after potential whitespace collapsing in text nodes
    if (!currentPart || currentPart.trim() === "") continue;

    if (result === "") {
      // For the first part, trim leading whitespace unless it's intentional (like in code)
      // This is tricky. Let's assume block handlers will trim later.
      result = currentPart;
    } else {
      // Stricter space check: only add space if previous doesn't end with any whitespace
      // and current doesn't start with any whitespace.
      const endsWithWhitespace = /\s$/.test(result); // Check only space/tab/newline at the very end
      const startsWithWhitespace = /^\s/.test(currentPart); // Check only space/tab/newline at the very start

      if (!endsWithWhitespace && !startsWithWhitespace) {
        // Don't add space if current part starts with punctuation
        const firstChar = currentPart.charAt(0);
        if (!/[.,!?;:)]/.test(firstChar)) {
          result += " "; // Add a single space
        }
      }
      result += currentPart;
    }
  }
  // Final trim at the end of join? No, let the block handlers do the final trim.
  return result;
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
      return node.textContent; // Keep raw text
    }
    // Replace sequences of space/tab with a single space. Keep newlines and leading/trailing spaces for joiner.
    let text = node.textContent.replace(/[ \t]+/g, " ");
    if (!text) return ""; // Ignore if completely empty
    return escapeMarkdown(text); // Escape potentially space-padded text
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
      "div",
    ].includes(tagName);
    const isInline = [
      "a",
      "strong",
      "b",
      "em",
      "i",
      "code",
      "img",
      "br",
      "span",
    ].includes(tagName);

    // Process children, store results in an array
    const childrenResults: string[] = [];
    element.children.forEach((child, index) => {
      const isCurrentChildFirst = index === 0;
      const childResult = convertNodeToMarkdown(
        child,
        tagName,
        // Increment depth for lists and blockquotes
        tagName === "ul" || tagName === "ol" || tagName === "blockquote"
          ? depth + 1
          : depth,
        isCurrentChildFirst
      );
      childrenResults.push(childResult);
    });

    // Join children results using the helper function for smart spacing
    let childrenMarkdown = joinMarkdownParts(childrenResults);

    // Trim children's markdown ONLY if appropriate for the current tag
    const trimmedChildren = childrenMarkdown.trim(); // Trim for block elements

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
        return `${trimmedChildren}\n\n`;

      // Inline elements: Use raw joined childrenMarkdown (no trim)
      case "strong":
      case "b":
        return `**${childrenMarkdown}**`;
      case "em":
      case "i":
        return `*${childrenMarkdown}*`;
      case "code":
        if (parentTagName !== "pre") {
          // Inline code: Use raw childrenMarkdown, apply padding logic carefully.
          let codeContent = childrenMarkdown; // Content already joined by joinMarkdownParts
          const backtickSequences = codeContent.match(/`+/g) || [];
          const longestSequence = backtickSequences.reduce(
            (max, seq) => Math.max(max, seq.length),
            0
          );
          let delimiter = "`".repeat(longestSequence + 1);

          if (
            codeContent.match(/^`+$/) &&
            codeContent.length >= delimiter.length
          ) {
            delimiter = "`".repeat(codeContent.length + 1);
          }

          // Determine padding based on GFM rules:
          // Add space if content starts/ends with backtick, OR if content consists only of backticks.
          // Also add space if content is empty or whitespace only to ensure delimiters are visible.
          const startsOrEndsWithBacktick =
            codeContent.startsWith("`") || codeContent.endsWith("`");
          // Check if the content consists *only* of one or more backticks
          const consistsOnlyOfBackticks = /^`+$/.test(codeContent);
          const isEmptyOrWhitespace = !codeContent.trim();

          const needsPadding =
            startsOrEndsWithBacktick ||
            consistsOnlyOfBackticks ||
            isEmptyOrWhitespace;

          // Apply padding *inside* the delimiters if needed
          const finalContent = needsPadding ? ` ${codeContent} ` : codeContent;

          // Recalculate delimiter length based on the potentially padded content? No, delimiter depends on original content.
          // The delimiter length calculation seems correct based on longest sequence in original content.

          return `${delimiter}${finalContent}${delimiter}`;
        }
        // Code inside pre: Return raw content
        return childrenMarkdown;
      case "pre": {
        const codeChild = element.children.find(
          (c): c is VElement => c.nodeType === "element" && c.tagName === "code"
        );

        // 再帰的にすべてのテキストコンテンツを取得するヘルパー関数
        function getAllTextContent(node: VNode): string {
          if (node.nodeType === "text") {
            return node.textContent;
          }

          if (node.nodeType === "element") {
            // 装飾用のspanなどの要素内のテキストも再帰的に取得
            return (node as VElement).children
              .map((child) => getAllTextContent(child))
              .join("");
          }

          return "";
        }

        // コードブロック内のすべてのテキストを再帰的に取得
        const rawCodeContent = getAllTextContent(codeChild || element);
        // 言語クラスを抽出（language-xxxの形式から言語部分のみを取得）
        let lang = "";
        const classAttr = codeChild?.attributes.class || "";
        const langMatch = classAttr.match(/language-([a-zA-Z0-9_-]+)/);
        if (langMatch && langMatch[1]) {
          lang = langMatch[1];
        }
        // Remove only leading/trailing blank lines/whitespace, keep internal structure
        const cleanedCodeContent = rawCodeContent.replace(/^\s*\n|\s+$/g, "");
        // Ensure newline before closing ```, no trailing newline after ```
        return `\`\`\`${lang}\n${cleanedCodeContent}\n\`\`\``;
      }
      case "blockquote": {
        // Content is already joined with potential spaces. Trim the whole block.
        const content = childrenMarkdown.trim();
        if (!content) return "";
        const lines = content.split("\n");
        const quotedLines = lines.map((line) =>
          line.trim() === "" ? ">" : `> ${line}`
        );
        return quotedLines.join("\n") + "\n\n";
      }
      case "ul":
      case "ol":
        // Process only li children, join results with newline
        const listItems = element.children
          .filter(
            (c): c is VElement => c.nodeType === "element" && c.tagName === "li"
          )
          .map((child, index) =>
            convertNodeToMarkdown(child, tagName, depth + 1, index === 0)
          )
          .filter((item) => item.trim() !== ""); // Filter empty items AFTER processing

        if (listItems.length === 0) return "";
        // Join list items first
        let listContent = listItems.join("\n");
        // Indent the entire list block based on its depth
        const listIndent = "  ".repeat(Math.max(0, depth - 1));
        if (listIndent) {
          listContent = listContent
            .split("\n")
            .map((line) => (line.trim() ? `${listIndent}${line}` : line))
            .join("\n");
        }
        // Add block spacing after the list
        return listContent + "\n\n";

      case "li": {
        // li only handles its marker and content, no indentation here
        const marker = parentTagName === "ol" ? "1." : "-";
        // const contentIndent = "  ".repeat(depth); // No longer needed here

        // Process children, separating main content from nested lists
        const mainContentParts: string[] = [];
        const nestedListParts: string[] = [];

        element.children.forEach((child) => {
          if (
            child.nodeType === "element" &&
            (child.tagName === "ul" || child.tagName === "ol")
          ) {
            const nestedListMd = convertNodeToMarkdown(
              child,
              tagName,
              depth + 1
            );
            // The recursive call to convertNodeToMarkdown handles the indentation
            // based on the increased depth. The ul/ol handler will indent it.
            if (nestedListMd) {
              // Add the raw nested list markdown. Trim trailing newlines.
              nestedListParts.push(nestedListMd.replace(/\n+$/, ""));
            }
          } else {
            // Process text/inline content
            mainContentParts.push(convertNodeToMarkdown(child, tagName, depth));
          }
        });

        // Join the main content parts smartly and trim
        const mainContent = joinMarkdownParts(mainContentParts).trim();

        // Format: Marker + Space + Content
        let result = `${marker} ${mainContent}`;

        // Append nested lists (already processed recursively), ensuring a newline before each
        if (nestedListParts.length > 0) {
          if (mainContent) {
            result += "\n"; // Add newline only if there was main content
          }
          // Join the already correctly indented nested lists.
          result += nestedListParts.join("\n"); // Join with a single newline
        }

        return result; // No trailing newline for li itself
      }
      case "a":
        const href = element.attributes.href || "";
        // Image link: Use raw childrenMarkdown
        if (
          element.children.length === 1 &&
          element.children[0].nodeType === "element" &&
          element.children[0].tagName === "img"
        ) {
          return `[${childrenMarkdown}](${href})`;
        }
        // Regular link: Use raw childrenMarkdown (join handles spacing)
        return `[${childrenMarkdown}](${href})`;
      case "img":
        const alt = escapeMarkdown(element.attributes.alt || "");
        const src = element.attributes.src || "";
        const title = element.attributes.title
          ? ` "${escapeMarkdown(element.attributes.title)}"`
          : "";
        return `![${alt}](${src}${title})`;

      case "hr":
        return "---\n\n";
      case "br":
        return "  \n"; // Keep hard line break

      case "table": {
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

        // Process cell content: Recursively convert, then trim whitespace *within* the cell
        const processCell = (cell: VElement): string => {
          // Pass 'td' or 'th' as parentTagName
          return convertNodeToMarkdown(
            cell,
            cell.tagName.toLowerCase(),
            depth + 1
          ).trim();
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

        // Process body rows
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

        if (headerRow.length > 0) {
          while (headerRow.length < maxColumns) headerRow.push("");
          tableMd += `| ${headerRow.join(" | ")} |\n`;
          tableMd += `| ${separator} |\n`;
        } else if (bodyRows.length > 0 && maxColumns > 0) {
          tableMd += `| ${separator} |\n`;
        }

        bodyRows.forEach((row) => {
          while (row.length < maxColumns) row.push("");
          tableMd += `| ${row.join(" | ")} |\n`;
        });

        return tableMd ? `${tableMd.trim()}\n\n` : "";
      }
      // thead, tbody, tr, th, td are handled within table

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

      // Default: Render children for unknown/other tags.
      // If block-like, trim and add spacing. If inline-like, return as is.
      default:
        if (isBlock) {
          const trimmedDefaultContent = childrenMarkdown.trim();
          return trimmedDefaultContent ? `${trimmedDefaultContent}\n\n` : "";
        } else {
          // Assume inline or unknown, return joined content without extra spacing/trimming
          return childrenMarkdown;
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

  // 3. Remove spaces before newlines? (Optional, might be too aggressive)
  // markdown = markdown.replace(/ +\n/g, '\n');

  // 4. Ensure final string ends with a single newline if not empty
  // if (markdown) markdown += '\n'; // Re-evaluate if this is desired

  return markdown;
}
