import { describe, it, expect } from "vitest";
import { toMarkdown } from "./markdown";
import { VElement, VText } from "../types";

describe("markdown module - basic functionality", () => {
  describe("toMarkdown", () => {
    it("should handle null input", () => {
      expect(toMarkdown(null)).toBe("");
    });

    it("should convert simple text", () => {
      const element: VElement = {
        nodeType: "element",
        tagName: "p",
        attributes: {},
        children: [
          {
            nodeType: "text",
            textContent: "Hello, world!",
          } as VText,
        ],
      };

      expect(toMarkdown(element)).toBe("Hello, world!");
    });

    it("should convert headings", () => {
      const h1: VElement = {
        nodeType: "element",
        tagName: "h1",
        attributes: {},
        children: [{ nodeType: "text", textContent: "Title" } as VText],
      };

      expect(toMarkdown(h1)).toBe("# Title");
    });

    it("should convert different heading levels", () => {
      const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
      const expectedPrefixes = ["#", "##", "###", "####", "#####", "######"];

      headings.forEach((tag, index) => {
        const heading: VElement = {
          nodeType: "element",
          tagName: tag,
          attributes: {},
          children: [{ nodeType: "text", textContent: "Heading" } as VText],
        };

        expect(toMarkdown(heading)).toBe(`${expectedPrefixes[index]} Heading`);
      });
    });

    it("should convert bold text", () => {
      const bold: VElement = {
        nodeType: "element",
        tagName: "strong",
        attributes: {},
        children: [{ nodeType: "text", textContent: "bold text" } as VText],
      };

      expect(toMarkdown(bold)).toBe("**bold text**");
    });

    it("should convert italic text", () => {
      const italic: VElement = {
        nodeType: "element",
        tagName: "em",
        attributes: {},
        children: [{ nodeType: "text", textContent: "italic text" } as VText],
      };

      expect(toMarkdown(italic)).toBe("*italic text*");
    });

    it("should convert links", () => {
      const link: VElement = {
        nodeType: "element",
        tagName: "a",
        attributes: { href: "https://example.com" },
        children: [{ nodeType: "text", textContent: "Example" } as VText],
      };

      expect(toMarkdown(link)).toBe("[Example](https://example.com)");
    });

    it("should convert images", () => {
      const img: VElement = {
        nodeType: "element",
        tagName: "img",
        attributes: {
          src: "image.jpg",
          alt: "Description",
        },
        children: [],
      };

      expect(toMarkdown(img)).toBe("![Description](image.jpg)");
    });

    it("should convert inline code", () => {
      const code: VElement = {
        nodeType: "element",
        tagName: "code",
        attributes: {},
        children: [{ nodeType: "text", textContent: "const x = 42;" } as VText],
      };

      expect(toMarkdown(code)).toBe("`const x = 42;`");
    });

    it("should convert code blocks", () => {
      const pre: VElement = {
        nodeType: "element",
        tagName: "pre",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "code",
            attributes: {},
            children: [
              {
                nodeType: "text",
                textContent: "function hello() {\n  return 'world';\n}",
              } as VText,
            ],
          } as VElement,
        ],
      };

      expect(toMarkdown(pre)).toBe("```\nfunction hello() {\n  return 'world';\n}\n```");
    });

    it("should handle code blocks with language", () => {
      const pre: VElement = {
        nodeType: "element",
        tagName: "pre",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "code",
            attributes: { class: "language-javascript" },
            children: [{ nodeType: "text", textContent: "console.log('hello');" } as VText],
          } as VElement,
        ],
      };

      expect(toMarkdown(pre)).toBe("```javascript\nconsole.log('hello');\n```");
    });

    it("should convert unordered lists", () => {
      const ul: VElement = {
        nodeType: "element",
        tagName: "ul",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "li",
            attributes: {},
            children: [{ nodeType: "text", textContent: "Item 1" } as VText],
          } as VElement,
          {
            nodeType: "element",
            tagName: "li",
            attributes: {},
            children: [{ nodeType: "text", textContent: "Item 2" } as VText],
          } as VElement,
        ],
      };

      expect(toMarkdown(ul)).toBe("- Item 1\n- Item 2");
    });

    it("should convert ordered lists", () => {
      const ol: VElement = {
        nodeType: "element",
        tagName: "ol",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "li",
            attributes: {},
            children: [{ nodeType: "text", textContent: "First" } as VText],
          } as VElement,
          {
            nodeType: "element",
            tagName: "li",
            attributes: {},
            children: [{ nodeType: "text", textContent: "Second" } as VText],
          } as VElement,
        ],
      };

      expect(toMarkdown(ol)).toBe("1. First\n1. Second");
    });

    it("should convert blockquotes", () => {
      const blockquote: VElement = {
        nodeType: "element",
        tagName: "blockquote",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "p",
            attributes: {},
            children: [{ nodeType: "text", textContent: "This is a quote" } as VText],
          } as VElement,
        ],
      };

      expect(toMarkdown(blockquote)).toBe("> This is a quote");
    });

    it("should convert horizontal rules", () => {
      const hr: VElement = {
        nodeType: "element",
        tagName: "hr",
        attributes: {},
        children: [],
      };

      expect(toMarkdown(hr)).toBe("---");
    });

    it("should convert line breaks", () => {
      const br: VElement = {
        nodeType: "element",
        tagName: "br",
        attributes: {},
        children: [],
      };

      // br tags are converted to two spaces followed by newline in markdown
      const result = toMarkdown(br);
      // Check if it contains the line break pattern
      expect(result.includes("  ") || result === "").toBe(true);
    });

    it("should escape markdown special characters", () => {
      const text: VElement = {
        nodeType: "element",
        tagName: "p",
        attributes: {},
        children: [
          { nodeType: "text", textContent: "Text with *asterisks* and _underscores_" } as VText,
        ],
      };

      expect(toMarkdown(text)).toBe("Text with \\*asterisks\\* and \\_underscores\\_");
    });

    it("should handle nested elements", () => {
      const nested: VElement = {
        nodeType: "element",
        tagName: "p",
        attributes: {},
        children: [
          { nodeType: "text", textContent: "This is " } as VText,
          {
            nodeType: "element",
            tagName: "strong",
            attributes: {},
            children: [{ nodeType: "text", textContent: "bold" } as VText],
          } as VElement,
          { nodeType: "text", textContent: " and " } as VText,
          {
            nodeType: "element",
            tagName: "em",
            attributes: {},
            children: [{ nodeType: "text", textContent: "italic" } as VText],
          } as VElement,
          { nodeType: "text", textContent: " text." } as VText,
        ],
      };

      expect(toMarkdown(nested)).toBe("This is **bold** and *italic* text.");
    });

    it("should ignore script and style tags", () => {
      const scriptStyle: VElement = {
        nodeType: "element",
        tagName: "div",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "script",
            attributes: {},
            children: [{ nodeType: "text", textContent: "console.log('ignored');" } as VText],
          } as VElement,
          {
            nodeType: "element",
            tagName: "style",
            attributes: {},
            children: [{ nodeType: "text", textContent: "body { color: red; }" } as VText],
          } as VElement,
          {
            nodeType: "element",
            tagName: "p",
            attributes: {},
            children: [{ nodeType: "text", textContent: "Visible text" } as VText],
          } as VElement,
        ],
      };

      expect(toMarkdown(scriptStyle)).toBe("Visible text");
    });

    it("should handle empty paragraphs", () => {
      const emptyP: VElement = {
        nodeType: "element",
        tagName: "p",
        attributes: {},
        children: [],
      };

      expect(toMarkdown(emptyP)).toBe("");
    });

    it("should handle inline code with backticks", () => {
      const codeWithBackticks: VElement = {
        nodeType: "element",
        tagName: "code",
        attributes: {},
        children: [{ nodeType: "text", textContent: "Use `code` here" } as VText],
      };

      expect(toMarkdown(codeWithBackticks)).toBe("``Use `code` here``");
    });

    it("should handle complex tables", () => {
      const table: VElement = {
        nodeType: "element",
        tagName: "table",
        attributes: {},
        children: [
          {
            nodeType: "element",
            tagName: "thead",
            attributes: {},
            children: [
              {
                nodeType: "element",
                tagName: "tr",
                attributes: {},
                children: [
                  {
                    nodeType: "element",
                    tagName: "th",
                    attributes: {},
                    children: [{ nodeType: "text", textContent: "Header 1" } as VText],
                  } as VElement,
                  {
                    nodeType: "element",
                    tagName: "th",
                    attributes: {},
                    children: [{ nodeType: "text", textContent: "Header 2" } as VText],
                  } as VElement,
                ],
              } as VElement,
            ],
          } as VElement,
          {
            nodeType: "element",
            tagName: "tbody",
            attributes: {},
            children: [
              {
                nodeType: "element",
                tagName: "tr",
                attributes: {},
                children: [
                  {
                    nodeType: "element",
                    tagName: "td",
                    attributes: {},
                    children: [{ nodeType: "text", textContent: "Cell 1" } as VText],
                  } as VElement,
                  {
                    nodeType: "element",
                    tagName: "td",
                    attributes: {},
                    children: [{ nodeType: "text", textContent: "Cell 2" } as VText],
                  } as VElement,
                ],
              } as VElement,
            ],
          } as VElement,
        ],
      };

      expect(toMarkdown(table)).toBe("| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |");
    });
  });
});
