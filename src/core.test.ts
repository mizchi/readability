import { test, expect, describe } from "vitest";
import { parseHTML } from "./parser";
import { extractContent, isProbablyContent } from "./core";
import { PageType, type VElement, type VText } from "./types"; // Import ArticleType

// Basic test case
const BASIC_HTML = `
<html>
  <head>
    <title>Test Page</title>
  </head>
  <body>
    <div id="content">
      <h1>Test Article Title</h1>
      <p class="byline">Author: Test Taro</p>
      <p>This is the body of the test article. Used for Readability testing.</p>
      <p>A paragraph with sufficient length of text is required. This paragraph should be detected as the main content.
      In actual articles, it is common to have several such long paragraphs.
      Text length is an important factor in the scoring algorithm.</p>
    </div>
  </body>
</html>
`;

// HTML with very short text, unlikely to be an article
const SHORT_TEXT_HTML = `
<html>
  <body>
    <h1>Too Short</h1>
    <p>This is way too short to be an article.</p>
  </body>
</html>
`;

// HTML using semantic tags
const SEMANTIC_HTML = `
<html>
  <head>
    <title>Semantic Tag Test</title>
  </head>
  <body>
    <header>
      <h1>Website Header</h1>
      <nav>
        <ul>
          <li><a href="#">Home</a></li>
          <li><a href="#">About</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <article>
        <h1>Article Title</h1>
        <p>This is the body of the article. Using semantic tags.</p>
        <p>This paragraph is inside the article tag and should be detected as the main content.
        Having sufficient length of text allows the scoring algorithm to
        recognize it as important content.</p>
      </article>
    </main>
    <footer>
      <p>Copyright 2025</p>
    </footer>
  </body>
</html>
`;

// Complex HTML with multiple candidates
const COMPLEX_HTML = `
<html>
  <head>
    <title>Complex Layout</title>
  </head>
  <body>
    <header class="site-header">
      <h1>News Site</h1>
      <nav>Menu items go here</nav>
    </header>
    <div class="container">
      <div class="sidebar">
        <div class="widget">
          <h3>Related Articles</h3>
          <ul>
            <li><a href="#">Article 1</a></li>
            <li><a href="#">Article 2</a></li>
          </ul>
        </div>
      </div>
      <div class="content">
        <h1>Main Content Title</h1>
        <div class="meta">
          <span class="author">Author: Content Creator</span>
          <span class="date">March 25, 2025</span>
        </div>
        <p>This is the first paragraph of the main content. This part should be detected as the main content.</p>
        <p>This is the second paragraph. Having sufficient length of text allows the scoring algorithm to
        recognize it as important content. In actual articles, it is common to have several such long paragraphs.
        Text length is an important factor in the scoring algorithm.</p>
        <p>There is also a third paragraph. Having multiple paragraphs increases the score of this div element.</p>
      </div>
      <div class="comments">
        <h3>Comments</h3>
        <div class="comment">
          <p>This is a comment on the article. It might be a long comment, but it's not the main content.
          The comment section should usually be excluded from the main content.</p>
        </div>
      </div>
    </div>
    <footer>
      <p>Footer information goes here</p>
    </footer>
  </body>
</html>
`;

// HTML with high link density
const HIGH_LINK_DENSITY_HTML = `
<html>
  <body>
    <div class="navigation">
      <a href="#">Link 1</a>
      <a href="#">Link 2</a>
      <a href="#">Link 3</a>
      <a href="#">Link 4</a>
      <a href="#">Link 5</a>
      <span>Just a little text</span>
    </div>
    <div class="content">
      <p>This is the main content. There are almost no links.</p>
      <p>A paragraph with sufficient length of text is required. This paragraph should be detected as the main content.
      In actual articles, it is common to have several such long paragraphs.
      Text length is an important factor in the scoring algorithm.</p>
      <a href="#">Reference Link</a>
    </div>
  </body>
</html>
`;

