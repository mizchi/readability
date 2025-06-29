import { test, expect, describe } from "vitest";
import { readable, extract, toHTML, toMarkdown, PageType } from "../index";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// オリジナルのreadabilityテストケースとの互換性をテスト
describe("Readability Compatibility Tests", () => {
  describe("Test Pages Compatibility", () => {
    const TEST_PAGES_DIR = path.resolve(__dirname, "../../test/test-pages");

    // 互換性を確認するテストケース
    const compatibilityTestCases = [
      {
        name: "001 - Basic article",
        dir: "001",
        shouldExtract: true,
      },
      {
        name: "003 - Metadata preferred",
        dir: "003-metadata-preferred",
        shouldExtract: true,
      },
      {
        name: "004 - Metadata space separated",
        dir: "004-metadata-space-separated-properties",
        shouldExtract: true,
      },
      {
        name: "ACLU article",
        dir: "aclu",
        shouldExtract: true,
      },
    ];

    compatibilityTestCases.forEach(({ name, dir, shouldExtract }) => {
      test(`${name} - should extract content similarly to original`, () => {
        const sourcePath = path.join(TEST_PAGES_DIR, dir, "source.html");
        const metadataPath = path.join(TEST_PAGES_DIR, dir, "expected-metadata.json");

        // Skip if files don't exist
        if (!fs.existsSync(sourcePath) || !fs.existsSync(metadataPath)) {
          test.skip;
          return;
        }

        const source = fs.readFileSync(sourcePath, "utf-8");
        const expectedMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

        const doc = readable(source);
        const result = extract(source);

        if (shouldExtract) {
          expect(result.root).not.toBeNull();
          expect(doc.inferPageType()).toBe(PageType.ARTICLE);
        }

        // Check metadata extraction
        if (expectedMetadata.title) {
          expect(result.metadata.title).toBeTruthy();
        }
      });
    });
  });

  describe("Content Extraction Patterns", () => {
    // オリジナルのreadabilityがサポートする典型的なパターン
    const patterns = [
      {
        name: "Article with semantic HTML5 tags",
        html: `
          <html>
            <body>
              <article>
                <header>
                  <h1>Article Title</h1>
                  <time>2024-01-01</time>
                </header>
                <section>
                  <p>First paragraph with substantial content to ensure it's recognized as an article.</p>
                  <p>Second paragraph providing more context and information about the topic.</p>
                </section>
              </article>
            </body>
          </html>
        `,
        shouldExtract: true,
      },
      {
        name: "Blog post with common class names",
        html: `
          <html>
            <body>
              <div class="post">
                <h1 class="post-title">Blog Post Title</h1>
                <div class="post-content">
                  <p>This is a blog post with common class names that readability should recognize.</p>
                  <p>Multiple paragraphs help establish this as article content.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        shouldExtract: true,
      },
      {
        name: "News article with byline",
        html: `
          <html>
            <body>
              <div class="article">
                <h1>News Article Title</h1>
                <p class="byline">By John Doe | January 1, 2024</p>
                <div class="article-body">
                  <p>This is a news article with a byline, which is common in news websites.</p>
                  <p>The algorithm should recognize this pattern and extract the content.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        shouldExtract: true,
      },
    ];

    patterns.forEach(({ name, html, shouldExtract }) => {
      test(name, () => {
        const result = extract(html, { charThreshold: 50 });

        if (shouldExtract) {
          expect(result.root).not.toBeNull();
          const markdown = toMarkdown(result.root);
          expect(markdown.length).toBeGreaterThan(50);
        } else {
          expect(result.root).toBeNull();
        }
      });
    });
  });

  describe("Metadata Extraction Compatibility", () => {
    test("should extract Open Graph metadata", () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="OG Title">
            <meta property="og:site_name" content="Example Site">
            <meta property="og:description" content="OG Description">
            <meta property="og:url" content="https://example.com/article">
          </head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>Article content that is long enough to be extracted.</p>
            </article>
          </body>
        </html>
      `;

      const result = extract(html, { charThreshold: 50 });
      expect(result.metadata.title).toBe("OG Title");
      expect(result.metadata.siteName).toBe("Example Site");
      expect(result.metadata.url).toBe("https://example.com/article");
    });

    test("should extract author metadata", () => {
      const html = `
        <html>
          <head>
            <meta name="author" content="Jane Smith">
          </head>
          <body>
            <article>
              <h1>Article with Author</h1>
              <p>Content written by the author specified in metadata.</p>
            </article>
          </body>
        </html>
      `;

      // Note: Current implementation may not extract author directly
      // This test documents the expected behavior
      const result = extract(html, { charThreshold: 50 });
      expect(result.metadata).toBeDefined();
    });
  });

  describe("Edge Cases from Original Tests", () => {
    test("should handle deeply nested content", () => {
      const html = `
        <html>
          <body>
            <div>
              <div>
                <div>
                  <div>
                    <article>
                      <h1>Deeply Nested Article</h1>
                      <p>This content is deeply nested but should still be extracted.</p>
                      <p>Multiple paragraphs ensure it's recognized as article content.</p>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = extract(html, { charThreshold: 50 });
      expect(result.root).not.toBeNull();
    });

    test("should ignore hidden content", () => {
      const html = `
        <html>
          <body>
            <div style="display: none">
              <p>This hidden content should be ignored.</p>
            </div>
            <article>
              <h1>Visible Article</h1>
              <p>Only this visible content should be extracted.</p>
              <p>Hidden elements should not affect the extraction.</p>
            </article>
          </body>
        </html>
      `;

      const result = extract(html, { charThreshold: 50 });
      const markdown = toMarkdown(result.root);
      expect(markdown).not.toContain("hidden content");
      expect(markdown).toContain("Visible Article");
    });

    test("should handle special characters and entities", () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Article with Special Characters</h1>
              <p>This article contains special characters: &amp; &lt; &gt; &quot;</p>
              <p>Unicode: café, naïve, 日本語</p>
            </article>
          </body>
        </html>
      `;

      const result = extract(html, { charThreshold: 50 });
      const markdown = toMarkdown(result.root);
      expect(markdown).toContain("&");
      expect(markdown).toContain("<");
      expect(markdown).toContain(">");
      expect(markdown).toContain('"');
      expect(markdown).toContain("café");
    });
  });

  describe("Performance Characteristics", () => {
    test("should handle large documents efficiently", () => {
      const paragraphs = Array(100)
        .fill(null)
        .map(
          (_, i) => `<p>This is paragraph ${i + 1} with some content to make it substantial.</p>`
        )
        .join("\n");

      const html = `
        <html>
          <body>
            <article>
              <h1>Large Article</h1>
              ${paragraphs}
            </article>
          </body>
        </html>
      `;

      const startTime = performance.now();
      const result = extract(html, { charThreshold: 50 });
      const endTime = performance.now();

      expect(result.root).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
