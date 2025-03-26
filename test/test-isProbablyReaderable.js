/* eslint-env node, mocha */

var JSDOM = require("jsdom").JSDOM;
import { describe, it, expect } from "vitest";

var testPages = require("./utils").getTestPages();
var isProbablyReaderable = require("../_original/index").isProbablyReaderable;

describe("isProbablyReaderable - test pages", function () {
  testPages.forEach(function (testPage) {
    var uri = "http://fakehost/test/page.html";
    describe(testPage.dir, function () {
      var doc = new JSDOM(testPage.source, {
        url: uri,
      }).window.document;
      var expected = testPage.expectedMetadata.readerable;
      it(
        "The result should " + (expected ? "" : "not ") + "be readerable",
        function () {
          expect(isProbablyReaderable(doc)).toEqual(expected);
        }
      );
    });
  });
});

describe("isProbablyReaderable", function () {
  const makeDoc = (source) => new JSDOM(source).window.document;
  var verySmallDoc = makeDoc('<html><p id="main">hello there</p></html>'); // content length: 11
  var smallDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(11)}</p></html>`
  ); // content length: 132
  var largeDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(12)}</p></html>`
  ); // content length: 144
  var veryLargeDoc = makeDoc(
    `<html><p id="main">${"hello there ".repeat(50)}</p></html>`
  ); // content length: 600

  it("should only declare large documents as readerable when default options", function () {
    expect(isProbablyReaderable(verySmallDoc), "very small doc").toBe(false); // score: 0
    expect(isProbablyReaderable(smallDoc), "small doc").toBe(false); // score: 0
    expect(isProbablyReaderable(largeDoc), "large doc").toBe(false); // score: ~1.7
    expect(isProbablyReaderable(veryLargeDoc), "very large doc").toBe(true); // score: ~21.4
  });

  it("should declare small and large documents as readerable when lower minContentLength", function () {
    var options = { minContentLength: 120, minScore: 0 };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    );
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(true);
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true);
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    );
  });

  it("should only declare largest document as readerable when higher minContentLength", function () {
    var options = { minContentLength: 200, minScore: 0 };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    );
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(false);
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(false);
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    );
  });

  it("should declare small and large documents as readerable when lower minScore", function () {
    var options = { minContentLength: 0, minScore: 4 };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    ); // score: ~3.3
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(true); // score: ~11.4
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true); // score: ~11.9
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    ); // score: ~24.4
  });

  it("should declare large documents as readerable when higher minScore", function () {
    var options = { minContentLength: 0, minScore: 11.5 };
    expect(isProbablyReaderable(verySmallDoc, options), "very small doc").toBe(
      false
    ); // score: ~3.3
    expect(isProbablyReaderable(smallDoc, options), "small doc").toBe(false); // score: ~11.4
    expect(isProbablyReaderable(largeDoc, options), "large doc").toBe(true); // score: ~11.9
    expect(isProbablyReaderable(veryLargeDoc, options), "very large doc").toBe(
      true
    ); // score: ~24.4
  });

  it("should use node visibility checker provided as option - not visible", function () {
    var called = false;
    var options = {
      visibilityChecker() {
        called = true;
        return false;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(false);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as option - visible", function () {
    var called = false;
    var options = {
      visibilityChecker() {
        called = true;
        return true;
      },
    };
    expect(isProbablyReaderable(veryLargeDoc, options)).toBe(true);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as parameter - not visible", function () {
    var called = false;
    var visibilityChecker = () => {
      called = true;
      return false;
    };
    expect(isProbablyReaderable(veryLargeDoc, visibilityChecker)).toBe(false);
    expect(called).toBe(true);
  });

  it("should use node visibility checker provided as parameter - visible", function () {
    var called = false;
    var visibilityChecker = () => {
      called = true;
      return true;
    };
    expect(isProbablyReaderable(veryLargeDoc, visibilityChecker)).toBe(true);
    expect(called).toBe(true);
  });
});
