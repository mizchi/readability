/**
 * Readability v3 - HTML Parser (htmlparser2 implementation)
 *
 * Parses HTML and creates a virtual DOM structure using htmlparser2
 */

import { Parser } from "htmlparser2";
import { createElement, createTextNode } from "../dom.ts"; // Adjusted path
import type { VDocument, VElement, VText } from "../types.ts"; // Adjusted path

/**
 * Parses HTML and creates a virtual DOM structure
 *
 * @param html HTML string
 * @param baseURI Base URI (used for resolving relative URLs)
 * @returns Virtual DOM document
 */
export function parseHTML(html: string, baseURI: string = "about:blank"): VDocument {
  // Initialize document structure
  const document: VDocument = {
    documentElement: createElement("html"),
    body: createElement("body"),
    baseURI,
    documentURI: baseURI,
  };

  // Setup document structure
  document.documentElement.children = [];
  document.body.parent = new WeakRef(document.documentElement); // Use WeakRef

  // Currently processing element
  let currentElement: VElement = document.documentElement;
  let bodyFound = false;

  const parser = new Parser({
    onopentag(name, attributes) {
      const tagLower = name.toLowerCase();

      // Handle special cases for html and body tags
      if (tagLower === "html") {
        // Update attributes on existing documentElement
        for (const [key, value] of Object.entries(attributes)) {
          document.documentElement.attributes[key] = value;
        }
        if (attributes.id) document.documentElement.id = attributes.id;
        if (attributes.class) document.documentElement.className = attributes.class;
        currentElement = document.documentElement;
        return;
      }

      if (tagLower === "body") {
        // Update attributes on existing body
        for (const [key, value] of Object.entries(attributes)) {
          document.body.attributes[key] = value;
        }
        if (attributes.id) document.body.id = attributes.id;
        if (attributes.class) document.body.className = attributes.class;

        // If not already in documentElement, add it
        if (!bodyFound) {
          document.documentElement.children.push(document.body);
          bodyFound = true;
        }

        currentElement = document.body;
        return;
      }

      const element: VElement = {
        nodeType: "element",
        tagName: tagLower,
        attributes: {},
        children: [],
        parent: new WeakRef(currentElement), // Use WeakRef
      };

      // Set attributes
      for (const [key, value] of Object.entries(attributes)) {
        element.attributes[key] = value;
      }

      // Set special properties
      if (attributes.id) element.id = attributes.id;
      if (attributes.class) element.className = attributes.class;

      // Add to parent element
      currentElement.children.push(element);

      // Update current element
      currentElement = element;
    },
    ontext(text) {
      // Create text node
      const textNode: VText = {
        nodeType: "text",
        textContent: text,
        parent: new WeakRef(currentElement), // Use WeakRef
      };

      // Add to parent element
      currentElement.children.push(textNode);
    },
    onclosetag(name) {
      const tagLower = name.toLowerCase();

      // Don't go above documentElement for html tag
      if (tagLower === "html") {
        currentElement = document.documentElement;
        return;
      }

      // Return to parent element
      const parentRef = currentElement.parent;
      if (parentRef) {
        const parentElement = parentRef.deref();
        if (parentElement) {
          currentElement = parentElement;
        } else {
          // Parent might have been garbage collected, handle appropriately
          // For now, we might just stop traversing up or throw an error
          console.warn("Parent element not found, possibly garbage collected.");
          // Or potentially set currentElement to the root or handle differently
        }
      }
    },
  });

  parser.write(html);
  parser.end();

  return document;
}

/**
 * Serializes a virtual DOM element to an HTML string
 *
 * @param element Element to serialize
 * @returns HTML string
 */
export function serializeToHTML(element: VElement | VText): string {
  if (element.nodeType === "text") {
    return element.textContent;
  }

  const tagName = element.tagName.toLowerCase();

  // List of self-closing tags
  const selfClosingTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  // Create attribute string
  const attributes = Object.entries(element.attributes)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '"')}"`)
    .join(" ");

  const attributeString = attributes ? ` ${attributes}` : "";

  // For self-closing tags
  if (selfClosingTags.has(tagName) && element.children.length === 0) {
    return `<${tagName}${attributeString}/>`;
  }

  // For tags containing children
  const childrenHTML = element.children.map((child) => serializeToHTML(child)).join("");

  return `<${tagName}${attributeString}>${childrenHTML}</${tagName}>`;
}
