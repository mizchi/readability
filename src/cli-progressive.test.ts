import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

describe("CLI Progressive Analysis", () => {
  const cliPath = path.join(process.cwd(), "cli.js");
  const testHtmlPath = path.join(process.cwd(), "test-progressive.html");

  beforeAll(() => {
    // Create a test HTML file with enough content to pass default threshold
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Article</title>
        </head>
        <body>
          <header>
            <nav class="main-nav">
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/blog">Blog</a>
            </nav>
          </header>
          
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <span>></span>
            <a href="/blog">Blog</a>
            <span>></span>
            <span>Test Article</span>
          </nav>
          
          <main>
            <article>
              <h1>Test Article Title</h1>
              <p>This is the introduction paragraph with enough content to ensure proper extraction. 
                 We need to have sufficient text to pass the character threshold that the readability 
                 algorithm uses to determine if content is worth extracting. This helps ensure that
                 our test cases work properly with the default settings.</p>
              
              <nav class="toc">
                <h2>Table of Contents</h2>
                <ul>
                  <li><a href="#section1">Section 1</a></li>
                  <li><a href="#section2">Section 2</a></li>
                </ul>
              </nav>
              
              <h2 id="section1">Section 1</h2>
              <p>Content of section 1 with additional text to ensure we have enough content. 
                 This paragraph contains multiple sentences to help reach the character threshold 
                 required for extraction. We want to make sure the content is substantial enough
                 to be considered meaningful by the extraction algorithm.</p>
              
              <h2 id="section2">Section 2</h2>
              <p>Content of section 2 also needs to be longer to contribute to the overall 
                 character count. This ensures that our test content is realistic and will 
                 be properly extracted by the readability algorithm. Having multiple paragraphs
                 with substantial content helps test the full functionality.</p>
            </article>
          </main>
          
          <aside class="sidebar">
            <h3>Related Articles</h3>
            <ul>
              <li><a href="/article1">Article 1</a></li>
              <li><a href="/article2">Article 2</a></li>
            </ul>
          </aside>
          
          <footer>
            <p>&copy; 2024 Test Site</p>
          </footer>
        </body>
      </html>
    `;
    fs.writeFileSync(testHtmlPath, testHtml);
  });

  describe("Structure Analysis", () => {
    it("should analyze page structure without extracting content", async () => {
      const { stdout } = await execAsync(`node ${cliPath} --analyze-structure ${testHtmlPath}`);
      const analysis = JSON.parse(stdout);

      expect(analysis.url).toBe(testHtmlPath);
      expect(analysis.pageType).toBe("article");
      expect(analysis.hasMainContent).toBe(true);

      // Check navigation detection
      expect(analysis.navigations.global).toBe(true);
      expect(analysis.navigations.breadcrumb).toBe(true);
      expect(analysis.navigations.toc).toBe(true);
      expect(analysis.navigations.sidebar).toBe(false); // No sidebar nav detected, only a sidebar area

      // Check content areas
      expect(analysis.contentAreas.header).toBe(true);
      expect(analysis.contentAreas.mainContent).toBe(true);
      expect(analysis.contentAreas.sidebar).toBe(true);
      expect(analysis.contentAreas.footer).toBe(true);

      // Check stats
      expect(analysis.stats.navigationCount).toBeGreaterThan(2);
      expect(analysis.stats.headerCount).toBeGreaterThan(0);
    });
  });

  describe("Navigation Extraction", () => {
    it("should extract navigation with --extract-nav", async () => {
      const { stdout } = await execAsync(`node ${cliPath} --extract-nav ${testHtmlPath}`);
      const result = JSON.parse(stdout);

      expect(result.url).toBe(testHtmlPath);
      expect(result.navigations).toBeDefined();
      expect(result.navigations.length).toBeGreaterThan(2);

      // Check navigation types
      const navTypes = result.navigations.map((n) => n.type);
      expect(navTypes).toContain("global");
      expect(navTypes).toContain("breadcrumb");
      expect(navTypes).toContain("toc");
    });

    it("should maintain backward compatibility with --nav-only", async () => {
      const navOnlyResult = await execAsync(`node ${cliPath} --nav-only ${testHtmlPath}`);
      const extractNavResult = await execAsync(`node ${cliPath} --extract-nav ${testHtmlPath}`);

      // Both should produce similar output
      expect(JSON.parse(navOnlyResult.stdout).navigations.length).toBe(
        JSON.parse(extractNavResult.stdout).navigations.length
      );
    });
  });

  describe("Content Extraction with Context", () => {
    it("should extract content with context when --with-context is used", async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} --extract-content --with-context ${testHtmlPath}`
      );
      const result = JSON.parse(stdout);

      expect(result.url).toBe(testHtmlPath);
      expect(result.title).toContain("Test Article");
      expect(result.content).toBeDefined();
      expect(result.content).toContain("Test Article Title");

      // Check context
      expect(result.context).toBeDefined();
      expect(result.context.breadcrumb).toContain("Home");
      expect(result.context.breadcrumb).toContain("Blog");
      expect(result.context.section).toBe("main");
      expect(result.context.surroundingNavigation).toBeDefined();
      expect(result.context.surroundingNavigation.length).toBeGreaterThan(0);
    });

    it("should extract plain content without --with-context", async () => {
      const { stdout } = await execAsync(`node ${cliPath} --extract-content ${testHtmlPath}`);

      // Should return markdown content, not JSON
      expect(() => JSON.parse(stdout)).toThrow();
      expect(stdout).toContain("Test Article Title");
      expect(stdout).toContain("Section 1");
    });
  });

  describe("Full Analysis", () => {
    it("should perform complete analysis with --full-analysis", async () => {
      const { stdout } = await execAsync(`node ${cliPath} --full-analysis ${testHtmlPath}`);
      const result = JSON.parse(stdout);

      expect(result.url).toBe(testHtmlPath);

      // Check structure
      expect(result.structure).toBeDefined();
      expect(result.structure.pageType).toBe("article");
      expect(result.structure.navigations).toBeDefined();
      expect(result.structure.headers).toBeDefined();
      expect(result.structure.contentAreas).toBeDefined();

      // Check navigation
      expect(result.navigation).toBeDefined();
      expect(result.navigation.breadcrumb).toBeDefined();
      expect(result.navigation.tableOfContents).toBeDefined();

      // Check content
      expect(result.content).toBeDefined();
      expect(result.content.main).toBeDefined();
      expect(result.content.main).toContain("Test Article Title");

      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toContain("Test Article");
    });
  });

  describe("AI-Optimized Formats", () => {
    it("should generate AI summary with --format ai-summary", async () => {
      const { stdout } = await execAsync(`node ${cliPath} -f ai-summary ${testHtmlPath}`);
      const result = JSON.parse(stdout);

      expect(result.url).toBe(testHtmlPath);
      // Type is determined by structure and content - it might be "other" if no TOC in sidebar
      expect(["article", "other", "documentation"]).toContain(result.type);
      expect(result.title).toContain("Test Article");
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeLessThan(250); // Should be truncated

      // Check navigation summary
      expect(result.navigationSummary).toBeDefined();
      expect(result.navigationSummary.breadcrumb).toContain("Home");
      expect(result.navigationSummary.hasTableOfContents).toBe(true);
      expect(result.navigationSummary.hasSidebar).toBe(true);

      // Check content stats
      expect(result.contentStats).toBeDefined();
      expect(result.contentStats.wordCount).toBeGreaterThan(0);
      expect(result.contentStats.hasCode).toBe(false);
    });

    it("should generate AI structured format with --format ai-structured", async () => {
      const { stdout } = await execAsync(`node ${cliPath} -f ai-structured ${testHtmlPath}`);
      const result = JSON.parse(stdout);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.url).toBe("about:blank"); // Default URL when no URL is provided

      // Check structured format
      expect(result.structure).toBeDefined();
      expect(result.structure.navigation).toBeDefined();
      expect(result.structure.navigation.types).toContain("global");
      expect(result.structure.navigation.types).toContain("breadcrumb");
      expect(result.structure.navigation.types).toContain("toc");

      // Check content structure
      expect(result.structure.content).toBeDefined();
      expect(result.structure.content.main.present).toBe(true);
      expect(result.structure.content.main.markdown).toContain("Test Article Title");
      // Sections might be empty if not using document structure analysis
      expect(result.structure.content.sections).toBeDefined();

      // Check sidebar
      expect(result.structure.sidebar).toBeDefined();
      expect(result.structure.sidebar.present).toBe(true);
    });
  });

  describe("Default Behavior", () => {
    it("should maintain default behavior without options", async () => {
      const { stdout } = await execAsync(`node ${cliPath} ${testHtmlPath}`);

      // Should return markdown by default
      expect(stdout).toContain("Test Article Title");
      expect(stdout).toContain("Section 1");
      expect(stdout).toContain("Section 2");

      // Should not include navigation or metadata by default
      expect(stdout).not.toContain("main-nav");
      expect(stdout).not.toContain("breadcrumb");
    });

    it("should support legacy format options", async () => {
      const htmlResult = await execAsync(`node ${cliPath} -f html ${testHtmlPath}`);
      expect(htmlResult.stdout).toContain("<h1>Test Article Title</h1>");

      const docResult = await execAsync(`node ${cliPath} --doc-mode ${testHtmlPath}`);
      expect(docResult.stdout).toContain("# Document Content");
      expect(docResult.stdout).toContain("## Main Content");
    });
  });

  afterAll(() => {
    if (fs.existsSync(testHtmlPath)) {
      fs.unlinkSync(testHtmlPath);
    }
  });
});
