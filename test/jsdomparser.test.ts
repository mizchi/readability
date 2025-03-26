import { describe, it, expect } from "vitest";
// @ts-ignore
const JSDOMParser = require("../_original/JSDOMParser");

const BASETESTCASE =
  '<html><body><p>Some text and <a class="someclass" href="#">a link</a></p>' +
  '<div id="foo">With a <script>With < fancy " characters in it because' +
  '</script> that is fun.<span>And another node to make it harder</span></div><form><input type="text"/><input type="number"/>Here\'s a form</form></body></html>';

// Assuming JSDOMParser returns a DOM-like object, potentially needing specific typing
const baseDoc = new JSDOMParser().parse(BASETESTCASE, "http://fakehost/");

describe("Test JSDOM functionality", () => {
  // Helper function for node comparison, using 'any' for broad compatibility
  function nodeExpect(actual: any, expected: any) {
    try {
      expect(actual).toEqual(expected);
    } catch (ex: any) {
      throw new Error(ex.message); // Throw Error object
    }
  }

  it("should work for basic operations using the parent child hierarchy and innerHTML", () => {
    expect(baseDoc.childNodes.length).toEqual(1);
    expect(baseDoc.getElementsByTagName("*").length).toEqual(10);
    const foo = baseDoc.getElementById("foo");
    expect(foo.parentNode.localName).toEqual("body");
    nodeExpect(baseDoc.body, foo.parentNode);
    nodeExpect(baseDoc.body.parentNode, baseDoc.documentElement);
    expect(baseDoc.body.childNodes.length).toEqual(3);

    let generatedHTML = baseDoc.getElementsByTagName("p")[0].innerHTML;
    expect(generatedHTML).toEqual(
      'Some text and <a class="someclass" href="#">a link</a>'
    );
    const scriptNode = baseDoc.getElementsByTagName("script")[0];
    generatedHTML = scriptNode.innerHTML;
    expect(generatedHTML).toEqual('With < fancy " characters in it because');
    expect(scriptNode.textContent).toEqual(
      'With < fancy " characters in it because'
    );
  });

  it("should have basic URI information", () => {
    // Note: Vitest's expect doesn't take a second argument for message like Chai's
    expect(baseDoc.documentURI).toEqual("http://fakehost/");
    expect(baseDoc.baseURI).toEqual("http://fakehost/");
  });

  it("should deal with script tags", () => {
    const scripts = baseDoc.getElementsByTagName("script");
    expect(scripts.length).toEqual(1);
    expect(scripts[0].textContent).toEqual(
      'With < fancy " characters in it because'
    );
  });

  it("should have working sibling/first+lastChild properties", () => {
    const foo = baseDoc.getElementById("foo");

    nodeExpect(foo.previousSibling.nextSibling, foo);
    nodeExpect(foo.nextSibling.previousSibling, foo);
    nodeExpect(foo.nextSibling, foo.nextElementSibling);
    nodeExpect(foo.previousSibling, foo.previousElementSibling);

    const beforeFoo = foo.previousSibling;
    const afterFoo = foo.nextSibling;

    nodeExpect(baseDoc.body.lastChild, afterFoo);
    nodeExpect(baseDoc.body.firstChild, beforeFoo);
  });

  it("should have working removeChild and appendChild functionality", () => {
    const foo = baseDoc.getElementById("foo");
    const beforeFoo = foo.previousSibling;
    const afterFoo = foo.nextSibling;

    const removedFoo = foo.parentNode.removeChild(foo);
    nodeExpect(foo, removedFoo);
    nodeExpect(foo.parentNode, null);
    nodeExpect(foo.previousSibling, null);
    nodeExpect(foo.nextSibling, null);
    nodeExpect(foo.previousElementSibling, null);
    nodeExpect(foo.nextElementSibling, null);

    expect(beforeFoo.localName).toEqual("p");
    nodeExpect(beforeFoo.nextSibling, afterFoo);
    nodeExpect(afterFoo.previousSibling, beforeFoo);
    nodeExpect(beforeFoo.nextElementSibling, afterFoo);
    nodeExpect(afterFoo.previousElementSibling, beforeFoo);

    expect(baseDoc.body.childNodes.length).toEqual(2);

    baseDoc.body.appendChild(foo);

    expect(baseDoc.body.childNodes.length).toEqual(3);
    nodeExpect(afterFoo.nextSibling, foo);
    nodeExpect(foo.previousSibling, afterFoo);
    nodeExpect(afterFoo.nextElementSibling, foo);
    nodeExpect(foo.previousElementSibling, afterFoo);

    // This should reorder back to sanity:
    baseDoc.body.appendChild(afterFoo);
    nodeExpect(foo.previousSibling, beforeFoo);
    nodeExpect(foo.nextSibling, afterFoo);
    nodeExpect(foo.previousElementSibling, beforeFoo);
    nodeExpect(foo.nextElementSibling, afterFoo);

    nodeExpect(foo.previousSibling.nextSibling, foo);
    nodeExpect(foo.nextSibling.previousSibling, foo);
    nodeExpect(foo.nextSibling, foo.nextElementSibling);
    nodeExpect(foo.previousSibling, foo.previousElementSibling);
  });

  it("should handle attributes", () => {
    const link = baseDoc.getElementsByTagName("a")[0];
    expect(link.getAttribute("href")).toEqual("#");
    expect(link.getAttribute("class")).toEqual(link.className);
    const foo = baseDoc.getElementById("foo");
    expect(foo.id).toEqual(foo.getAttribute("id"));
  });

  it("should have a working replaceChild", () => {
    const parent = baseDoc.getElementsByTagName("div")[0];
    const p = baseDoc.createElement("p");
    p.setAttribute("id", "my-replaced-kid");
    const childCount = parent.childNodes.length;
    const childElCount = parent.children.length;
    for (let i = 0; i < parent.childNodes.length; i++) {
      const replacedNode = parent.childNodes[i];
      const replacedAnElement =
        replacedNode.nodeType === replacedNode.ELEMENT_NODE; // Assuming ELEMENT_NODE is accessible
      const oldNext = replacedNode.nextSibling;
      const oldNextEl = replacedNode.nextElementSibling;
      const oldPrev = replacedNode.previousSibling;
      const oldPrevEl = replacedNode.previousElementSibling;

      parent.replaceChild(p, replacedNode);
      // Check siblings and parents on both nodes were set:
      nodeExpect(p.nextSibling, oldNext);
      nodeExpect(p.previousSibling, oldPrev);
      nodeExpect(p.parentNode, parent);

      nodeExpect(replacedNode.parentNode, null);
      nodeExpect(replacedNode.nextSibling, null);
      nodeExpect(replacedNode.previousSibling, null);
      // if the old node was an element, element siblings should now be null
      if (replacedAnElement) {
        nodeExpect(replacedNode.nextElementSibling, null);
        nodeExpect(replacedNode.previousElementSibling, null);
      }

      // Check the siblings were updated
      if (oldNext) {
        nodeExpect(oldNext.previousSibling, p);
      }
      if (oldPrev) {
        nodeExpect(oldPrev.nextSibling, p);
      }

      // check the array was updated
      nodeExpect(parent.childNodes[i], p);

      // Now check element properties/lists:;
      const kidElementIndex = Array.from(parent.children).indexOf(p); // Use Array.from for NodeListOf<Element>
      // should be in the list:
      expect(kidElementIndex).not.toEqual(-1);

      if (kidElementIndex > 0) {
        nodeExpect(
          parent.children[kidElementIndex - 1],
          p.previousElementSibling
        );
        nodeExpect(p.previousElementSibling.nextElementSibling, p);
      } else {
        nodeExpect(p.previousElementSibling, null);
      }
      if (kidElementIndex < parent.children.length - 1) {
        nodeExpect(parent.children[kidElementIndex + 1], p.nextElementSibling);
        nodeExpect(p.nextElementSibling.previousElementSibling, p);
      } else {
        nodeExpect(p.nextElementSibling, null);
      }

      if (replacedAnElement) {
        nodeExpect(oldNextEl, p.nextElementSibling);
        nodeExpect(oldPrevEl, p.previousElementSibling);
      }

      expect(parent.childNodes.length).toEqual(childCount);
      expect(parent.children.length).toEqual(
        replacedAnElement ? childElCount : childElCount + 1
      );

      parent.replaceChild(replacedNode, p);

      nodeExpect(oldNext, replacedNode.nextSibling);
      nodeExpect(oldNextEl, replacedNode.nextElementSibling);
      nodeExpect(oldPrev, replacedNode.previousSibling);
      nodeExpect(oldPrevEl, replacedNode.previousElementSibling);
      if (replacedNode.nextSibling) {
        nodeExpect(replacedNode.nextSibling.previousSibling, replacedNode);
      }
      if (replacedNode.previousSibling) {
        nodeExpect(replacedNode.previousSibling.nextSibling, replacedNode);
      }
      if (replacedAnElement) {
        if (replacedNode.previousElementSibling) {
          nodeExpect(
            replacedNode.previousElementSibling.nextElementSibling,
            replacedNode
          );
        }
        if (replacedNode.nextElementSibling) {
          nodeExpect(
            replacedNode.nextElementSibling.previousElementSibling,
            replacedNode
          );
        }
      }
    }
  });
});

