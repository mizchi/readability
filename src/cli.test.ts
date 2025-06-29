import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

describe("CLI document mode", () => {
  const cliPath = path.join(process.cwd(), "cli.js");
  const testHtmlPath = path.join(process.cwd(), "test-doc.html");

  beforeAll(() => {
    // Create a test HTML file for documentation site
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Documentation</title>
        </head>
        <body>
          <header>
            <nav class="main-nav">
              <a href="/">Home</a>
              <a href="/docs">Docs</a>
              <a href="/api">API</a>
            </nav>
          </header>
          
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <span>></span>
            <a href="/docs">Documentation</a>
            <span>></span>
            <span>Getting Started</span>
          </nav>
          
          <aside class="sidebar">
            <nav>
              <ul>
                <li><a href="/docs/intro">Introduction</a></li>
                <li class="current"><a href="/docs/getting-started">Getting Started</a></li>
                <li><a href="/docs/advanced">Advanced</a></li>
              </ul>
            </nav>
          </aside>
          
          <main>
            <h1>Getting Started</h1>
            <p>Welcome to our documentation!</p>
            
            <nav class="toc">
              <h2>Table of Contents</h2>
              <ul>
                <li><a href="#install">Installation</a></li>
                <li><a href="#usage">Usage</a></li>
                <li><a href="#examples">Examples</a></li>
              </ul>
            </nav>
            
            <h2 id="install">Installation</h2>
            <p>Install using npm:</p>
            <pre><code>npm install our-package</code></pre>
            
            <h2 id="usage">Usage</h2>
            <p>Import and use the package:</p>
            <pre><code>import { feature } from 'our-package';</code></pre>
            
            <h2 id="examples">Examples</h2>
            <p>Here are some examples...</p>
          </main>
          
          <nav class="pagination">
            <a href="/docs/intro">← Previous</a>
            <a href="/docs/advanced">Next →</a>
          </nav>
        </body>
      </html>
    `;
    fs.writeFileSync(testHtmlPath, testHtml);
  });

  it("should extract document structure with --doc-mode flag", async () => {
    const { stdout } = await execAsync(`node ${cliPath} --doc-mode ${testHtmlPath}`);
    
    // Check for breadcrumb - might not include current page
    expect(stdout).toContain("**Breadcrumb:** Home > Documentation");
    
    // Check for TOC
    expect(stdout).toContain("## Table of Contents");
    expect(stdout).toContain("- Installation (#install)");
    expect(stdout).toContain("- Usage (#usage)");
    expect(stdout).toContain("- Examples (#examples)");
    
    // Check for sidebar navigation
    expect(stdout).toContain("## Sidebar Navigation");
    expect(stdout).toContain("- Introduction (/docs/intro)");
    expect(stdout).toContain("- Getting Started (/docs/getting-started) **[Current]**");
    expect(stdout).toContain("- Advanced (/docs/advanced)");
    
    // Check for document outline
    expect(stdout).toContain("## Document Outline");
    expect(stdout).toContain("# Getting Started");
    expect(stdout).toContain("## Installation {#install}");
    expect(stdout).toContain("## Usage {#usage}");
    expect(stdout).toContain("## Examples {#examples}");
    
    // Check for main content
    expect(stdout).toContain("## Main Content");
    expect(stdout).toContain("Welcome to our documentation!");
    expect(stdout).toContain("Install using npm:");
  });

  it("should work with -f doc format option", async () => {
    const { stdout } = await execAsync(`node ${cliPath} -f doc ${testHtmlPath}`);
    
    // Should produce the same output as --doc-mode
    expect(stdout).toContain("**Breadcrumb:** Home > Documentation");
    expect(stdout).toContain("## Table of Contents");
    expect(stdout).toContain("## Sidebar Navigation");
    expect(stdout).toContain("## Document Outline");
    expect(stdout).toContain("## Main Content");
  });

  it("should handle navigation filtering in document mode", async () => {
    const { stdout } = await execAsync(`node ${cliPath} --doc-mode --nav-location sidebar ${testHtmlPath}`);
    
    // Should still show sidebar navigation in document mode
    expect(stdout).toContain("## Sidebar Navigation");
    expect(stdout).toContain("- Introduction (/docs/intro)");
  });

  it("should output to file with -o option", async () => {
    const outputPath = path.join(process.cwd(), "test-output.md");
    
    await execAsync(`node ${cliPath} --doc-mode -o ${outputPath} ${testHtmlPath}`);
    
    const output = fs.readFileSync(outputPath, "utf-8");
    expect(output).toContain("# Document Content");
    expect(output).toContain("**Breadcrumb:** Home > Documentation");
    
    // Clean up
    fs.unlinkSync(outputPath);
  });

  it("should handle sites without navigation gracefully", async () => {
    const simpleHtmlPath = path.join(process.cwd(), "test-simple.html");
    const simpleHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <main>
            <h1>Simple Page</h1>
            <p>This is a simple page without navigation.</p>
          </main>
        </body>
      </html>
    `;
    fs.writeFileSync(simpleHtmlPath, simpleHtml);

    const { stdout } = await execAsync(`node ${cliPath} --doc-mode ${simpleHtmlPath}`);
    
    // Should still show main content
    expect(stdout).toContain("## Main Content");
    expect(stdout).toContain("Simple Page");
    expect(stdout).toContain("This is a simple page without navigation");
    
    // Should not show navigation sections
    expect(stdout).not.toContain("## Sidebar Navigation");
    expect(stdout).not.toContain("## Table of Contents");
    expect(stdout).not.toContain("**Breadcrumb:**");
    
    // Clean up
    fs.unlinkSync(simpleHtmlPath);
  });

  // Clean up test files after all tests
  afterAll(() => {
    if (fs.existsSync(testHtmlPath)) {
      fs.unlinkSync(testHtmlPath);
    }
  });
});

