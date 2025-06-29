import { test, expect, describe } from "vitest";
import { readable, PageType, extract, extractAriaTree, toMarkdown, toHTML } from "../index";

// 基本的なテストケース
describe("Readability Core Tests", () => {
  describe("Basic Article Extraction", () => {
    const BASIC_ARTICLE_HTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Article - Sample Blog</title>
          <meta name="author" content="John Doe">
        </head>
        <body>
          <header>
            <h1>My Blog</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </header>
          <main>
            <article>
              <h1>Test Article Title</h1>
              <p class="byline">By John Doe | January 1, 2024</p>
              <p>This is the first paragraph of the article. It contains enough text to be considered meaningful content by the extraction algorithm.</p>
              <p>The second paragraph provides additional context and information. Having multiple paragraphs helps the algorithm identify this as the main content of the page.</p>
              <p>A third paragraph ensures that the content is substantial enough to be recognized as an article rather than a navigation page or other non-article content.</p>
            </article>
          </main>
          <footer>
            <p>&copy; 2024 Sample Blog</p>
          </footer>
        </body>
      </html>
    `;

    test("should extract article content using readable()", () => {
      const doc = readable(BASIC_ARTICLE_HTML);
      
      expect(doc.inferPageType()).toBe(PageType.ARTICLE);
      expect(doc.snapshot.root).not.toBeNull();
      
      const markdown = doc.toMarkdown();
      expect(markdown).toContain("Test Article Title");
      expect(markdown).toContain("first paragraph");
      expect(markdown).toContain("second paragraph");
    });

    test("should extract metadata correctly", () => {
      const doc = readable(BASIC_ARTICLE_HTML);
      
      expect(doc.snapshot.metadata.title).toBe("Test Article - Sample Blog");
      expect(doc.snapshot.metadata.siteName).toBeUndefined(); // No og:site_name in this example
    });

    test("should serialize and deserialize correctly", () => {
      const doc = readable(BASIC_ARTICLE_HTML);
      const serialized = doc.serialize();
      
      const Readable = doc.constructor as any;
      const doc2 = Readable.load(serialized);
      expect(doc2.inferPageType()).toBe(PageType.ARTICLE);
      expect(doc2.toMarkdown()).toBe(doc.toMarkdown());
    });
  });

  describe("Non-Article Detection", () => {
    const NAVIGATION_PAGE_HTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Listing</title>
        </head>
        <body>
          <h1>Our Products</h1>
          <div class="products">
            <div class="product-card">
              <h2><a href="/product/1">Product 1</a></h2>
              <p>Short description</p>
            </div>
            <div class="product-card">
              <h2><a href="/product/2">Product 2</a></h2>
              <p>Short description</p>
            </div>
            <div class="product-card">
              <h2><a href="/product/3">Product 3</a></h2>
              <p>Short description</p>
            </div>
          </div>
        </body>
      </html>
    `;

    test("should detect navigation/listing pages", () => {
      const doc = readable(NAVIGATION_PAGE_HTML);
      expect(doc.inferPageType()).toBe(PageType.OTHER);
    });
  });

  describe("Extract Function Tests", () => {
    const TEST_HTML = `
      <html>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>This is a test article with some content that should be extracted by the readability algorithm.</p>
          </article>
        </body>
      </html>
    `;

    test("should extract content using extract()", () => {
      const result = extract(TEST_HTML, { charThreshold: 50 });
      
      expect(result.root).not.toBeNull();
      expect(result.metadata.title).toBe("");
      expect(result.links.length).toBe(0);
    });

    test("should extract ARIA tree", () => {
      const ariaTree = extractAriaTree(TEST_HTML);
      
      expect(ariaTree).toBeDefined();
      expect(ariaTree.root).toBeDefined();
      expect(ariaTree.nodeCount).toBeGreaterThan(0);
    });
  });

  describe("Content Formatting", () => {
    const FORMATTED_CONTENT_HTML = `
      <html>
        <body>
          <article>
            <h1>Formatting Test</h1>
            <h2>Subheading</h2>
            <p>Regular paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
            <ul>
              <li>List item 1</li>
              <li>List item 2</li>
            </ul>
            <blockquote>
              <p>This is a quote.</p>
            </blockquote>
            <pre><code>const code = "example";</code></pre>
          </article>
        </body>
      </html>
    `;

    test("should convert to Markdown correctly", () => {
      const result = extract(FORMATTED_CONTENT_HTML, { charThreshold: 50 });
      const markdown = toMarkdown(result.root);
      
      expect(markdown).toContain("# Formatting Test");
      expect(markdown).toContain("## Subheading");
      expect(markdown).toContain("**bold**");
      expect(markdown).toContain("*italic*");
      expect(markdown).toContain("- List item 1");
      expect(markdown).toContain("> This is a quote.");
      expect(markdown).toContain("```");
      expect(markdown).toContain('const code = "example";');
    });

    test("should convert to HTML correctly", () => {
      const result = extract(FORMATTED_CONTENT_HTML, { charThreshold: 50 });
      const html = toHTML(result.root);
      
      expect(html).toContain("<h1>Formatting Test</h1>");
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
      expect(html).toContain("<ul>");
      expect(html).toContain("<blockquote>");
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty HTML", () => {
      const doc = readable("<html><body></body></html>");
      expect(doc.inferPageType()).toBe(PageType.OTHER);
      expect(doc.snapshot.root).toBeNull();
    });

    test("should handle malformed HTML", () => {
      const doc = readable("<p>Unclosed paragraph");
      expect(doc.snapshot).toBeDefined();
    });

    test("should handle HTML fragments", () => {
      const doc = readable("<div><p>Just a fragment</p></div>");
      expect(doc.snapshot).toBeDefined();
    });
  });

  describe("Link Hierarchy Analysis", () => {
    const HTML_WITH_LINKS = `
      <html>
        <head>
          <meta property="og:url" content="https://example.com/articles/test">
        </head>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/articles">Articles</a>
            <a href="/articles/test">Current Page</a>
          </nav>
          <article>
            <h1>Test Article</h1>
            <p>Content with <a href="/articles/test/section1">internal link</a> and 
               <a href="https://external.com">external link</a>.</p>
          </article>
        </body>
      </html>
    `;

    test("should analyze link hierarchy", () => {
      const doc = readable(HTML_WITH_LINKS);
      const hierarchy = doc.getLinkHierarchy();
      
      expect(hierarchy.parent.length).toBeGreaterThan(0);
      expect(hierarchy.external.length).toBeGreaterThan(0);
      expect(hierarchy.child.length).toBeGreaterThan(0);
    });
  });

  describe("Character Threshold Tests", () => {
    const SHORT_CONTENT = `
      <html>
        <body>
          <article>
            <h1>Short</h1>
            <p>Too short.</p>
          </article>
        </body>
      </html>
    `;

    const LONG_CONTENT = `
      <html>
        <body>
          <article>
            <h1>Long Article</h1>
            <p>${"This is a long paragraph. ".repeat(50)}</p>
          </article>
        </body>
      </html>
    `;

    test("should respect character threshold", () => {
      const shortDoc = readable(SHORT_CONTENT, { charThreshold: 500 });
      expect(shortDoc.inferPageType()).toBe(PageType.OTHER);

      const longDoc = readable(LONG_CONTENT, { charThreshold: 100 });
      expect(longDoc.inferPageType()).toBe(PageType.ARTICLE);
    });
  });
});