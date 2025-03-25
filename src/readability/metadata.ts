/*
 * Metadata extraction functions for readability
 * These functions extract metadata from the document
 */

import {
  VDocument,
  VElement,
  VTextNode,
  getAttribute,
  getElementsByTagName,
  forEachNode,
  getInnerText
} from '../vdom';

import {
  REGEXPS,
  HTML_ESCAPE_MAP
} from '../constants';

import { ReadabilityMetadata } from '../types';

/**
 * Get the article title as an H1.
 *
 * @param doc The document to extract title from
 * @return string
 **/
export function getArticleTitle(doc: VDocument): string {
  let curTitle = "";
  let origTitle = "";

  try {
    // Try to get title from the document
    const titleElements = getElementsByTagName(doc.documentElement, "title");
    if (titleElements.length > 0) {
      origTitle = getInnerText(titleElements[0]);
      curTitle = origTitle;
    }
  } catch (e) {
    /* ignore exceptions setting the title. */
  }

  let titleHadHierarchicalSeparators = false;
  
  function wordCount(str: string): number {
    return str.split(/\s+/).length;
  }

  // If there's a separator in the title, first remove the final part
  if (/ [\|\-\\\/>»] /.test(curTitle)) {
    titleHadHierarchicalSeparators = / [\\\/>»] /.test(curTitle);
    
    // Find all separators
    const separatorMatches: RegExpMatchArray[] = [];
    let match: RegExpMatchArray | null;
    const regex = / [\|\-\\\/>»] /g;
    
    while ((match = regex.exec(origTitle)) !== null) {
      separatorMatches.push(match);
    }
    
    if (separatorMatches.length > 0) {
      const lastSeparator = separatorMatches[separatorMatches.length - 1];
      if (lastSeparator && lastSeparator.index !== undefined) {
        curTitle = origTitle.substring(0, lastSeparator.index);
      }
    }

    // If the resulting title is too short, remove the first part instead:
    if (wordCount(curTitle) < 3) {
      curTitle = origTitle.replace(/^[^\|\-\\\/>»]*[\|\-\\\/>»]/gi, "");
    }
  } else if (curTitle.includes(": ")) {
    // Check if we have an heading containing this exact string, so we
    // could assume it's the full title.
    const headings = getElementsByTagName(doc.documentElement, ["h1", "h2"]);
    const trimmedTitle = curTitle.trim();
    
    let match = false;
    for (const heading of headings) {
      if (getInnerText(heading).trim() === trimmedTitle) {
        match = true;
        break;
      }
    }

    // If we don't, let's extract the title out of the original title string.
    if (!match) {
      curTitle = origTitle.substring(origTitle.lastIndexOf(":") + 1);

      // If the title is now too short, try the first colon instead:
      if (wordCount(curTitle) < 3) {
        curTitle = origTitle.substring(origTitle.indexOf(":") + 1);
        // But if we have too many words before the colon there's something weird
        // with the titles and the H tags so let's just use the original title instead
      } else if (wordCount(origTitle.substr(0, origTitle.indexOf(":"))) > 5) {
        curTitle = origTitle;
      }
    }
  } else if (curTitle.length > 150 || curTitle.length < 15) {
    const hOnes = getElementsByTagName(doc.documentElement, "h1");

    if (hOnes.length === 1) {
      curTitle = getInnerText(hOnes[0]);
    }
  }

  curTitle = curTitle.trim().replace(REGEXPS.normalize, " ");
  // If we now have 4 words or fewer as our title, and either no
  // 'hierarchical' separators (\, /, > or ») were found in the original
  // title or we decreased the number of words by more than 1 word, use
  // the original title.
  const curTitleWordCount = wordCount(curTitle);
  if (
    curTitleWordCount <= 4 &&
    (!titleHadHierarchicalSeparators ||
      curTitleWordCount !=
        wordCount(origTitle.replace(/[\|\-\\\/>»]+/g, "")) - 1)
  ) {
    curTitle = origTitle;
  }

  return curTitle;
}

/**
 * Converts some of the common HTML entities in string to their corresponding characters.
 *
 * @param str A string to unescape
 * @return String without HTML entities
 */
export function unescapeHtmlEntities(str: string): string {
  if (!str) {
    return str;
  }

  return str
    .replace(/&(quot|amp|apos|lt|gt);/g, function(_, tag) {
      return HTML_ESCAPE_MAP[tag as keyof typeof HTML_ESCAPE_MAP];
    })
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, function(_, hex, numStr) {
      const num = parseInt(hex || numStr, hex ? 16 : 10);

      // these character references are replaced by a conforming HTML parser
      if (num === 0 || num > 0x10ffff || (num >= 0xd800 && num <= 0xdfff)) {
        return "\uFFFD"; // replacement character
      }

      return String.fromCodePoint(num);
    });
}

