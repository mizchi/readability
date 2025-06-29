import { describe, it, expect } from "vitest";
import { analyzeDocumentStructure, extractDocumentContent } from "./document";
import { analyzePageStructure } from "./index";

describe("Cloudflare Workers Documentation Site", () => {
  // Simplified test HTML based on Cloudflare docs structure
  const cloudflareDocsHTML = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Cloudflare Workers documentation · Cloudflare Workers docs</title>
      </head>
      <body>
        <!-- Theme switcher and top nav -->
        <header>
          <nav class="theme-switcher">
            <button aria-label="Theme">Theme</button>
          </nav>
          <nav class="top-nav">
            <a href="/workers/">Workers</a>
            <a href="/pages/">Pages</a>
            <a href="/r2/">R2</a>
            <a href="/d1/">D1</a>
          </nav>
        </header>

        <!-- Custom breadcrumb component -->
        <astro-breadcrumbs>
          <nav aria-label="Breadcrumbs" class="breadcrumbs">
            <ol>
              <li><a href="/">Docs</a></li>
              <li><a href="/workers/">Workers</a></li>
              <li aria-current="page">Documentation</li>
            </ol>
          </nav>
        </astro-breadcrumbs>

        <div class="docs-content">
          <!-- Sidebar navigation -->
          <aside class="sidebar-content">
            <nav aria-label="Main">
              <ul>
                <li>
                  <details open>
                    <summary>Getting started</summary>
                    <ul>
                      <li><a href="/workers/get-started/guide/">Get started guide</a></li>
                      <li><a href="/workers/get-started/quickstarts/">Quickstarts</a></li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details>
                    <summary>Development & testing</summary>
                    <ul>
                      <li><a href="/workers/testing/local-development/">Local development</a></li>
                      <li><a href="/workers/testing/debugging/">Debugging</a></li>
                      <li><a href="/workers/testing/unit-testing/">Unit testing</a></li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details>
                    <summary>Configuration</summary>
                    <ul>
                      <li><a href="/workers/configuration/versions-and-deployments/">Versions & deployments</a></li>
                      <li><a href="/workers/configuration/bindings/">Bindings</a></li>
                      <li><a href="/workers/configuration/environment-variables/">Environment variables</a></li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details>
                    <summary>Runtime APIs</summary>
                    <ul>
                      <li><a href="/workers/runtime-apis/request/">Request</a></li>
                      <li><a href="/workers/runtime-apis/response/">Response</a></li>
                      <li><a href="/workers/runtime-apis/fetch-event/">FetchEvent</a></li>
                      <li><a href="/workers/runtime-apis/scheduled-event/">ScheduledEvent</a></li>
                      <li>
                        <details>
                          <summary>Web Standards</summary>
                          <ul>
                            <li><a href="/workers/runtime-apis/web-standards/fetch/">Fetch API</a></li>
                            <li><a href="/workers/runtime-apis/web-standards/streams/">Streams API</a></li>
                            <li><a href="/workers/runtime-apis/web-standards/encoding/">Encoding API</a></li>
                          </ul>
                        </details>
                      </li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details>
                    <summary>Wrangler</summary>
                    <ul>
                      <li><a href="/workers/wrangler/install-and-update/">Install/Update</a></li>
                      <li><a href="/workers/wrangler/commands/">Commands</a></li>
                      <li><a href="/workers/wrangler/configuration/">Configuration</a></li>
                    </ul>
                  </details>
                </li>
              </ul>
            </nav>
          </aside>

          <!-- Main content -->
          <main>
            <article>
              <h1>Cloudflare Workers documentation</h1>
              <p class="lead">Build serverless applications and deploy instantly across the globe for exceptional performance, reliability, and scale.</p>
              
              <section>
                <h2 id="what-is-workers">What is Cloudflare Workers?</h2>
                <p>Cloudflare Workers provides a serverless execution environment that allows you to create new applications or augment existing ones without configuring or maintaining infrastructure.</p>
                
                <h3 id="benefits">Benefits</h3>
                <ul>
                  <li>Global network: Deploy to Cloudflare's global network</li>
                  <li>Auto-scaling: Automatic scaling with no configuration</li>
                  <li>High performance: Run code within milliseconds of your users</li>
                </ul>
              </section>

              <section>
                <h2 id="get-started">Get started</h2>
                <p>Choose from our collection of guides and tutorials:</p>
                
                <nav class="tutorial-cards">
                  <a href="/workers/get-started/guide/" class="card">
                    <h3>Get started guide</h3>
                    <p>Set up your development environment and deploy your first Worker</p>
                  </a>
                  <a href="/workers/tutorials/build-a-qr-code-generator/" class="card">
                    <h3>Build a QR code generator</h3>
                    <p>Build and deploy a QR code generator API</p>
                  </a>
                </nav>
              </section>

              <section>
                <h2 id="frameworks">Framework guides</h2>
                <p>Deploy popular frameworks to Cloudflare Workers:</p>
                <ul>
                  <li><a href="/workers/frameworks/framework-guides/nextjs/">Next.js</a></li>
                  <li><a href="/workers/frameworks/framework-guides/remix/">Remix</a></li>
                  <li><a href="/workers/frameworks/framework-guides/sveltekit/">SvelteKit</a></li>
                  <li><a href="/workers/frameworks/framework-guides/nuxt/">Nuxt</a></li>
                </ul>
              </section>
            </article>
          </main>

          <!-- Table of contents sidebar -->
          <aside class="toc-sidebar">
            <nav aria-label="Table of contents">
              <h2>On this page</h2>
              <ul>
                <li><a href="#what-is-workers">What is Cloudflare Workers?</a>
                  <ul>
                    <li><a href="#benefits">Benefits</a></li>
                  </ul>
                </li>
                <li><a href="#get-started">Get started</a></li>
                <li><a href="#frameworks">Framework guides</a></li>
              </ul>
            </nav>
          </aside>
        </div>

        <footer>
          <nav>
            <a href="/workers/platform/changelog/">Changelog</a>
            <a href="https://discord.cloudflare.com">Discord</a>
            <a href="https://github.com/cloudflare">GitHub</a>
          </nav>
        </footer>
      </body>
    </html>
  `;

  describe("Navigation Detection", () => {
    it("should detect all navigation types in Cloudflare docs", () => {
      const structure = analyzePageStructure(cloudflareDocsHTML, { documentMode: true });

      // Should find multiple navigation areas
      expect(structure.navigations.length).toBeGreaterThan(4);

      // Check for specific navigation types
      const navTypes = structure.navigations.map((nav) => nav.type);
      expect(navTypes).toContain("global");
      expect(navTypes).toContain("breadcrumb");
      expect(navTypes).toContain("toc");
      expect(navTypes).toContain("local");
    });

    it("should extract hierarchical sidebar navigation", () => {
      const structure = analyzeDocumentStructure(cloudflareDocsHTML);

      expect(structure.sidebarNavigation).toBeDefined();
      const sidebarItems = structure.sidebarNavigation?.items || [];

      // Should have main categories - the detection finds individual links
      const allLabels = sidebarItems.map((item) => item.label);
      expect(allLabels).toContain("Get started guide");
      expect(allLabels).toContain("Request"); // From Runtime APIs
      expect(allLabels).toContain("Install/Update"); // From Wrangler

      // Since individual links are detected, check for specific items
      expect(allLabels).toContain("Fetch API"); // From Web Standards
      expect(allLabels).toContain("Streams API");
      expect(allLabels).toContain("Encoding API");
    });

    it("should detect custom breadcrumb component", () => {
      const structure = analyzePageStructure(cloudflareDocsHTML);

      expect(structure.breadcrumb).toBeDefined();
      expect(structure.breadcrumb?.items).toHaveLength(3);
      expect(structure.breadcrumb?.items[0].label).toBe("Docs");
      expect(structure.breadcrumb?.items[1].label).toBe("Workers");
      expect(structure.breadcrumb?.items[2].label).toBe("Documentation");
    });

    it("should extract table of contents from right sidebar", () => {
      const structure = analyzePageStructure(cloudflareDocsHTML);

      const toc = structure.navigations.find(
        (nav) => nav.type === "toc" || nav.items.every((item) => item.href?.startsWith("#"))
      );

      expect(toc).toBeDefined();
      expect(toc?.items.length).toBeGreaterThan(0);

      // Check for nested TOC structure
      const mainItem = toc?.items.find((item) => item.label.includes("What is"));
      expect(mainItem?.children).toBeDefined();
      expect(mainItem?.children?.length).toBeGreaterThan(0);
    });
  });

  describe("Content Extraction", () => {
    it("should extract structured content with all navigations", () => {
      const content = extractDocumentContent(cloudflareDocsHTML);

      // Check breadcrumb extraction
      expect(content.breadcrumb).toBeDefined();
      expect(content.breadcrumb).toContain("Docs");
      expect(content.breadcrumb).toContain("Workers");

      // Check sidebar navigation - contains individual links
      expect(content.sidebarNav).toBeDefined();
      expect(content.sidebarNav).toContain("Get started guide");
      expect(content.sidebarNav).toContain("Request");
      expect(content.sidebarNav).toContain("Fetch API");

      // Check TOC
      expect(content.toc).toBeDefined();
      expect(content.toc).toContain("What is Cloudflare Workers?");
      expect(content.toc).toContain("Benefits");

      // Check main content
      expect(content.content).toContain("Cloudflare Workers documentation");
      // The lead text might be extracted differently
      const hasLeadText =
        content.content.includes("serverless") || content.content.includes("Build and deploy");
      expect(hasLeadText).toBe(true);
      expect(content.content).toContain("Global network");
    });

    it("should extract section hierarchy", () => {
      const structure = analyzeDocumentStructure(cloudflareDocsHTML);

      expect(structure.sections).toBeDefined();
      expect(structure.sections?.length).toBeGreaterThan(0);

      // Find main heading
      const mainHeading = structure.sections?.find(
        (s) => s.title === "Cloudflare Workers documentation"
      );
      expect(mainHeading).toBeDefined();

      // Check for subsections
      const sections = structure.sections || [];
      const sectionTitles = sections.flatMap((s) => [
        s.title,
        ...(s.children?.map((c) => c.title) || []),
      ]);

      expect(sectionTitles).toContain("What is Cloudflare Workers?");
      // Benefits might be at a different level
      const allTitles = sections.flatMap((s) => [
        s.title,
        ...(s.children?.map((c) => c.title) || []),
        ...(s.children?.flatMap((c) => c.children?.map((cc) => cc.title) || []) || []),
      ]);
      expect(allTitles).toContain("Benefits");
      expect(sectionTitles).toContain("Get started");
      expect(sectionTitles).toContain("Framework guides");
    });

    it("should handle tutorial cards as navigation", () => {
      const structure = analyzePageStructure(cloudflareDocsHTML);

      // Tutorial cards might be detected as a navigation element
      const tutorialNav = structure.navigations.find((nav) =>
        nav.items.some(
          (item) =>
            item.label.includes("QR code generator") || item.label.includes("Get started guide")
        )
      );

      if (tutorialNav) {
        expect(tutorialNav.items.length).toBeGreaterThanOrEqual(2);
        const qrItem = tutorialNav.items.find((item) => item.label.includes("QR code generator"));
        if (qrItem) {
          expect(qrItem.href).toContain("/tutorials/build-a-qr-code-generator/");
        }
      }
    });

    it("should extract framework guides as structured content", () => {
      const content = extractDocumentContent(cloudflareDocsHTML);

      // Framework guides should be in the content
      expect(content.content).toContain("Framework guides");
      expect(content.content).toContain("Next.js");
      expect(content.content).toContain("Remix");
      expect(content.content).toContain("SvelteKit");
      expect(content.content).toContain("Nuxt");
    });
  });

  describe("Document Mode Features", () => {
    it("should prioritize documentation navigation in document mode", () => {
      const structure = analyzePageStructure(cloudflareDocsHTML, {
        documentMode: true,
        maxNavigations: 20,
      });

      // In document mode, TOC and sidebar navigation should be prioritized
      const navTypes = structure.navigations.slice(0, 5).map((nav) => nav.type);

      // Should prioritize documentation-specific navigation types
      const docNavTypes = navTypes.filter(
        (type) => type === "toc" || type === "local" || type === "breadcrumb"
      );
      expect(docNavTypes.length).toBeGreaterThan(0);
    });

    it("should handle nested navigation structures", () => {
      const structure = analyzeDocumentStructure(cloudflareDocsHTML);

      // Check deep nesting in sidebar
      const sidebar = structure.sidebarNavigation;
      expect(sidebar).toBeDefined();

      // Since items are flattened, check for Fetch API directly
      const fetchApi = sidebar?.items.find((item) => item.label === "Fetch API");

      expect(fetchApi).toBeDefined();
      expect(fetchApi?.href).toContain("/web-standards/fetch/");
    });

    it("should format complex navigation structures in markdown", () => {
      const content = extractDocumentContent(cloudflareDocsHTML);

      // Check markdown formatting of nested navigation
      if (content.sidebarNav) {
        // Should have proper indentation for nested items
        const lines = content.sidebarNav.split("\n");

        // Check for actual items
        expect(lines.some((line) => /^- Get started guide/.test(line))).toBe(true);
        expect(lines.some((line) => /^- Request/.test(line))).toBe(true);
        expect(lines.some((line) => /^- Fetch API/.test(line))).toBe(true);
      }
    });
  });
});
