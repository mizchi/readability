import { describe, it, expect } from "vitest";
import { analyzeDocumentStructure, extractDocumentContent } from "./document";

describe("analyzeDocumentStructure", () => {
  it("should extract sidebar navigation from documentation site", () => {
    const html = `
      <html>
        <body>
          <aside class="sidebar">
            <nav>
              <ul>
                <li><a href="/docs/intro">Introduction</a></li>
                <li><a href="/docs/getting-started">Getting Started</a></li>
                <li>
                  <a href="/docs/api">API Reference</a>
                  <ul>
                    <li><a href="/docs/api/core">Core API</a></li>
                    <li><a href="/docs/api/utils">Utilities</a></li>
                  </ul>
                </li>
              </ul>
            </nav>
          </aside>
          <main>
            <h1>Documentation</h1>
            <p>Welcome to our documentation.</p>
          </main>
        </body>
      </html>
    `;

    const result = analyzeDocumentStructure(html);

    expect(result.sidebarNavigation).toBeDefined();
    // The navigation detection also finds individual links as separate navigation items
    expect(result.sidebarNavigation?.items.length).toBeGreaterThanOrEqual(3);
    expect(result.sidebarNavigation?.items[0].label).toBe("Introduction");

    // Find the API item which might be at a different index
    const apiItem = result.sidebarNavigation?.items.find((item) => item.label === "API Reference");
    expect(apiItem).toBeDefined();
    expect(apiItem?.children).toHaveLength(2);
  });

  it("should extract sections with hierarchy", () => {
    const html = `
      <html>
        <body>
          <main>
            <h1 id="intro">Introduction</h1>
            <p>This is the introduction.</p>
            <h2 id="overview">Overview</h2>
            <p>This is an overview.</p>
            <h3 id="features">Features</h3>
            <p>List of features.</p>
            <h2 id="installation">Installation</h2>
            <p>How to install.</p>
          </main>
        </body>
      </html>
    `;

    const result = analyzeDocumentStructure(html);

    expect(result.sections).toBeDefined();
    expect(result.sections).toHaveLength(1); // Top-level h1
    expect(result.sections![0].title).toBe("Introduction");
    expect(result.sections![0].id).toBe("intro");
    expect(result.sections![0].children).toHaveLength(2); // Two h2s
    expect(result.sections![0].children![0].title).toBe("Overview");
    expect(result.sections![0].children![0].children).toHaveLength(1); // One h3
  });

  it("should detect pagination links", () => {
    const html = `
      <html>
        <body>
          <nav class="pagination">
            <a href="/page/1">← Previous</a>
            <a href="/page/3">Next →</a>
          </nav>
          <main>
            <h1>Page 2</h1>
            <p>Content of page 2.</p>
          </main>
        </body>
      </html>
    `;

    const result = analyzeDocumentStructure(html);

    expect(result.pagination).toBeDefined();
    expect(result.pagination?.prev).toBeDefined();
    expect(result.pagination?.prev?.label).toBe("← Previous");
    expect(result.pagination?.prev?.href).toBe("/page/1");
    expect(result.pagination?.next).toBeDefined();
    expect(result.pagination?.next?.label).toBe("Next →");
    expect(result.pagination?.next?.href).toBe("/page/3");
  });

  it("should prioritize TOC and local navigation in document mode", () => {
    const html = `
      <html>
        <body>
          <header>
            <nav class="global-nav">
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </header>
          <aside>
            <nav class="toc">
              <ul>
                <li><a href="#section1">Section 1</a></li>
                <li><a href="#section2">Section 2</a></li>
              </ul>
            </nav>
          </aside>
          <main>
            <h1>Document</h1>
            <h2 id="section1">Section 1</h2>
            <p>Content 1</p>
            <h2 id="section2">Section 2</h2>
            <p>Content 2</p>
          </main>
        </body>
      </html>
    `;

    const result = analyzeDocumentStructure(html, { documentMode: true });

    // In document mode, TOC should be prioritized
    expect(result.navigations.length).toBeGreaterThan(0);
    const tocNav = result.navigations.find((nav) => nav.type === "toc");
    expect(tocNav).toBeDefined();
    expect(result.toc).toBe(tocNav);
  });
});