/**
 * Try to extract metadata from JSON-LD object.
 * For now, only Schema.org objects of type Article or its subtypes are supported.
 * 
 * @param doc The document to extract metadata from
 * @return Object with any metadata that could be extracted (possibly none)
 */
export function getJSONLD(doc: VDocument): ReadabilityMetadata {
  const scripts = getElementsByTagName(doc.documentElement, ["script"]);
  let metadata: ReadabilityMetadata = {};

  for (const jsonLdElement of scripts) {
    if (getAttribute(jsonLdElement, "type") === "application/ld+json") {
      try {
        // Strip CDATA markers if present
        const content = (getInnerText(jsonLdElement) || "").replace(
          /^\s*<!\[CDATA\[|\]\]>\s*$/g,
          ""
        );
        let parsed = JSON.parse(content);

        if (Array.isArray(parsed)) {
          parsed = parsed.find(it => {
            return (
              it["@type"] &&
              it["@type"].match(REGEXPS.jsonLdArticleTypes)
            );
          });
          if (!parsed) {
            continue;
          }
        }

        const schemaDotOrgRegex = /^https?\:\/\/schema\.org\/?$/;
        const matches =
          (typeof parsed["@context"] === "string" &&
            parsed["@context"].match(schemaDotOrgRegex)) ||
          (typeof parsed["@context"] === "object" &&
            typeof parsed["@context"]["@vocab"] == "string" &&
            parsed["@context"]["@vocab"].match(schemaDotOrgRegex));

        if (!matches) {
          continue;
        }

        if (!parsed["@type"] && Array.isArray(parsed["@graph"])) {
          parsed = parsed["@graph"].find(it => {
            return (it["@type"] || "").match(REGEXPS.jsonLdArticleTypes);
          });
        }

        if (
          !parsed ||
          !parsed["@type"] ||
          !parsed["@type"].match(REGEXPS.jsonLdArticleTypes)
        ) {
          continue;
        }

        metadata = {};

        if (
          typeof parsed.name === "string" &&
          typeof parsed.headline === "string" &&
          parsed.name !== parsed.headline
        ) {
          // we have both name and headline element in the JSON-LD. They should both be the same but some websites like aktualne.cz
          // put their own name into "name" and the article title to "headline" which confuses Readability. So we try to check if either
          // "name" or "headline" closely matches the html title, and if so, use that one. If not, then we use "name" by default.

          const title = getArticleTitle(doc);
          const nameMatches = textSimilarity(parsed.name, title) > 0.75;
          const headlineMatches = textSimilarity(parsed.headline, title) > 0.75;

          if (headlineMatches && !nameMatches) {
            metadata.title = parsed.headline;
          } else {
            metadata.title = parsed.name;
          }
        } else if (typeof parsed.name === "string") {
          metadata.title = parsed.name.trim();
        } else if (typeof parsed.headline === "string") {
          metadata.title = parsed.headline.trim();
        }
        
        if (parsed.author) {
          if (typeof parsed.author.name === "string") {
            metadata.byline = parsed.author.name.trim();
          } else if (
            Array.isArray(parsed.author) &&
            parsed.author[0] &&
            typeof parsed.author[0].name === "string"
          ) {
            metadata.byline = parsed.author
              .filter(function(author) {
                return author && typeof author.name === "string";
              })
              .map(function(author) {
                return author.name.trim();
              })
              .join(", ");
          }
        }
        
        if (typeof parsed.description === "string") {
          metadata.excerpt = parsed.description.trim();
        }
        
        if (parsed.publisher && typeof parsed.publisher.name === "string") {
          metadata.siteName = parsed.publisher.name.trim();
        }
        
        if (typeof parsed.datePublished === "string") {
          metadata.datePublished = parsed.datePublished.trim();
        }
        
        return metadata;
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
      }
    }
  }
  
  return metadata;
}

/**
 * Attempts to get excerpt and byline metadata for the article.
 *
 * @param doc The document to extract metadata from
 * @param jsonld Object containing any metadata that could be extracted from JSON-LD object
 * @return Object with optional metadata properties
 */
