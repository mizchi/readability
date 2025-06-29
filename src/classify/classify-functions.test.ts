import { describe, it, expect } from "vitest";
import {
  getExpectedPageTypeByUrl,
  analyzeUrlPattern,
  analyzeContentCharacteristics,
} from "./classify";
import { PageType } from "../types";
import { DEFAULT_CHAR_THRESHOLD } from "../constants";

describe("classify module", () => {
  describe("getExpectedPageTypeByUrl", () => {
    it("should classify URLs with /articles/ as ARTICLE", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/articles/test")).toBe(PageType.ARTICLE);
      expect(getExpectedPageTypeByUrl("https://blog.com/2024/articles/post")).toBe(
        PageType.ARTICLE
      );
    });

    it("should classify deep paths (3+ levels) as ARTICLE", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/blog/2024/my-post")).toBe(
        PageType.ARTICLE
      );
      expect(getExpectedPageTypeByUrl("https://site.com/category/subcategory/item")).toBe(
        PageType.ARTICLE
      );
    });

    it("should classify URLs with numeric IDs as ARTICLE", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/posts/12345")).toBe(PageType.ARTICLE);
      expect(getExpectedPageTypeByUrl("https://blog.com/p/123456789")).toBe(PageType.ARTICLE);
    });

    it("should classify URLs with alphanumeric IDs as ARTICLE", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/post/abc123def")).toBe(PageType.ARTICLE);
      expect(getExpectedPageTypeByUrl("https://site.com/entry/a1b2c3d4e5")).toBe(PageType.ARTICLE);
    });

    it("should classify URLs with UUID-like patterns as ARTICLE", () => {
      expect(
        getExpectedPageTypeByUrl("https://example.com/post/550e8400-e29b-41d4-a716-446655440000")
      ).toBe(PageType.ARTICLE);
      expect(getExpectedPageTypeByUrl("https://site.com/entry/abc-def-123")).toBe(PageType.ARTICLE);
    });

    it("should not classify short paths as ARTICLE", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/")).toBe(PageType.OTHER);
      expect(getExpectedPageTypeByUrl("https://example.com/about")).toBe(PageType.OTHER);
      expect(getExpectedPageTypeByUrl("https://example.com/blog")).toBe(PageType.OTHER);
    });

    it("should handle file extensions correctly", () => {
      expect(getExpectedPageTypeByUrl("https://example.com/posts/12345.html")).toBe(
        PageType.ARTICLE
      );
      expect(getExpectedPageTypeByUrl("https://blog.com/entry/abc123.php")).toBe(PageType.ARTICLE);
    });
  });

  describe("analyzeUrlPattern", () => {
    it("should classify URL patterns correctly", () => {
      expect(analyzeUrlPattern("https://example.com/")).toBe("末尾なし");
      expect(analyzeUrlPattern("https://example.com/posts/12345")).toBe("数字のみ (12345)");
      expect(analyzeUrlPattern("https://example.com/post/abc123def")).toBe(
        "英数字混合 (abc123def)"
      );
      expect(analyzeUrlPattern("https://example.com/about/contact")).toBe("英字のみ (contact)");
      expect(analyzeUrlPattern("https://example.com/日本語")).toBe("その他 (日本語)");
    });

    it("should handle file extensions correctly", () => {
      expect(analyzeUrlPattern("https://example.com/posts/12345.html")).toBe("数字のみ (12345)");
      expect(analyzeUrlPattern("https://example.com/entry/abc123.php")).toBe("英数字混合 (abc123)");
      expect(analyzeUrlPattern("https://example.com/page.aspx")).toBe("英字のみ (page)");
    });

    it("should handle special characters", () => {
      expect(analyzeUrlPattern("https://example.com/post/my-article-title")).toBe(
        "英字のみ (my-article-title)"
      );
      expect(analyzeUrlPattern("https://example.com/posts/article_123")).toBe(
        "英数字混合 (article_123)"
      );
      expect(analyzeUrlPattern("https://example.com/550e8400-e29b-41d4-a716")).toBe(
        "英数字混合 (550e8400-e29b-41d4-a716)"
      );
    });
  });

  describe("analyzeContentCharacteristics", () => {
    it("should analyze content without candidates", () => {
      // Mock empty candidates
      const mockDoc = {
        body: {
          children: [],
          tagName: "body",
          nodeType: "element",
        },
      } as any;

      const result = analyzeContentCharacteristics(mockDoc, []);
      expect(result.pageType).toBe(PageType.OTHER);
      expect(result.reasons).toContain("コンテンツ候補が見つかりませんでした");
    });

    it("should detect semantic tags", () => {
      const mockDoc = {
        body: {
          children: [],
          tagName: "body",
          nodeType: "element",
        },
      } as any;

      const mockCandidate = {
        tagName: "article",
        children: [],
        nodeType: "element",
        textContent: "A".repeat(300), // 300 characters
      } as any;

      const result = analyzeContentCharacteristics(mockDoc, [mockCandidate]);
      expect(result.reasons.some((r) => r.includes("セマンティックタグ"))).toBe(true);
    });
  });
});
