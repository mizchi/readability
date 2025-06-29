import { describe, test, expect } from "vitest";
import { detectHeaders, detectLogo, detectSiteTitle } from "./header";
import { parseHTML } from "../parsers/parser";
import { buildAriaTree } from "../nav/readableAria";

describe("Header Detection", () => {
  test("detects basic header element", () => {
    const html = `
      <header>
        <h1>My Website</h1>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
      </header>
    `;
    
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const headers = detectHeaders(tree.root);
    
    expect(headers).toHaveLength(1);
    expect(headers[0].type).toBe("main");
    expect(headers[0].contains.siteTitle?.text).toBe("My Website");
    expect(headers[0].contains.navigation).toHaveLength(1);
  });

  test("detects header with banner role", () => {
    const html = `
      <div role="banner">
        <img src="/logo.png" alt="Company Logo" />
        <span class="site-title">Example Corp</span>
      </div>
    `;
    
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const headers = detectHeaders(tree.root);
    
    expect(headers).toHaveLength(1);
    expect(headers[0].contains.logo?.alt).toBe("Company Logo");
    expect(headers[0].contains.siteTitle?.text).toBe("Example Corp");
  });

  test("distinguishes between main and article headers", () => {
    const html = `
      <body>
        <header id="main-header">
          <h1>Blog Title</h1>
        </header>
        <article>
          <header>
            <h2>Article Title</h2>
          </header>
        </article>
      </body>
    `;
    
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const headers = detectHeaders(tree.root);
    
    expect(headers).toHaveLength(2);
    expect(headers[0].type).toBe("main");
    expect(headers[1].type).toBe("article");
  });

  test("detects sticky header", () => {
    const html = `
      <header class="sticky-header">
        <h1>Sticky Site</h1>
      </header>
    `;
    
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const headers = detectHeaders(tree.root);
    
    expect(headers[0].isSticky).toBe(true);
  });

  test("detects search form in header", () => {
    const html = `
      <header>
        <h1>Search Site</h1>
        <form role="search">
          <input type="search" placeholder="Search..." />
        </form>
      </header>
    `;
    
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const headers = detectHeaders(tree.root);
    
    expect(headers[0].contains.search).toBeDefined();
  });
});

describe("Logo Detection", () => {
  test("detects image logo", () => {
    const html = `<img src="/images/logo.png" alt="Company Logo" class="site-logo" />`;
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const logo = detectLogo(tree.root);
    
    expect(logo).toBeDefined();
    expect(logo?.alt).toBe("Company Logo");
    expect(logo?.src).toContain("logo.png");
  });

  test("detects text-based logo", () => {
    const html = `<div class="logo">ACME Corp</div>`;
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const logo = detectLogo(tree.root);
    
    expect(logo).toBeDefined();
    expect(logo?.text).toBe("ACME Corp");
  });
});

describe("Site Title Detection", () => {
  test("detects h1 as site title", () => {
    const html = `<h1>My Awesome Blog</h1>`;
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const title = detectSiteTitle(tree.root);
    
    expect(title).toBeDefined();
    expect(title?.text).toBe("My Awesome Blog");
    expect(title?.level).toBe(1);
  });

  test("detects element with site-title class", () => {
    const html = `<span class="site-title">Corporate Website</span>`;
    const doc = parseHTML(html);
    const tree = buildAriaTree(doc);
    const title = detectSiteTitle(tree.root);
    
    expect(title).toBeDefined();
    expect(title?.text).toBe("Corporate Website");
    expect(title?.level).toBe(0); // Not a heading element
  });
});