export function getArticleMetadata(doc: VDocument, jsonld: ReadabilityMetadata): ReadabilityMetadata {
  const metadata: ReadabilityMetadata = {};
  const values: Record<string, string> = {};
  const metaElements = getElementsByTagName(doc.documentElement, "meta");

  // property is a space-separated list of values
  const propertyPattern = /\s*(article|dc|dcterm|og|twitter)\s*:\s*(author|creator|description|published_time|title|site_name)\s*/gi;

  // name is a single value
  const namePattern = /^\s*(?:(dc|dcterm|og|twitter|parsely|weibo:(article|webpage))\s*[-\.:]\s*)?(author|creator|pub-date|description|title|site_name)\s*$/i;

  // Find description tags.
  forEachNode(metaElements, function(element) {
    const elementName = getAttribute(element, "name");
    const elementProperty = getAttribute(element, "property");
    const content = getAttribute(element, "content");
    
    if (!content) {
      return;
    }
    
    let matches = null;
    let name = null;

    if (elementProperty) {
      let propertyMatches: RegExpMatchArray | null;
      const regex = new RegExp(propertyPattern);
      
      if ((propertyMatches = regex.exec(elementProperty)) !== null) {
        // Convert to lowercase, and remove any whitespace
        // so we can match below.
        name = propertyMatches[0].toLowerCase().replace(/\s/g, "");
        // multiple authors
        values[name] = content.trim();
      }
    }
    
    if (!matches && elementName && namePattern.test(elementName)) {
      name = elementName;
      if (content) {
        // Convert to lowercase, remove any whitespace, and convert dots
        // to colons so we can match below.
        name = name.toLowerCase().replace(/\s/g, "").replace(/\./g, ":");
        values[name] = content.trim();
      }
    }
  });

  // get title
  metadata.title =
    jsonld.title ||
    values["dc:title"] ||
    values["dcterm:title"] ||
    values["og:title"] ||
    values["weibo:article:title"] ||
    values["weibo:webpage:title"] ||
    values.title ||
    values["twitter:title"] ||
    values["parsely-title"];

  if (!metadata.title) {
    metadata.title = getArticleTitle(doc);
  }

  const articleAuthor =
    typeof values["article:author"] === "string" &&
    !isUrl(values["article:author"])
      ? values["article:author"]
      : undefined;

  // get author
  metadata.byline =
    jsonld.byline ||
    values["dc:creator"] ||
    values["dcterm:creator"] ||
    values.author ||
    values["parsely-author"] ||
    articleAuthor;

  // get description
  metadata.excerpt =
    jsonld.excerpt ||
    values["dc:description"] ||
    values["dcterm:description"] ||
    values["og:description"] ||
    values["weibo:article:description"] ||
    values["weibo:webpage:description"] ||
    values.description ||
    values["twitter:description"];

  // get site name
  metadata.siteName = jsonld.siteName || values["og:site_name"];

  // get article published time
  metadata.publishedTime =
    jsonld.datePublished ||
    values["article:published_time"] ||
    values["parsely-pub-date"] ||
    null;

  // in many sites the meta value is escaped with HTML entities,
  // so here we need to unescape it
  if (metadata.title) metadata.title = unescapeHtmlEntities(metadata.title);
  if (metadata.byline) metadata.byline = unescapeHtmlEntities(metadata.byline);
  if (metadata.excerpt) metadata.excerpt = unescapeHtmlEntities(metadata.excerpt);
  if (metadata.siteName) metadata.siteName = unescapeHtmlEntities(metadata.siteName);
  if (metadata.publishedTime) metadata.publishedTime = unescapeHtmlEntities(metadata.publishedTime);

  return metadata;
}

/**
 * Compares second text to first one
 * 1 = same text, 0 = completely different text
 * Works by splitting both texts into words and then finding words that are unique in second text
 * The result is given by the lower length of unique parts
 * 
 * @param textA First text to compare
 * @param textB Second text to compare
 * @return Similarity score between 0 and 1
 */
export function textSimilarity(textA: string, textB: string): number {
  const tokensA = textA
    .toLowerCase()
    .split(REGEXPS.tokenize)
    .filter(Boolean);
  const tokensB = textB
    .toLowerCase()
    .split(REGEXPS.tokenize)
    .filter(Boolean);
  if (!tokensA.length || !tokensB.length) {
    return 0;
  }
  const uniqTokensB = tokensB.filter(token => !tokensA.includes(token));
  const distanceB = uniqTokensB.join(" ").length / tokensB.join(" ").length;
  return 1 - distanceB;
}

/**
 * Tests whether a string is a URL or not.
 *
 * @param str The string to test
 * @return true if str is a URL, false if not
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