// HTML with clear header/footer but short main content
const SHORT_ARTICLE_WITH_STRUCTURE_HTML = `
<html>
  <head>
    <title>Short Article Test</title>
  </head>
  <body>
    <header id="page-header" role="banner">
      <h1>Website Title</h1>
      <nav>Menu</nav>
    </header>
    <main>
      <article>
        <h1>Short Article</h1>
        <p>This content is too short to pass the threshold.</p>
      </article>
    </main>
    <aside>Related links</aside>
    <footer id="page-footer" role="contentinfo">
      <p>Copyright Info</p>
    </footer>
  </body>
</html>
`;

// HTML with only header/footer, no main/article tag
const NO_MAIN_CONTENT_HTML = `
<html>
  <head>
    <title>No Main Content</title>
  </head>
  <body>
    <div class="header-class">
      <h1>Site Header</h1>
    </div>
    <p>Some random text, but not enough.</p>
    <div class="footer-class">
      <p>Footer Text</p>
    </div>
  </body>
</html>
`;

describe("Core Readability Functions", () => {
  test("isProbablyContent - Determine content probability", () => {
    // Test by creating content elements directly
    const longText = `This is a paragraph with sufficient length of text. This paragraph should be detected as the main content.
    In actual articles, it is common to have several such long paragraphs.
    Text length is an important factor in the scoring algorithm.
    This paragraph is over 140 characters long and has low link density, so it should be detected as content.`;

    const longParagraph: VElement = {
      nodeType: "element",
      tagName: "p", // Lowercase
      attributes: {},
      children: [
        {
          nodeType: "text",
          textContent: longText,
          parent: undefined,
        },
      ],
      className: "content",
    };

    // Paragraphs with long text are likely content
    expect(isProbablyContent(longParagraph)).toBe(true);

    // Header element with short text
    const header: VElement = {
      nodeType: "element",
      tagName: "h1", // Lowercase
      attributes: {},
      children: [
        {
          nodeType: "text",
          textContent: "Short header text",
          parent: undefined,
        },
      ],
    };

    // Headers have short text, so less likely to be content
    expect(isProbablyContent(header)).toBe(false);
  });

  test("isProbablyContent - Element with high link density", () => {
    const doc = parseHTML(HIGH_LINK_DENSITY_HTML);

    // Navigation element with high link density
    const navigation = doc.body.children.find(
      (child): child is VElement =>
        child.nodeType === "element" && child.className === "navigation"
    );

    // Normal content element
    const content = doc.body.children.find(
      (child): child is VElement =>
        child.nodeType === "element" && child.className === "content"
    );

    if (navigation && navigation.nodeType === "element") {
      // High link density, so less likely to be content
      expect(isProbablyContent(navigation)).toBe(false);
    }

    if (content && content.nodeType === "element") {
      // Low link density, so likely to be content
      expect(isProbablyContent(content)).toBe(true);
    }
  });

  test("extractContent - Basic HTML", () => {
    const doc = parseHTML(BASIC_HTML);
    // Use a lower threshold for this test case as the sample text is short
    const result = extractContent(doc, { charThreshold: 100 });

    // Check if content is extracted
    expect(result.root).not.toBeNull();

    // Check if node count is calculated
    expect(result.nodeCount).toBeGreaterThan(0);

    // Check article type
    expect(result.pageType).toBe(PageType.ARTICLE);

    // Check if extracted content includes test article text
    if (result.root) {
      const contentText = result.root.children
        .filter(
          (child): child is VElement =>
            child.nodeType === "element" && child.tagName === "p" // Lowercase
        )
        .map((p: VElement) =>
          p.children
            .filter((c): c is VText => c.nodeType === "text")
            .map((t: VText) => t.textContent)
            .join("")
        )
        .join("");

      expect(contentText).toContain("This is the body of the test article");
    }
  });

  test("extractContent - Semantic tags", () => {
    const doc = parseHTML(SEMANTIC_HTML);
    // Use a lower threshold for this test case as the sample text is short
    const result = extractContent(doc, { charThreshold: 100 });

    // Check if content is extracted
    expect(result.root).not.toBeNull();

    // Check if node count is calculated
    expect(result.nodeCount).toBeGreaterThan(0);

    // Check article type
    expect(result.pageType).toBe(PageType.ARTICLE);

    // Check if extracted content includes text within the article tag
    if (result.root) {
      const isArticleOrContainsArticle =
        result.root.tagName === "article" || // Lowercase
        result.root.children.some(
          (child): boolean =>
            child.nodeType === "element" && child.tagName === "article" // Lowercase
        );

      expect(isArticleOrContainsArticle).toBe(true);
    }
  });

  test("extractContent - Complex HTML", () => {
    const doc = parseHTML(COMPLEX_HTML);
    const result = extractContent(doc);

    // Check if content is extracted
    expect(result.root).not.toBeNull();

    // Check if node count is calculated
    expect(result.nodeCount).toBeGreaterThan(0);

    // Check article type
    expect(result.pageType).toBe(PageType.ARTICLE);

    // Check if extracted content includes main content text
    if (result.root) {
      // Check if the element with class 'content' or its parent is selected
      const contentOrParentOfContent =
        result.root.className === "content" ||
        result.root.children.some(
          (child): boolean =>
            child.nodeType === "element" && child.className === "content"
        );

      expect(contentOrParentOfContent).toBe(true);
    }
  });

  test("extractContent - Short text (should be OTHER)", () => {
    const doc = parseHTML(SHORT_TEXT_HTML);
    // Override default threshold for this test if needed, or rely on default
    const result = extractContent(doc, { charThreshold: 500 }); // Use default or adjust

    // Check article type - should be OTHER because content is too short
    expect(result.pageType).toBe(PageType.OTHER);

    // Check if content is null due to threshold
    expect(result.root).toBeNull();
    expect(result.nodeCount).toBe(0);
    // Structural elements should not be populated for OTHER type
    expect(result.header).toBeUndefined();
    expect(result.footer).toBeUndefined();
    expect(result.otherSignificantNodes).toBeUndefined();
  });

  test.skip("extractContent - Short article with structure (ARTICLE, root=null, structure populated)", () => {
    const doc = parseHTML(SHORT_ARTICLE_WITH_STRUCTURE_HTML);
    // Use a threshold that the main content won't pass
    const result = extractContent(doc, { charThreshold: 500 });

    // Check article type - should be ARTICLE because a candidate was found and deemed probable
    expect(result.pageType).toBe(PageType.ARTICLE);

    // Check if content is null due to threshold
    expect(result.root).toBeNull();
    expect(result.nodeCount).toBe(0);

    // Check if structural elements are populated
    expect(result.header).not.toBeNull();
    expect(result.header?.tagName).toBe("header");
    expect(result.header?.id).toBe("page-header");

    expect(result.footer).not.toBeNull();
    expect(result.footer?.tagName).toBe("footer");
    expect(result.footer?.id).toBe("page-footer");

    expect(result.otherSignificantNodes).not.toBeUndefined();
    expect(result.otherSignificantNodes?.length).toBeGreaterThan(0);
    // Check if <main> or <article> was detected as significant
    const significantTagNames = result.otherSignificantNodes?.map(
      (n) => n.tagName
    );
    expect(significantTagNames).toContain("main");
    expect(significantTagNames).toContain("article");
  });

  test("extractContent - No real main content (OTHER, root=null)", () => {
    const doc = parseHTML(NO_MAIN_CONTENT_HTML);
    const result = extractContent(doc, { charThreshold: 500 });

    // Check article type - should be OTHER as no strong candidate likely found
    expect(result.pageType).toBe(PageType.OTHER);

    // Check if content is null
    expect(result.root).toBeNull();
    expect(result.nodeCount).toBe(0);

    // Structural elements might be found by findStructuralElements, but pageType is OTHER
    // Depending on strictness, we might expect them to be undefined if pageType is OTHER.
    // Let's assume for now they are *not* populated if the final type is OTHER.
    expect(result.header).toBeUndefined();
    expect(result.footer).toBeUndefined();
    expect(result.otherSignificantNodes).toBeUndefined();

    // Alternative check: If findStructuralElements *is* called even for OTHER (less likely based on current core.ts logic)
    // then we might check if header/footer *were* found, e.g.:
    // expect(findStructuralElements(doc).header).not.toBeNull(); // This tests findStructuralElements directly
  });
});
