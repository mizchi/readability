import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
// @ts-ignore
import { getTestPages } from "./utils"; // Assuming utils.js is converted or handled
import { isProbablyReaderable } from "../_original/index";

// Define a basic type for testPage, replace 'any' with a more specific type if possible
interface TestPage {
  dir: string;
  source: string;
  expectedMetadata: {
    readerable: boolean;
    [key: string]: any; // Allow other properties
  };
  [key: string]: any; // Allow other properties
}

const testPages: TestPage[] = getTestPages();

describe("isProbablyReaderable - test pages", () => {
  testPages.forEach((testPage) => {
    const uri = "http://fakehost/test/page.html";
    describe(testPage.dir, () => {
      const doc = new JSDOM(testPage.source, {
        url: uri,
      }).window.document;
      const expected = testPage.expectedMetadata.readerable;
      it(`The result should ${expected ? "" : "not "}be readerable`, () => {
        expect(isProbablyReaderable(doc)).toEqual(expected);
      });
    });
  });
});

describe("isProbablyReaderable", () => {
  const makeDoc = (source: string): Document =>
    new JSDOM(source).window.document;
  const verySmallDoc = makeDoc('<html><p id="main">hello there</p></html>'); // content length: 11
  const smallDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(11)}</p></html>`
  ); // content length: 132
  const largeDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(12)}</p></html>`
  ); // content length: 144
  const veryLargeDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(50)}</p></html>`
  ); // content length: 600

  // Define type for options used in isProbablyReaderable
  interface IsProbablyReaderableOptions {
    minContentLength?: number;
    minScore?: number;
    visibilityChecker?: (node: Node) => boolean;
  }

  it("should only declare large documents as readerable when default options", () => {
    expect(isProbablyReaderable(verySmallDoc), "very small doc").toBe(false); // score: 0
    expect(isProbablyReaderable(smallDoc), "small doc").toBe(false); // score: 0
    expect(isProbablyReaderable(largeDoc), "large doc").toBe(false); // score: ~1.7
    expect(isProbablyReaderable(veryLargeDoc), "very large doc").toBe(true); // score: ~21.4
  });

  it("should declare small and large documents as readerable when lower minContentLength", () => {
    const options: IsProbablyReaderableOptions = {
      minContentLength: 120,
      minScore: 0,
    };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    );
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(true);
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true);
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    );
  });

  it("should only declare largest document as readerable when higher minContentLength", () => {
    const options: IsProbablyReaderableOptions = {
      minContentLength: 200,
      minScore: 0,
    };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    );
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(false);
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(false);
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    );
  });

  it("should declare small and large documents as readerable when lower minScore", () => {
    const options: IsProbablyReaderableOptions = {
      minContentLength: 0,
      minScore: 4,
    };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    ); // score: ~3.3
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(true); // score: ~11.4
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true); // score: ~11.9
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    ); // score: ~24.4
  });

  it("should declare large documents as readerable when higher minScore", () => {
    const options: IsProbablyReaderableOptions = {
      minContentLength: 0,
      minScore: 11.5,
    };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    ); // score: ~3.3
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(false); // score: ~11.4
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true); // score: ~11.9
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    ); // score: ~24.4
  });

  it("should use node visibility checker provided as option - not visible", () => {
    let called = false;
    const options = {
      visibilityChecker() {
        called = true;
        return false;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(false);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as option - visible", () => {
    let called = false;
    const options = {
      visibilityChecker() {
        called = true;
        return true;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(true);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as parameter - not visible", () => {
    let called = false;
    const options = {
      visibilityChecker: () => {
        called = true;
        return false;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(false);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as parameter - visible", () => {
    let called = false;
    const options = {
      visibilityChecker: () => {
        called = true;
        return true;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(true);
    expect(called).toBe(true);
  });
});
