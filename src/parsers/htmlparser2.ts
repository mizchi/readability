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
export function parseHTML(
  html: string,
  baseURI: string = "about:blank"
): VDocument {
  // Initialize document structure
  const document: VDocument = {
    documentElement: createElement("html"),
    body: createElement("body"),
    baseURI,
    documentURI: baseURI,
  };

  // Setup document structure
  document.documentElement.children = [document.body];
  document.body.parent = document.documentElement;

  // Currently processing element
  let currentElement: VElement = document.body;

  const parser = new Parser({
    onopentag(name, attributes) {
      const element: VElement = {
        nodeType: "element",
        tagName: name.toLowerCase(), // Use lowercase
        attributes: {},
        children: [],
        parent: currentElement,
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
        parent: currentElement,
      };

      // Add to parent element
      currentElement.children.push(textNode);
    },
    onclosetag() {
      // Return to parent element
      if (currentElement.parent) {
        currentElement = currentElement.parent;
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
  const childrenHTML = element.children
    .map((child) => serializeToHTML(child))
    .join("");

  return `<${tagName}${attributeString}>${childrenHTML}</${tagName}>`;
}