describe("Test HTML escaping", () => {
  const baseStr =
    "<p>Hello, everyone &amp; all their friends, &lt;this&gt; is a \" test with ' quotes.</p>";
  const doc = new JSDOMParser().parse(baseStr);
  const p = doc.getElementsByTagName("p")[0];
  const txtNode = p.firstChild;
  it("should handle encoding HTML correctly", () => {
    // This /should/ just be cached straight from reading it:;
    expect("<p>" + p.innerHTML + "</p>").toEqual(baseStr);
    expect("<p>" + txtNode.innerHTML + "</p>").toEqual(baseStr);
  });

  it("should have decoded correctly", () => {
    expect(p.textContent).toEqual(
      "Hello, everyone & all their friends, <this> is a \" test with ' quotes."
    );
    expect(txtNode.textContent).toEqual(
      "Hello, everyone & all their friends, <this> is a \" test with ' quotes."
    );
  });

  it("should handle updates via textContent correctly", () => {
    // Because the initial tests might be based on cached innerHTML values,
    // let's manipulate via textContent in order to test that it alters
    // the innerHTML correctly.
    txtNode.textContent = txtNode.textContent + " ";
    txtNode.textContent = txtNode.textContent?.trim(); // Add null check for trim
    // Use regex for global replacement and handle potential null from baseStr if necessary
    const expectedHTML = baseStr
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    expect("<p>" + txtNode.innerHTML + "</p>").toEqual(expectedHTML);
    expect("<p>" + p.innerHTML + "</p>").toEqual(expectedHTML);
  });

  it("should handle decimal and hex escape sequences", () => {
    const parsedDoc = new JSDOMParser().parse("<p>&#32;&#x20;</p>");
    expect(parsedDoc.getElementsByTagName("p")[0].textContent).toEqual("  ");
  });
});

