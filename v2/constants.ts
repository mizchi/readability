/*
 * Copyright (c) 2010 Arc90 Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Constants used by Readability
export const FLAG_STRIP_UNLIKELYS = 0x1;
export const FLAG_WEIGHT_CLASSES = 0x2;
export const FLAG_CLEAN_CONDITIONALLY = 0x4;

// https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;

// Max number of nodes supported by this parser. Default: 0 (no limit)
export const DEFAULT_MAX_ELEMS_TO_PARSE = 0;

// The number of top candidates to consider when analysing how
// tight the competition is among candidates.
export const DEFAULT_N_TOP_CANDIDATES = 5;

// Element tags to score by default.
export const DEFAULT_TAGS_TO_SCORE = "section,h2,h3,h4,h5,h6,p,td,pre"
  .toUpperCase()
  .split(",");

// The default number of chars an article must have in order to return a result
export const DEFAULT_CHAR_THRESHOLD = 500;

// All of the regular expressions in use within readability.
// Defined up here so we don't instantiate them repeatedly in loops.
export const REGEXPS = {
  // NOTE: These two regular expressions are duplicated in
  // Readability-readerable.js. Please keep both copies in sync.
  unlikelyCandidates:
    /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
  okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,

  positive:
    /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
  negative:
    /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i,
  extraneous:
    /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
  byline: /byline|author|dateline|writtenby|p-author/i,
  replaceFonts: /<(\/?)font[^>]*>/gi,
  normalize: /\s{2,}/g,
  videos:
    /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
  shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
  nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
  prevLink: /(prev|earl|old|new|<|«)/i,
  tokenize: /\W+/g,
  whitespace: /^\s*$/,
  hasContent: /\S$/,
  hashUrl: /^#.+/,
  srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
  b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
  // Commas as used in Latin, Sindhi, Chinese and various other scripts.
  // see: https://en.wikipedia.org/wiki/Comma#Comma_variants
  commas: /\u002C|\u060C|\uFE50|\uFE10|\uFE11|\u2E41|\u2E34|\u2E32|\uFF0C/g,
  // See: https://schema.org/Article
  jsonLdArticleTypes:
    /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPosting|BlogPosting|LiveBlogPosting|DiscussionForumPosting|TechArticle|APIReference$/,
  // used to see if a node's content matches words commonly used for ad blocks or loading indicators
  adWords:
    /^(ad(vertising|vertisement)?|pub(licité)?|werb(ung)?|广告|Реклама|Anuncio)$/iu,
  loadingWords:
    /^((loading|正在加载|Загрузка|chargement|cargando)(…|\.\.\.)?)$/iu,
};

export const UNLIKELY_ROLES = [
  "menu",
  "menubar",
  "complementary",
  "navigation",
  "alert",
  "alertdialog",
  "dialog",
];

export const DIV_TO_P_ELEMS = new Set([
  "BLOCKQUOTE",
  "DL",
  "DIV",
  "IMG",
  "OL",
  "P",
  "PRE",
  "TABLE",
  "UL",
]);

export const ALTER_TO_DIV_EXCEPTIONS = ["DIV", "ARTICLE", "SECTION", "P", "OL", "UL"];

export const PRESENTATIONAL_ATTRIBUTES = [
  "align",
  "background",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "frame",
  "hspace",
  "rules",
  "style",
  "valign",
  "vspace",
];

export const DEPRECATED_SIZE_ATTRIBUTE_ELEMS = ["TABLE", "TH", "TD", "HR", "PRE"];

// The commented out elements qualify as phrasing content but tend to be
// removed by readability when put into paragraphs, so we ignore them here.
export const PHRASING_ELEMS = [
  // "CANVAS", "IFRAME", "SVG", "VIDEO",
  "ABBR",
  "AUDIO",
  "B",
  "BDO",
  "BR",
  "BUTTON",
  "CITE",
  "CODE",
  "DATA",
  "DATALIST",
  "DFN",
  "EM",
  "EMBED",
  "I",
  "IMG",
  "INPUT",
  "KBD",
  "LABEL",
  "MARK",
  "MATH",
  "METER",
  "NOSCRIPT",
  "OBJECT",
  "OUTPUT",
  "PROGRESS",
  "Q",
  "RUBY",
  "SAMP",
  "SCRIPT",
  "SELECT",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TEXTAREA",
  "TIME",
  "VAR",
  "WBR",
];

// These are the classes that readability sets itself.
export const CLASSES_TO_PRESERVE = ["page"];

// These are the list of HTML entities that need to be escaped.
export const HTML_ESCAPE_MAP: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};
