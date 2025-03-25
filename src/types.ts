export interface ReadabilityOptions {
  debug?: boolean;
  maxElemsToParse?: number;
  nbTopCandidates?: number;
  charThreshold?: number;
  classesToPreserve?: string[];
  keepClasses?: boolean;
  serializer?: (element: Element) => string;
  disableJSONLD?: boolean;
  allowedVideoRegex?: RegExp;
  linkDensityModifier?: number;
}

export interface ReadabilityArticle {
  title: string;
  byline: string | null;
  dir: string | null;
  lang: string | null;
  content: string;
  textContent: string;
  length: number;
  excerpt: string | null;
  siteName: string | null;
  publishedTime: string | null;
}

export interface ReadabilityNodeScore {
  contentScore: number;
}

// Extend Element to include readability property
declare global {
  interface Element {
    readability?: ReadabilityNodeScore;
    _readabilityDataTable?: boolean;
    _isLiveNodeList?: boolean;
  }
}

export interface ReadabilityAttempt {
  articleContent: Element;
  textLength: number;
}

export interface ReadabilityMetadata {
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  datePublished?: string;
  publishedTime?: string;
}