describe("Script parsing", () => {
  it("should strip ?-based comments within script tags", () => {
    const html = '<script><?Silly test <img src="test"></script>';
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("SCRIPT");
    expect(doc.firstChild.textContent).toEqual("");
    expect(doc.firstChild.children.length).toEqual(0);
    expect(doc.firstChild.childNodes.length).toEqual(0);
  });

  it("should strip !-based comments within script tags", () => {
    const html =
      '<script><!--Silly test > <script src="foo.js"></script>--></script>';
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("SCRIPT");
    expect(doc.firstChild.textContent).toEqual("");
    expect(doc.firstChild.children.length).toEqual(0);
    expect(doc.firstChild.childNodes.length).toEqual(0);
  });

  it("should strip any other nodes within script tags", () => {
    const html = "<script><div>Hello, I'm not really in a </div></script>";
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("SCRIPT");
    expect(doc.firstChild.textContent).toEqual(
      "<div>Hello, I'm not really in a </div>"
    );
    expect(doc.firstChild.children.length).toEqual(0);
    expect(doc.firstChild.childNodes.length).toEqual(1);
  });

  it("should strip any other invalid script nodes within script tags", () => {
    const html = '<script><script src="foo.js"></script></script>';
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("SCRIPT");
    expect(doc.firstChild.textContent).toEqual(
      '<script src="foo.js"></script>'
    );
    expect(doc.firstChild.children.length).toEqual(0);
    expect(doc.firstChild.childNodes.length).toEqual(1);
  });

  it("should not be confused by partial closing tags", () => {
    const html = "<script>var x = '<script>Hi<' + '/script>';</script>";
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("SCRIPT");
    expect(doc.firstChild.textContent).toEqual(
      "var x = '<script>Hi<' + '/script>';"
    );
    expect(doc.firstChild.children.length).toEqual(0);
    expect(doc.firstChild.childNodes.length).toEqual(1);
  });
});

