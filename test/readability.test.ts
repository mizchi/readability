import { JSDOM } from "jsdom";
// @ts-ignore
import xmlNameValidator from "xml-name-validator";
import { describe, it, expect, beforeAll, vi } from "vitest";

// @ts-ignore
import { Readability, ReadabilityOptions, Article } from "../_original/index";
// @ts-ignore
import JSDOMParser from "../_original/JSDOMParser";
// @ts-ignore
import { prettyPrint, getTestPages } from "./utils";

// Define a basic type for testPage, replace 'any' with a more specific type if possible
interface TestPage {
  dir: string;
  source: string;
  expectedContent: string;
  expectedMetadata: {
    title: string;
    byline: string | null;
    excerpt: string | null;
    siteName: string | null;
    dir?: string;
    lang?: string;
    publishedTime?: string;
    [key: string]: any; // Allow other properties
  };
  [key: string]: any; // Allow other properties
}

const testPages: TestPage[] = getTestPages();

function reformatError(err: Error): Error {
  const formattedError = new Error(err.message);
  formattedError.stack = err.stack;
  return formattedError;
}

function inOrderTraverse(fromNode: Node | null): Node | null {
  if (!fromNode) return null;
  if (fromNode.firstChild) {
    return fromNode.firstChild;
  }
  while (fromNode && !fromNode.nextSibling) {
    fromNode = fromNode.parentNode;
  }
  return fromNode ? fromNode.nextSibling : null;
}

function inOrderIgnoreEmptyTextNodes(fromNode: Node | null): Node | null {
  do {
    fromNode = inOrderTraverse(fromNode);
  } while (
    fromNode &&
    fromNode.nodeType === Node.TEXT_NODE && // Use Node.TEXT_NODE
    !fromNode.textContent?.trim()
  );
  return fromNode;
}

type TraverseCallback = (
  actualNode: Node | null,
  expectedNode: Node | null
) => boolean;

function traverseDOM(
  callback: TraverseCallback,
  actualDOM: Document,
  expectedDOM: Document
) {
  let actualNode: Node | null =
    actualDOM.documentElement || actualDOM.childNodes[0];
  let expectedNode: Node | null =
    expectedDOM.documentElement || expectedDOM.childNodes[0];
  while (actualNode || expectedNode) {
    // We'll stop if we don't have both actualNode and expectedNode
    if (!callback(actualNode, expectedNode)) {
      break;
    }
    actualNode = inOrderIgnoreEmptyTextNodes(actualNode);
    expectedNode = inOrderIgnoreEmptyTextNodes(expectedNode);
  }
}

// Collapse subsequent whitespace like HTML:
function htmlTransform(str: string | null): string {
  return str ? str.replace(/\s+/g, " ") : "";
}

type DomGenerationFn = (source: string) => Document | null;

