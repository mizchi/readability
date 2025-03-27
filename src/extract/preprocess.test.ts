import { describe, test, expect } from "vitest";
import { preprocessDocument } from "./preprocess";
import { parseHTML } from "../parsers/parser"; // Using the default parser to create VDocument
import { getElementsByTagName } from "../dom";
import { toHTML } from "../format/format"; // Import toHTML for comparison
import type { VDocument, VElement, VText } from "../types"; // Add VElement and VText

describe("preprocessDocument function", () => {
  test("should remove script tags", () => {
    const html = `
      <html>
        <body>
          <h1>Title</h1>
          <p>Some content.</p>
          <script>alert('Hello');</script>
          <p>More content.</p>
          <script src="script.js"></script>
        </body>
      </html>
    `;
    const doc = parseHTML(html) as VDocument;
    preprocessDocument(doc);

    const scriptElements = getElementsByTagName(doc.body, "script");
    expect(scriptElements.length).toBe(0);
    // Ensure content paragraphs are still present
    const pElements = getElementsByTagName(doc.body, "p");
    expect(pElements.length).toBe(2);
  });

  test("should remove style tags", () => {
    const html = `
      <html>
        <head>
          <style>body { background: red; }</style>
        </head>
        <body>
          <h1>Title</h1>
          <style>.content { color: blue; }</style>
          <p>Some content.</p>
        </body>
      </html>
    `;
    const doc = parseHTML(html) as VDocument;
    preprocessDocument(doc); // Note: preprocessDocument currently operates mainly on doc.body

    // Check head and body separately if needed, but TAGS_TO_REMOVE logic targets the whole documentElement initially
    const styleElementsInHead = getElementsByTagName(
      doc.documentElement,
      "style"
    );
    expect(styleElementsInHead.length).toBe(0);

    // Double check body specifically if head wasn't parsed/handled as expected by default parser
    const styleElementsInBody = getElementsByTagName(doc.body, "style");
    expect(styleElementsInBody.length).toBe(0);

    // Ensure content is still present
    const pElements = getElementsByTagName(doc.body, "p");
    expect(pElements.length).toBe(1);
    const h1Elements = getElementsByTagName(doc.body, "h1");
    expect(h1Elements.length).toBe(1);
  });

  test("should remove both script and style tags", () => {
    const html = `
      <html>
        <body>
          <style>h1 { font-size: 2em; }</style>
          <h1>Title</h1>
          <script>console.log('Logging');</script>
          <p>Content between tags.</p>
          <script src="another.js"></script>
          <style>.footer { text-align: center; }</style>
        </body>
      </html>
    `;
    const doc = parseHTML(html) as VDocument;
    preprocessDocument(doc);

    const scriptElements = getElementsByTagName(doc.body, "script");
    expect(scriptElements.length).toBe(0);
    const styleElements = getElementsByTagName(doc.body, "style");
    expect(styleElements.length).toBe(0);

    // Ensure content is preserved
    const h1Elements = getElementsByTagName(doc.body, "h1");
    expect(h1Elements.length).toBe(1);
    const pElements = getElementsByTagName(doc.body, "p");
    expect(pElements.length).toBe(1);
  });

  test("should not remove content when no script or style tags are present", () => {
    const html = `
      <html>
        <body>
          <h1>Main Title</h1>
          <p>This is the first paragraph.</p>
          <div><p>Nested paragraph.</p></div>
        </body>
      </html>
    `;
    const doc = parseHTML(html) as VDocument;
    // Use toHTML to get a comparable string representation before modification
    const originalBodyHTML = toHTML(doc.body);

    preprocessDocument(doc);

    const scriptElements = getElementsByTagName(doc.body, "script");
    expect(scriptElements.length).toBe(0);
    const styleElements = getElementsByTagName(doc.body, "style");
    expect(styleElements.length).toBe(0);

    // Check if the body structure remains the same by comparing HTML output
    expect(toHTML(doc.body)).toBe(originalBodyHTML);
    const h1Elements = getElementsByTagName(doc.body, "h1");
    expect(h1Elements.length).toBe(1);
    const pElements = getElementsByTagName(doc.documentElement, "p"); // Search from root to find nested
    expect(pElements.length).toBe(2);
  });
});
