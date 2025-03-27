import { describe, it, expect } from "vitest";
import type { LinkInfo, PageMetadata, VElement } from "../types.ts";
import { analyzeLinkHierarchy, LinkHierarchyAnalysis } from "./hierarchy.ts";

// Helper to create mock LinkInfo
const createMockLink = (href: string | null, text = ""): LinkInfo => ({
  // Mock VElement - structure doesn't matter for this test
  element: {
    nodeType: "element",
    tagName: "a",
    attributes: href ? { href } : {},
    children: [{ nodeType: "text", textContent: text }],
  } as VElement,
  score: 0,
  text,
  href,
});

describe("analyzeLinkHierarchy", () => {
  const currentUrl = "https://example.com/articles/tech/web-development";
  const metadata: PageMetadata = {
    title: "Test Page",
    url: currentUrl,
  };

  it("should return empty analysis if metadata or URL is missing", () => {
    const links = [createMockLink("/articles/tech/other")];
    expect(analyzeLinkHierarchy(links, undefined)).toEqual({
      parent: [],
      sibling: [],
      child: [],
      external: [],
    });
    expect(
      analyzeLinkHierarchy(links, { title: "No URL" } as PageMetadata)
    ).toEqual({
      parent: [],
      sibling: [],
      child: [],
      external: [],
    });
  });

  it("should return empty analysis if links array is missing or empty", () => {
    expect(analyzeLinkHierarchy(undefined, metadata)).toEqual({
      parent: [],
      sibling: [],
      child: [],
      external: [],
    });
    expect(analyzeLinkHierarchy([], metadata)).toEqual({
      parent: [],
      sibling: [],
      child: [],
      external: [],
    });
  });

  it("should correctly categorize links", () => {
    const links: LinkInfo[] = [
      createMockLink("https://example.com/articles/tech"), // Parent
      createMockLink("/articles/tech/"), // Parent (relative)
      createMockLink("../"), // Parent (relative)
      createMockLink("https://example.com/articles/tech/security"), // Sibling
      createMockLink("mobile-apps"), // Sibling (relative)
      createMockLink("/articles/tech/mobile-apps"), // Sibling (relative, absolute path)
      createMockLink(
        "https://example.com/articles/tech/web-development/details"
      ), // Child
      createMockLink("details/more"), // Child (relative)
      createMockLink("/articles/tech/web-development/details/more"), // Child (relative, absolute path)
      createMockLink("https://othersite.com/page"), // External
      createMockLink("//anotherdomain.net/resource"), // External (protocol-relative)
      createMockLink("mailto:test@example.com"), // External (mailto)
      createMockLink(null), // Invalid (no href)
      createMockLink(""), // Root path -> Parent
      createMockLink("/"), // Root path -> Parent
      createMockLink("https://example.com/"), // Root path -> Parent
      createMockLink("https://example.com/articles"), // Ancestor -> Parent
      createMockLink("/articles"), // Ancestor -> Parent (relative)
      createMockLink("#section"), // Fragment -> Should be ignored by initial check
      createMockLink("?query=param"), // Query -> Should be ignored by initial check
      createMockLink(currentUrl), // Self -> Should be ignored by path check
      createMockLink("web-development"), // Self (relative) -> Should be ignored by path check
    ];

    const expected: LinkHierarchyAnalysis = {
      parent: [
        links[0], // https://example.com/articles/tech
        links[1], // /articles/tech/ (resolves to same as above)
        links[2], // ../ (resolves to /articles/tech/)
        links[14], // "" (resolves to /)
        links[15], // /
        links[16], // https://example.com/ (resolves to /)
        links[17], // https://example.com/articles
        links[18], // /articles (resolves to /articles)
        // links[19] (#section) is ignored
        // links[20] (?query=param) is ignored
        // links[21] (currentUrl) is ignored
        // links[22] (web-development) is ignored
      ],
      sibling: [
        links[3], // https://example.com/articles/tech/security
        links[4], // mobile-apps
        links[5], // /articles/tech/mobile-apps
      ],
      child: [
        links[6], // https://example.com/articles/tech/web-development/details
        links[7], // details/more
        links[8], // /articles/tech/web-development/details/more
      ],
      external: [
        links[9], // https://othersite.com/page
        links[10], // //anotherdomain.net/resource
        links[11], // mailto:test@example.com
      ],
    };

    const result = analyzeLinkHierarchy(links, metadata);

    // Sort arrays for comparison as order might differ slightly based on Map iteration
    Object.keys(expected).forEach((key) => {
      const k = key as keyof LinkHierarchyAnalysis;
      result[k].sort((a, b) => (a.href || "").localeCompare(b.href || ""));
      expected[k].sort((a, b) => (a.href || "").localeCompare(b.href || ""));
    });

    expect(result).toEqual(expected);
  });

  it("should handle URLs with trailing slashes consistently", () => {
    const metaWithSlash: PageMetadata = {
      ...metadata,
      url: "https://example.com/articles/tech/",
    };
    const links: LinkInfo[] = [
      createMockLink("https://example.com/articles/tech/security"), // Sibling
      createMockLink("security"), // Sibling (relative)
      createMockLink("../"), // Parent (relative) -> /articles/
      createMockLink("/articles/"), // Parent
      createMockLink("https://example.com/articles/"), // Parent
    ];
    const result = analyzeLinkHierarchy(links, metaWithSlash);
    // When base URL is /articles/tech/, links like 'security' resolve to /articles/tech/security, which is a child.
    expect(result.sibling).toHaveLength(0);
    expect(result.parent).toHaveLength(3); // ../, /articles/, https://example.com/articles/
    expect(result.child).toHaveLength(2); // security, https://example.com/articles/tech/security
    expect(result.external).toHaveLength(0);
  });

  it("should handle root URL correctly", () => {
    const rootMeta: PageMetadata = { ...metadata, url: "https://example.com/" };
    const links: LinkInfo[] = [
      createMockLink("/about"), // Child
      createMockLink("contact"), // Child
      createMockLink("https://example.com/products"), // Child
      createMockLink("/"), // Self -> Ignore
      createMockLink("https://othersite.com"), // External
    ];
    const result = analyzeLinkHierarchy(links, rootMeta);
    expect(result.child).toHaveLength(3);
    expect(result.parent).toHaveLength(0);
    expect(result.sibling).toHaveLength(0);
    expect(result.external).toHaveLength(1);
  });

  it("should ignore invalid URLs during resolution", () => {
    const links: LinkInfo[] = [
      createMockLink("http://[invalid]"),
      createMockLink("valid/path"), // Child
    ];
    const result = analyzeLinkHierarchy(links, metadata);
    expect(result.child).toHaveLength(1);
    expect(result.child[0].href).toBe("valid/path");
    expect(result.parent).toHaveLength(0);
    expect(result.sibling).toHaveLength(0);
    expect(result.external).toHaveLength(0);
  });
});