function runTestsWithItems(
  label: string,
  domGenerationFn: DomGenerationFn,
  source: string,
  expectedContent: string,
  expectedMetadata: TestPage["expectedMetadata"]
) {
  describe(label, () => {
    let result: Article | null = null; // Use Article type if available, else any

    beforeAll(() => {
      try {
        const doc = domGenerationFn(source);
        if (!doc) {
          throw new Error("DOM generation failed");
        }
        // Provide one class name to preserve, which we know appears in a few
        // of the test documents.
        const myReader = new Readability(doc, {
          classesToPreserve: ["caption"],
        } as ReadabilityOptions); // Cast options type if necessary
        result = myReader.parse();
      } catch (err: any) {
        throw reformatError(err);
      }
    });

    it("should return a result object", () => {
      expect(result).not.toBeNull();
      if (!result) return; // Type guard
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("excerpt");
      expect(result).toHaveProperty("byline");
    });

    it("should extract expected content", () => {
      if (!result || !result.content) {
        // Handle case where result or content is null/undefined
        expect.fail("Result or content is null/undefined");
        return;
      }

      function nodeStr(n: Node | null): string {
        if (!n) {
          return "(no node)";
        }
        if (n.nodeType === Node.TEXT_NODE) {
          // Use Node.TEXT_NODE
          return "#text(" + htmlTransform(n.textContent) + ")";
        }
        if (n.nodeType !== Node.ELEMENT_NODE) {
          // Use Node.ELEMENT_NODE
          return (
            "some other node type: " +
            n.nodeType +
            " with data " +
            (n as CharacterData).data // Cast to CharacterData for 'data' property
          );
        }
        const el = n as Element; // Cast to Element
        let rv = el.localName;
        if (el.id) {
          rv += "#" + el.id;
        }
        if (el.className) {
          // className can be an object (SVGAnimatedString) or string
          const classNameStr =
            typeof el.className === "string"
              ? el.className
              : (el.className as any).baseVal;
          if (classNameStr) {
            rv += ".(" + classNameStr + ")";
          }
        }
        return rv;
      }

      function genPath(node: Node): string {
        if ((node as Element).id) {
          // Cast to Element for id check
          return "#" + (node as Element).id;
        }
        if ((node as Element).tagName === "BODY") {
          // Cast to Element for tagName check
          return "body";
        }
        const parent = node.parentNode;
        if (!parent) return nodeStr(node); // Handle case where parentNode is null
        const parentPath = genPath(parent);
        // Use Array.from for NodeList
        const index =
          Array.from(parent.childNodes).indexOf(node as ChildNode) + 1; // Cast node to ChildNode
        return parentPath + " > " + nodeStr(node) + ":nth-child(" + index + ")";
      }

      function findableNodeDesc(node: Node): string {
        // Ensure parentNode and innerHTML exist before accessing
        const parentHTML = node.parentNode
          ? (node.parentNode as Element).innerHTML
          : "undefined parent";
        return genPath(node) + "(in: ``" + parentHTML + "``)";
      }

      function attributesForNode(node: Element): string[] {
        // xmlNameValidator might need specific typing or handling
        const validator = xmlNameValidator.name || xmlNameValidator; // Adjust based on actual export
        return Array.from(node.attributes)
          .filter((attr: Attr) => validator(attr.name))
          .map((attr: Attr) => attr.name + "=" + attr.value);
      }

      const actualDOM = domGenerationFn(prettyPrint(result.content));
      const expectedDOM = domGenerationFn(prettyPrint(expectedContent));

      if (!actualDOM || !expectedDOM) {
        expect.fail("DOM generation failed for actual or expected content");
        return;
      }

      traverseDOM(
        (actualNode: Node | null, expectedNode: Node | null): boolean => {
          if (actualNode && expectedNode) {
            const actualDesc = nodeStr(actualNode);
            const expectedDesc = nodeStr(expectedNode);
            if (actualDesc !== expectedDesc) {
              expect(actualDesc, findableNodeDesc(actualNode)).toEqual(
                expectedDesc
              );
              return false;
            }
            // Compare text for text nodes:
            if (actualNode.nodeType === Node.TEXT_NODE) {
              // Use Node.TEXT_NODE
              const actualText = htmlTransform(actualNode.textContent);
              const expectedText = htmlTransform(expectedNode.textContent);
              expect(actualText, findableNodeDesc(actualNode)).toEqual(
                expectedText
              );
              if (actualText !== expectedText) {
                return false;
              }
              // Compare attributes for element nodes:
            } else if (actualNode.nodeType === Node.ELEMENT_NODE) {
              // Use Node.ELEMENT_NODE
              const actualElement = actualNode as Element;
              const expectedElement = expectedNode as Element;
              const actualNodeAttributes = attributesForNode(actualElement);
              const expectedNodeAttributes = attributesForNode(expectedElement);
              const desc =
                "node " +
                nodeStr(actualNode) +
                " attributes (" +
                actualNodeAttributes.join(",") +
                ") should match (" +
                expectedNodeAttributes.join(",") +
                ") 1";
              expect(actualNodeAttributes.length, desc).toEqual(
                expectedNodeAttributes.length
              );
              for (let i = 0; i < actualNodeAttributes.length; i++) {
                // Assuming actualNodeAttributes[i] is string 'name=value'
                const attrName = actualNodeAttributes[i].split("=")[0];
                const actualValue = actualElement.getAttribute(attrName);
                const expectedValue = expectedElement.getAttribute(attrName);
                expect(
                  actualValue, // Check actualValue against expectedValue
                  "node (" +
                    findableNodeDesc(actualNode) +
                    ") attribute " +
                    attrName +
                    " should match"
                ).toEqual(expectedValue);
              }
            }
          } else {
            // Provide more context in failure message
            expect(
              nodeStr(actualNode),
              `Node mismatch: actual=${nodeStr(actualNode)}, expected=${nodeStr(expectedNode)}`
            ).toEqual(nodeStr(expectedNode));
            return false;
          }
          return true;
        },
        actualDOM,
        expectedDOM
      );
    });

    it("should extract expected title", () => {
      expect(result?.title).toEqual(expectedMetadata.title);
    });

    it("should extract expected byline", () => {
      expect(result?.byline).toEqual(expectedMetadata.byline);
    });

    it("should extract expected excerpt", () => {
      expect(result?.excerpt).toEqual(expectedMetadata.excerpt);
    });

    it("should extract expected site name", () => {
      expect(result?.siteName).toEqual(expectedMetadata.siteName);
    });

    if (expectedMetadata.dir) {
      it("should extract expected direction", () => {
        expect(result?.dir).toEqual(expectedMetadata.dir);
      });
    }

    if (expectedMetadata.lang) {
      it("should extract expected language", () => {
        expect(result?.lang).toEqual(expectedMetadata.lang);
      });
    }

    if (expectedMetadata.publishedTime) {
      it("should extract expected published time", () => {
        expect(result?.publishedTime).toEqual(expectedMetadata.publishedTime);
      });
    }
  });
}

