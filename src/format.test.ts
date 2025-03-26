import { describe, test, expect } from "vitest";
import { toHTML } from "./format";
import { createElement, createTextNode } from "./dom";
import type { VElement } from "./types";

describe("toHTML function", () => {
  test("should remove span tags but keep their content", () => {
    const element: VElement = createElement("div");
    element.children.push(createTextNode("Hello "));
    const span1 = createElement("span");
    span1.children.push(createTextNode("world"));
    element.children.push(span1);
    element.children.push(createTextNode("!"));

    const expectedHTML = "<div>Hello world!</div>";
    expect(toHTML(element)).toBe(expectedHTML);
  });

  test("should remove class attributes from all elements", () => {
    const element: VElement = createElement("div");
    element.attributes.class = "container"; // Add class to div
    element.attributes.id = "main"; // Keep other attributes like id

    const p1 = createElement("p");
    p1.attributes.class = "intro"; // Add class to p
    p1.children.push(createTextNode("This is a paragraph."));
    element.children.push(p1);

    const spanInP = createElement("span");
    spanInP.attributes.class = "highlight"; // Add class to span
    spanInP.children.push(createTextNode(" Important text."));
    p1.children.push(spanInP); // Add span inside p

    const expectedHTML =
      '<div id="main"><p>This is a paragraph. Important text.</p></div>';
    expect(toHTML(element)).toBe(expectedHTML);
  });

  test("should handle nested spans and other elements correctly", () => {
    const element: VElement = createElement("article");
    element.attributes.class = "post";

    const h1 = createElement("h1");
    h1.attributes.class = "title";
    h1.children.push(createTextNode("Test Title"));
    element.children.push(h1);

    const p1 = createElement("p");
    p1.attributes.class = "content";
    p1.children.push(createTextNode("Some text "));

    const outerSpan = createElement("span");
    outerSpan.attributes.class = "outer";
    outerSpan.children.push(createTextNode("with an "));

    const innerSpan = createElement("span");
    innerSpan.attributes.class = "inner important"; // Multiple classes
    innerSpan.children.push(createTextNode("inner span"));
    outerSpan.children.push(innerSpan);

    outerSpan.children.push(createTextNode(" inside."));
    p1.children.push(outerSpan);
    element.children.push(p1);

    const img = createElement("img");
    img.attributes.src = "image.jpg";
    img.attributes.class = "featured"; // Class on self-closing tag
    element.children.push(img);

    const expectedHTML =
      '<article><h1>Test Title</h1><p>Some text with an inner span inside.</p><img src="image.jpg"/></article>';
    expect(toHTML(element)).toBe(expectedHTML);
  });

  test("should handle self-closing tags correctly, removing class", () => {
    const element: VElement = createElement("div");
    const br = createElement("br");
    br.attributes.class = "break"; // Class on br
    element.children.push(br);
    const hr = createElement("hr");
    hr.attributes.class = "divider"; // Class on hr
    element.children.push(hr);
    const img = createElement("img");
    img.attributes.src = "test.png";
    img.attributes.class = "icon"; // Class on img
    img.attributes.alt = "test"; // Keep alt attribute
    element.children.push(img);

    const expectedHTML =
      '<div><br/><hr/><img src="test.png" alt="test"/></div>';
    expect(toHTML(element)).toBe(expectedHTML);
  });

  test("should return empty string for null input", () => {
    expect(toHTML(null)).toBe("");
  });
});
