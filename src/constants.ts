/**
 * Readability v3 - Constant Definitions
 *
 * Constants used in the content extraction algorithm
 */

// The number of top candidates to consider when analysing how
// tight the competition is among candidates.
export const DEFAULT_N_TOP_CANDIDATES = 5;

// Element tags to score by default.
export const DEFAULT_TAGS_TO_SCORE = "section,h2,h3,h4,h5,h6,p,td,pre".split(",");

// The default number of chars an article must have in order to return a result
export const DEFAULT_CHAR_THRESHOLD = 500;

// All of the regular expressions in use within readability.
export const REGEXPS = {
  // NOTE: These two regular expressions are duplicated in
  // Readability-readerable.js. Please keep both copies in sync.
  unlikelyCandidates:
    /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
  okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,

  positive: /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
  negative:
    /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i,

  // Commas as used in Latin, Sindhi, Chinese and various other scripts.
  commas: /\u002C|\u060C|\uFE50|\uFE10|\uFE11|\u2E41|\u2E34|\u2E32|\uFF0C/g,

  // For normalizing whitespace
  normalize: /\s{2,}/g,
};

// DIV_TO_P_ELEMS is used for hasChildBlockElement
export const DIV_TO_P_ELEMS = new Set([
  "blockquote",
  "dl",
  "div",
  "img",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

// PHRASING_ELEMS is used for isPhrasingContent
export const PHRASING_ELEMS = [
  // Existing elements converted to lowercase
  "abbr",
  "audio",
  "b",
  "bdo",
  "br",
  "button",
  "cite",
  "code",
  "data",
  "datalist",
  "dfn",
  "em",
  "embed",
  "i",
  "img",
  "input",
  "kbd",
  "label",
  "mark",
  "math",
  "meter",
  "noscript",
  "object",
  "output",
  "progress",
  "q",
  "ruby",
  "samp",
  "script",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "textarea",
  "time",
  "var",
  "wbr",
];