function removeCommentNodesRecursively(node: Node) {
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.COMMENT_NODE) {
      // Use Node.COMMENT_NODE
      node.removeChild(child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      // Use Node.ELEMENT_NODE
      removeCommentNodesRecursively(child);
    }
  }
}

describe("Readability API", () => {
  describe("#constructor", () => {
    // Assuming JSDOMParser returns a Document or similar DOM structure
    const doc: any = new JSDOMParser().parse("<html><div>yo</div></html>");
    it("should accept a debug option", () => {
      expect((new Readability(doc) as any)._debug).toEqual(false);
      expect(
        (new Readability(doc, { debug: true } as ReadabilityOptions) as any)
          ._debug
      ).toEqual(true);
    });

    it("should accept a nbTopCandidates option", () => {
      expect((new Readability(doc) as any)._nbTopCandidates).toEqual(5);
      expect(
        (
          new Readability(doc, {
            nbTopCandidates: 42,
          } as ReadabilityOptions) as any
        )._nbTopCandidates
      ).toEqual(42);
    });

    it("should accept a maxElemsToParse option", () => {
      expect((new Readability(doc) as any)._maxElemsToParse).toEqual(0);
      expect(
        (
          new Readability(doc, {
            maxElemsToParse: 42,
          } as ReadabilityOptions) as any
        )._maxElemsToParse
      ).toEqual(42);
    });

    it("should accept a keepClasses option", () => {
      expect((new Readability(doc) as any)._keepClasses).toEqual(false);
      expect(
        (
          new Readability(doc, {
            keepClasses: true,
          } as ReadabilityOptions) as any
        )._keepClasses
      ).toEqual(true);
      expect(
        (
          new Readability(doc, {
            keepClasses: false,
          } as ReadabilityOptions) as any
        )._keepClasses
      ).toEqual(false);
    });

    it("should accept a allowedVideoRegex option or default it", () => {
      // Accessing prototype might need adjustment based on actual Readability structure
      const defaultVideoRegex = (Readability.prototype as any).REGEXPS?.videos;
      expect((new Readability(doc) as any)._allowedVideoRegex).toEqual(
        defaultVideoRegex
      );
      const allowedVideoRegex = /\/\/mydomain.com\/.*'/;
      expect(
        (
          new Readability(doc, {
            allowedVideoRegex,
          } as ReadabilityOptions) as any
        )._allowedVideoRegex
      ).toEqual(allowedVideoRegex);
    });
  });

  describe("#parse", () => {
    const exampleSource = testPages[0].source;

    it("shouldn't parse oversized documents as per configuration", () => {
      const doc: any = new JSDOMParser().parse("<html><div>yo</div></html>");
      expect(() => {
        new Readability(doc, {
          maxElemsToParse: 1,
        } as ReadabilityOptions).parse();
      }).toThrow("Aborting parsing document; 2 elements found");
    });

    it("should run _cleanClasses with default configuration", () => {
      const doc: any = new JSDOMParser().parse(exampleSource);
      const parser: any = new Readability(doc);

      // Mock _cleanClasses
      parser._cleanClasses = vi.fn();

      parser.parse();

      expect(parser._cleanClasses).toHaveBeenCalled();
    });

    it("should run _cleanClasses when option keepClasses = false", () => {
      const doc: any = new JSDOMParser().parse(exampleSource);
      const parser: any = new Readability(doc, {
        keepClasses: false,
      } as ReadabilityOptions);

      parser._cleanClasses = vi.fn();

      parser.parse();

      expect(parser._cleanClasses).toHaveBeenCalled();
    });

    it("shouldn't run _cleanClasses when option keepClasses = true", () => {
      const doc: any = new JSDOMParser().parse(exampleSource);
      const parser: any = new Readability(doc, {
        keepClasses: true,
      } as ReadabilityOptions);

      parser._cleanClasses = vi.fn();

      parser.parse();

      expect(parser._cleanClasses).not.toHaveBeenCalled();
    });

    it("should use custom content serializer sent as option", () => {
      const dom = new JSDOM("My cat: <img src=''>");
      const expected_xhtml =
        '<div xmlns="http://www.w3.org/1999/xhtml" id="readability-page-1" class="page">My cat: <img src="" /></div>';
      const xml = new dom.window.XMLSerializer();
      const content = new Readability(dom.window.document, {
        serializer(el: Element) {
          // Add type for el
          // Ensure firstChild exists before serializing
          return el.firstChild ? xml.serializeToString(el.firstChild) : "";
        },
      } as ReadabilityOptions).parse()?.content; // Add null check for parse result
      expect(content).toEqual(expected_xhtml);
    });

    it("should use custom video regex sent as option", () => {
      const dom = new JSDOM(
        "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc mollis leo lacus, vitae semper nisl ullamcorper ut.</p>" +
          '<iframe src="https://mycustomdomain.com/some-embeds"></iframe>'
      );
      const expected_xhtml =
        '<div id="readability-page-1" class="page">' +
        "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc mollis leo lacus, vitae semper nisl ullamcorper ut.</p>" +
        '<iframe src="https://mycustomdomain.com/some-embeds"></iframe>' +
        "</div>";
      const content = new Readability(dom.window.document, {
        charThreshold: 20,
        allowedVideoRegex: /.*mycustomdomain.com.*/,
      } as ReadabilityOptions).parse()?.content; // Add null check for parse result
      expect(content).toEqual(expected_xhtml);
    });
  });
});

describe("Test pages", () => {
  testPages.forEach((testPage) => {
    describe(testPage.dir, () => {
      const uri = "http://fakehost/test/page.html";

      runTestsWithItems(
        "jsdom",
        (source: string): Document | null => {
          try {
            const doc = new JSDOM(source, {
              url: uri,
            }).window.document;
            removeCommentNodesRecursively(doc);
            return doc;
          } catch (e) {
            console.error("JSDOM parsing failed for:", testPage.dir, e);
            return null;
          }
        },
        testPage.source,
        testPage.expectedContent,
        testPage.expectedMetadata
      );

      runTestsWithItems(
        "JSDOMParser",
        (source: string): Document | null => {
          const parser = new JSDOMParser();
          const doc: any = parser.parse(source, uri); // Assuming parse returns a Document-like object
          if (parser.errorState) {
            console.error(
              "JSDOMParser parsing caused errors:",
              parser.errorState
            );
            return null;
          }
          return doc as Document; // Cast to Document, assuming compatibility
        },
        testPage.source,
        testPage.expectedContent,
        testPage.expectedMetadata
      );
    });
  });
});