describe("Tag local name case handling", () => {
  it("should lowercase tag names", () => {
    const html = "<DIV><svG><clippath/></svG></DIV>";
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.tagName).toEqual("DIV");
    expect(doc.firstChild.localName).toEqual("div");
    expect(doc.firstChild.firstChild.tagName).toEqual("SVG");
    expect(doc.firstChild.firstChild.localName).toEqual("svg");
    expect(doc.firstChild.firstChild.firstChild.tagName).toEqual("CLIPPATH");
    expect(doc.firstChild.firstChild.firstChild.localName).toEqual("clippath");
  });
});

describe("Recovery from self-closing tags that have close tags", () => {
  it("should handle delayed closing of a tag", () => {
    const html = "<div><input><p>I'm in an input</p></input></div>";
    const doc = new JSDOMParser().parse(html);
    expect(doc.firstChild.localName).toEqual("div");
    expect(doc.firstChild.childNodes.length).toEqual(1);
    expect(doc.firstChild.firstChild.localName).toEqual("input");
    expect(doc.firstChild.firstChild.childNodes.length).toEqual(1);
    expect(doc.firstChild.firstChild.firstChild.localName).toEqual("p");
  });
});

describe("baseURI parsing", () => {
  it("should handle various types of relative and absolute base URIs", () => {
    function checkBase(base: string, expectedResult: string) {
      const html =
        "<html><head><base href='" + base + "'></base></head><body/></html>";
      const doc = new JSDOMParser().parse(html, "http://fakehost/some/dir/");
      expect(doc.baseURI).toEqual(expectedResult);
    }

    checkBase("relative/path", "http://fakehost/some/dir/relative/path");
    checkBase("/path", "http://fakehost/path");
    checkBase("http://absolute/", "http://absolute/");
    checkBase("//absolute/path", "http://absolute/path");
  });
});

describe("namespace workarounds", () => {
  it("should handle random namespace information in the serialized DOM", () => {
    const html =
      "<a0:html><a0:body><a0:DIV><a0:svG><a0:clippath/></a0:svG></a0:DIV></a0:body></a0:html>";
    const doc = new JSDOMParser().parse(html);
    const div = doc.getElementsByTagName("div")[0];
    expect(div.tagName).toEqual("DIV");
    expect(div.localName).toEqual("div");
    expect(div.firstChild.tagName).toEqual("SVG");
    expect(div.firstChild.localName).toEqual("svg");
    expect(div.firstChild.firstChild.tagName).toEqual("CLIPPATH");
    expect(div.firstChild.firstChild.localName).toEqual("clippath");
    expect(doc.documentElement).toEqual(doc.firstChild); // Use toEqual for deep comparison if needed
    expect(doc.body).toEqual(doc.documentElement.firstChild); // Use toEqual for deep comparison if needed
  });
});
