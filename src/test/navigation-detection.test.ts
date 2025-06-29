import { test, expect, describe } from "vitest";
import { analyzePageStructure } from "../index";

describe("Navigation Detection Tests", () => {
  describe("Basic Navigation Detection", () => {
    const HTML_WITH_NAV = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Navigation Test</title>
        </head>
        <body>
          <header>
            <nav class="main-nav" aria-label="Main navigation">
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
                <li><a href="/products">Products</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <h1>Page Content</h1>
            <p>This is the main content.</p>
          </main>
        </body>
      </html>
    `;

    test("should detect main navigation", () => {
      const structure = analyzePageStructure(HTML_WITH_NAV);
      
      expect(structure.navigations.length).toBeGreaterThan(0);
      expect(structure.mainNavigation).toBeDefined();
      expect(structure.mainNavigation?.type).toBe("global");
      expect(structure.mainNavigation?.items.length).toBe(4);
    });

    test("should extract navigation items correctly", () => {
      const structure = analyzePageStructure(HTML_WITH_NAV);
      const nav = structure.mainNavigation!;
      
      expect(nav.items[0].label).toBe("Home");
      expect(nav.items[0].href).toBe("/");
      expect(nav.items[1].label).toBe("About");
      expect(nav.items[1].href).toBe("/about");
    });
  });

  describe("Navigation Types", () => {
    const BREADCRUMB_HTML = `
      <html>
        <body>
          <nav aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li><a href="/products">Products</a></li>
              <li>Current Item</li>
            </ol>
          </nav>
        </body>
      </html>
    `;

    const PAGINATION_HTML = `
      <html>
        <body>
          <nav class="pagination">
            <a href="/page/1">Previous</a>
            <a href="/page/1">1</a>
            <span>2</span>
            <a href="/page/3">3</a>
            <a href="/page/3">Next</a>
          </nav>
        </body>
      </html>
    `;

    const TOC_HTML = `
      <html>
        <body>
          <nav class="toc">
            <h2>Table of Contents</h2>
            <ul>
              <li><a href="#section1">Section 1</a></li>
              <li><a href="#section2">Section 2</a></li>
              <li><a href="#section3">Section 3</a></li>
            </ul>
          </nav>
        </body>
      </html>
    `;

    test("should detect breadcrumb navigation", () => {
      const structure = analyzePageStructure(BREADCRUMB_HTML);
      
      expect(structure.breadcrumb).toBeDefined();
      expect(structure.breadcrumb?.type).toBe("breadcrumb");
      expect(structure.breadcrumb?.items.length).toBe(3);
    });

    test("should detect pagination navigation", () => {
      const structure = analyzePageStructure(PAGINATION_HTML);
      
      const pagination = structure.navigations.find(nav => nav.type === "pagination");
      expect(pagination).toBeDefined();
      expect(pagination?.items.length).toBeGreaterThan(0);
    });

    test("should detect table of contents", () => {
      const structure = analyzePageStructure(TOC_HTML);
      
      expect(structure.toc).toBeDefined();
      expect(structure.toc?.type).toBe("toc");
      expect(structure.toc?.items.every(item => item.href?.startsWith("#"))).toBe(true);
    });
  });

  describe("Navigation Locations", () => {
    const MULTI_LOCATION_HTML = `
      <html>
        <body>
          <header>
            <nav class="header-nav">
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </header>
          
          <aside>
            <nav class="sidebar-nav">
              <h3>Categories</h3>
              <ul>
                <li><a href="/cat/1">Category 1</a></li>
                <li><a href="/cat/2">Category 2</a></li>
              </ul>
            </nav>
          </aside>
          
          <footer>
            <nav class="footer-nav">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </nav>
          </footer>
        </body>
      </html>
    `;

    test("should detect navigation in different locations", () => {
      const structure = analyzePageStructure(MULTI_LOCATION_HTML);
      
      const headerNav = structure.navigations.find(nav => nav.location === "header");
      const sidebarNav = structure.navigations.find(nav => nav.location === "sidebar");
      const footerNav = structure.navigations.find(nav => nav.location === "footer");
      
      expect(headerNav).toBeDefined();
      expect(sidebarNav).toBeDefined();
      expect(footerNav).toBeDefined();
    });
  });

  describe("Nested Navigation", () => {
    const NESTED_NAV_HTML = `
      <html>
        <body>
          <nav>
            <ul>
              <li>
                <a href="/products">Products</a>
                <ul>
                  <li><a href="/products/software">Software</a></li>
                  <li><a href="/products/hardware">Hardware</a></li>
                </ul>
              </li>
              <li>
                <a href="/services">Services</a>
                <ul>
                  <li><a href="/services/consulting">Consulting</a></li>
                  <li><a href="/services/support">Support</a></li>
                </ul>
              </li>
            </ul>
          </nav>
        </body>
      </html>
    `;

    test("should detect nested navigation structure", () => {
      const structure = analyzePageStructure(NESTED_NAV_HTML);
      
      const nav = structure.navigations[0];
      expect(nav?.structure).toBe("nested");
      
      const productsItem = nav?.items.find(item => item.label === "Products");
      expect(productsItem?.children).toBeDefined();
      expect(productsItem?.children?.length).toBe(2);
    });
  });

  describe("Header Detection", () => {
    const HEADER_HTML = `
      <html>
        <body>
          <header class="site-header">
            <img src="/logo.png" alt="Company Logo" class="logo">
            <h1>Company Name</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </header>
          
          <article>
            <header>
              <h1>Article Title</h1>
              <p>Published on January 1, 2024</p>
            </header>
            <p>Article content...</p>
          </article>
        </body>
      </html>
    `;

    test("should detect headers", () => {
      const structure = analyzePageStructure(HEADER_HTML);
      
      expect(structure.headers.length).toBeGreaterThan(0);
      expect(structure.mainHeader).toBeDefined();
      expect(structure.mainHeader?.type).toBe("main");
    });

    test("should detect logo and site title", () => {
      const structure = analyzePageStructure(HEADER_HTML);
      
      const mainHeader = structure.mainHeader!;
      expect(mainHeader.contains.logo).toBeDefined();
      expect(mainHeader.contains.siteTitle).toBeDefined();
      expect(mainHeader.contains.navigation).toBeDefined();
    });
  });

  describe("Page Structure Elements", () => {
    const FULL_PAGE_HTML = `
      <html>
        <body>
          <header>
            <h1>Site Title</h1>
            <nav><a href="/">Home</a></nav>
          </header>
          
          <main>
            <article>
              <h1>Main Article</h1>
              <p>Main content goes here.</p>
            </article>
          </main>
          
          <aside>
            <h2>Sidebar</h2>
            <p>Sidebar content.</p>
          </aside>
          
          <footer>
            <p>Footer content.</p>
          </footer>
        </body>
      </html>
    `;

    test("should detect all page structure elements", () => {
      const structure = analyzePageStructure(FULL_PAGE_HTML);
      
      expect(structure.mainContent).toBeDefined();
      expect(structure.sidebar).toBeDefined();
      expect(structure.footer).toBeDefined();
    });
  });

  describe("Options and Filtering", () => {
    const COMPLEX_NAV_HTML = `
      <html>
        <body>
          <header>
            <nav><a href="/">Home</a></nav>
            <nav><a href="/search">Search</a></nav>
          </header>
          <nav><a href="/cat1">Category 1</a></nav>
          <nav><a href="/cat2">Category 2</a></nav>
          <nav><a href="/cat3">Category 3</a></nav>
          <footer>
            <nav><a href="/about">About</a></nav>
          </footer>
        </body>
      </html>
    `;

    test("should respect maxNavigations option", () => {
      const structure = analyzePageStructure(COMPLEX_NAV_HTML, {
        maxNavigations: 3
      });
      
      expect(structure.navigations.length).toBeLessThanOrEqual(3);
    });

    test("should respect headerNavigationOnly option", () => {
      const structure = analyzePageStructure(COMPLEX_NAV_HTML, {
        headerNavigationOnly: true
      });
      
      expect(structure.navigations.every(nav => nav.location === "header")).toBe(true);
    });
  });
});