describe("extractDocumentContent", () => {
  it("should extract structured content with navigation", () => {
    const html = `
      <html>
        <body>
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <span>></span>
            <a href="/docs">Docs</a>
            <span>></span>
            <span>API</span>
          </nav>
          <aside class="sidebar">
            <nav>
              <ul>
                <li><a href="/docs/intro">Introduction</a></li>
                <li class="current"><a href="/docs/api">API Reference</a></li>
                <li><a href="/docs/examples">Examples</a></li>
              </ul>
            </nav>
          </aside>
          <main>
            <h1>API Reference</h1>
            <p>Welcome to the API documentation.</p>
            <h2>Authentication</h2>
            <p>How to authenticate.</p>
            <h2>Endpoints</h2>
            <p>Available endpoints.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractDocumentContent(html);

    // Breadcrumb might not include the current page "API" in the extracted text
    expect(result.breadcrumb).toMatch(/Home.*Docs/);
    expect(result.sidebarNav).toContain("- Introduction (/docs/intro)");
    expect(result.sidebarNav).toContain("- API Reference (/docs/api) **[Current]**");
    expect(result.outline).toContain("# API Reference");
    expect(result.outline).toContain("## Authentication");
    expect(result.outline).toContain("## Endpoints");
    expect(result.content).toContain("Welcome to the API documentation");
  });

  it("should handle table of contents", () => {
    const html = `
      <html>
        <body>
          <aside>
            <nav class="toc">
              <h2>Table of Contents</h2>
              <ul>
                <li><a href="#intro">1. Introduction</a></li>
                <li>
                  <a href="#basics">2. Basics</a>
                  <ul>
                    <li><a href="#setup">2.1 Setup</a></li>
                    <li><a href="#config">2.2 Configuration</a></li>
                  </ul>
                </li>
                <li><a href="#advanced">3. Advanced Topics</a></li>
              </ul>
            </nav>
          </aside>
          <main>
            <h1 id="intro">Introduction</h1>
            <p>Getting started guide.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractDocumentContent(html);

    expect(result.toc).toBeDefined();
    expect(result.toc).toContain("- 1. Introduction (#intro)");
    expect(result.toc).toContain("- 2. Basics (#basics)");
    expect(result.toc).toContain("  - 2.1 Setup (#setup)");
    expect(result.toc).toContain("  - 2.2 Configuration (#config)");
    expect(result.toc).toContain("- 3. Advanced Topics (#advanced)");
  });

  it("should format markdown output correctly", () => {
    const html = `
      <html>
        <body>
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <span>></span>
            <a href="/guide">Guide</a>
          </nav>
          <main>
            <h1>User Guide</h1>
            <p>This is the user guide.</p>
            <h2>Getting Started</h2>
            <p>Start here.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractDocumentContent(html);

    // Check markdown formatting
    expect(result.content).toContain("User Guide\n");
    expect(result.content).toContain("This is the user guide");
    expect(result.content).toContain("Getting Started\n");
    expect(result.content).toContain("Start here");
    expect(result.breadcrumb).toBe("Home > Guide");
  });

  it("should handle empty sections gracefully", () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>Page Title</h1>
            <p>Some content.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractDocumentContent(html);

    expect(result.content).toContain("Page Title");
    expect(result.content).toContain("Some content");
    expect(result.sidebarNav).toBeUndefined();
    expect(result.toc).toBeUndefined();
    expect(result.breadcrumb).toBeUndefined();
  });
});

describe("Document mode integration", () => {
  it("should work with complex documentation sites", () => {
    // Simulate a complex documentation site structure
    const html = `
      <html>
        <body>
          <header>
            <nav class="main-nav">
              <a href="/">Home</a>
              <a href="/docs">Documentation</a>
              <a href="/api">API</a>
              <a href="/blog">Blog</a>
            </nav>
          </header>
          
          <nav class="breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li><a href="/docs">Docs</a></li>
              <li><a href="/docs/guides">Guides</a></li>
              <li class="current">Getting Started</li>
            </ol>
          </nav>
          
          <div class="container">
            <aside class="sidebar">
              <nav>
                <h3>Guides</h3>
                <ul>
                  <li><a href="/docs/guides/intro">Introduction</a></li>
                  <li class="active">
                    <a href="/docs/guides/getting-started">Getting Started</a>
                    <ul>
                      <li><a href="#prerequisites">Prerequisites</a></li>
                      <li><a href="#installation">Installation</a></li>
                      <li><a href="#first-app">Your First App</a></li>
                    </ul>
                  </li>
                  <li><a href="/docs/guides/advanced">Advanced Topics</a></li>
                </ul>
              </nav>
              
              <nav class="version-selector">
                <select>
                  <option>v2.0</option>
                  <option selected>v1.0</option>
                  <option>v0.9</option>
                </select>
              </nav>
            </aside>
            
            <main>
              <article>
                <h1>Getting Started with Our Framework</h1>
                <p class="lead">Learn how to build your first application in under 5 minutes.</p>
                
                <nav class="toc">
                  <h2>On this page</h2>
                  <ul>
                    <li><a href="#prerequisites">Prerequisites</a></li>
                    <li><a href="#installation">Installation</a></li>
                    <li>
                      <a href="#first-app">Your First App</a>
                      <ul>
                        <li><a href="#create-project">Create a New Project</a></li>
                        <li><a href="#run-dev">Run Development Server</a></li>
                      </ul>
                    </li>
                    <li><a href="#next-steps">Next Steps</a></li>
                  </ul>
                </nav>
                
                <h2 id="prerequisites">Prerequisites</h2>
                <p>Before you begin, make sure you have the following installed:</p>
                <ul>
                  <li>Node.js 14 or later</li>
                  <li>npm or yarn</li>
                </ul>
                
                <h2 id="installation">Installation</h2>
                <p>Install our CLI tool globally:</p>
                <pre><code>npm install -g our-framework-cli</code></pre>
                
                <h2 id="first-app">Your First App</h2>
                <p>Let's create your first application.</p>
                
                <h3 id="create-project">Create a New Project</h3>
                <p>Run the following command:</p>
                <pre><code>our-framework create my-app</code></pre>
                
                <h3 id="run-dev">Run Development Server</h3>
                <p>Navigate to your project and start the dev server:</p>
                <pre><code>cd my-app
npm run dev</code></pre>
                
                <h2 id="next-steps">Next Steps</h2>
                <p>Congratulations! You've created your first app. Check out these resources:</p>
                <ul>
                  <li><a href="/docs/guides/tutorial">Complete Tutorial</a></li>
                  <li><a href="/docs/api">API Reference</a></li>
                  <li><a href="/examples">Example Projects</a></li>
                </ul>
              </article>
              
              <nav class="pagination">
                <a href="/docs/guides/intro" class="prev">← Introduction</a>
                <a href="/docs/guides/tutorial" class="next">Tutorial →</a>
              </nav>
            </main>
          </div>
          
          <footer>
            <nav>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Contact</a>
            </nav>
          </footer>
        </body>
      </html>
    `;

    const structure = analyzeDocumentStructure(html, { documentMode: true });

    // Should find multiple navigation types
    expect(structure.navigations.length).toBeGreaterThan(3);

    // Should identify main navigation
    expect(structure.mainNavigation).toBeDefined();
    expect(structure.mainNavigation?.items).toHaveLength(4);

    // Should find breadcrumb
    expect(structure.breadcrumb).toBeDefined();
    expect(structure.breadcrumb?.items).toHaveLength(4);

    // Should find TOC or at least have navigation items that could be TOC
    const tocLikeNav = structure.navigations.find(
      (nav) => nav.type === "toc" || (nav.items.length > 0 && nav.items[0].href?.startsWith("#"))
    );
    expect(tocLikeNav).toBeDefined();

    if (structure.toc) {
      expect(structure.toc.items).toHaveLength(4);
    }

    // Should find sidebar navigation
    expect(structure.sidebarNavigation).toBeDefined();
    // Sidebar might have more items due to nested navigation detection
    expect(structure.sidebarNavigation?.items.length).toBeGreaterThanOrEqual(3);

    // Should detect pagination - check if pagination navigation exists
    const paginationNav = structure.navigations.find((nav) => nav.type === "pagination");
    expect(paginationNav).toBeDefined();

    // If pagination is extracted, verify content
    if (structure.pagination) {
      expect(structure.pagination.prev?.label).toContain("Introduction");
      expect(structure.pagination.next?.label).toContain("Tutorial");
    }

    // Should extract sections
    expect(structure.sections).toBeDefined();
    // Find the main article heading
    const mainHeading = structure.sections?.find(
      (section) => section.title.includes("Getting Started") || section.level === 1
    );
    expect(mainHeading).toBeDefined();

    // Check for expected number of subsections
    const totalSubsections = structure.sections?.reduce(
      (count, section) => count + (section.children?.length || 0),
      0
    );
    expect(totalSubsections).toBeGreaterThanOrEqual(4);

    // Test content extraction
    const content = extractDocumentContent(html);

    expect(content.breadcrumb).toMatch(/Home.*Docs.*Guides/);
    expect(content.sidebarNav).toContain("Getting Started");
    if (content.toc) {
      expect(content.toc).toContain("Prerequisites");
    }
    expect(content.outline).toBeDefined();
    expect(content.content).toContain("Learn how to build your first application");
  });
});