describe("CLI navigation options", () => {
  const cliPath = path.join(process.cwd(), "cli.js");
  const testHtmlPath = path.join(process.cwd(), "test-nav.html");

  beforeAll(() => {
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <header>
            <nav class="global-nav">
              <a href="/">Home</a>
              <a href="/products">Products</a>
              <a href="/about">About</a>
            </nav>
          </header>
          
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <span>></span>
            <a href="/products">Products</a>
            <span>></span>
            <span>Widget</span>
          </nav>
          
          <aside>
            <nav class="sidebar-nav">
              <a href="/products/widgets">Widgets</a>
              <a href="/products/gadgets">Gadgets</a>
            </nav>
          </aside>
          
          <main>
            <h1>Product Page</h1>
            <p>Content here.</p>
          </main>
          
          <footer>
            <nav class="footer-nav">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </nav>
          </footer>
        </body>
      </html>
    `;
    fs.writeFileSync(testHtmlPath, testHtml);
  });

  it("should filter navigation by type with --nav-type", async () => {
    const { stdout } = await execAsync(`node ${cliPath} --nav-only --nav-type global ${testHtmlPath}`);
    const result = JSON.parse(stdout);
    
    expect(result.navigations).toHaveLength(1);
    expect(result.navigations[0].type).toBe("global");
    expect(result.navigations[0].items).toHaveLength(3);
  });

  it("should filter navigation by location with --nav-location", async () => {
    const { stdout } = await execAsync(`node ${cliPath} --nav-only --nav-location header ${testHtmlPath}`);
    const result = JSON.parse(stdout);
    
    // Should only show navigation in header
    const locations = result.navigations.map(nav => nav.location);
    expect(locations.every(loc => loc === "header")).toBe(true);
  });

  it("should show all navigations with --nav-only", async () => {
    const { stdout } = await execAsync(`node ${cliPath} --nav-only ${testHtmlPath}`);
    const result = JSON.parse(stdout);
    
    expect(result.navigations.length).toBeGreaterThan(2);
    expect(result.summary.total).toBe(result.navigations.length);
    expect(result.summary.byType).toBeDefined();
    expect(result.summary.mainNavigation).toBeDefined();
    expect(result.summary.breadcrumb).toBeDefined();
  });

  afterAll(() => {
    if (fs.existsSync(testHtmlPath)) {
      fs.unlinkSync(testHtmlPath);
    }
  });
});