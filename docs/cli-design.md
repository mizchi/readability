# CLI Design for AI-Friendly Usage

## Design Principles

1. **Progressive Analysis**: Enable step-by-step analysis of web pages
2. **Backward Compatibility**: Default behavior remains unchanged (extract main content)
3. **AI-Friendly Output**: Structured output formats optimized for AI consumption
4. **Composable Commands**: Each analysis step can be run independently

## Command Structure

### Default Behavior (Unchanged)
```bash
readability <url>                # Extract main content as markdown (current behavior)
readability <url> -f html        # Extract main content as HTML
```

### Progressive Analysis Commands

#### 1. Structure Analysis
```bash
# Analyze page structure without content extraction
readability <url> --analyze-structure
readability <url> --analyze structure    # Alternative syntax

# Output: JSON with page type, navigation types, content areas
{
  "pageType": "article|documentation|listing|other",
  "hasMainContent": true,
  "navigations": {
    "global": true,
    "breadcrumb": true,
    "toc": true,
    "sidebar": true,
    "pagination": false
  },
  "contentAreas": {
    "header": true,
    "mainContent": true,
    "sidebar": true,
    "footer": true
  }
}
```

#### 2. Navigation Extraction
```bash
# Extract all navigations (current --nav-only behavior)
readability <url> --extract-nav
readability <url> --extract navigation

# Extract specific navigation type
readability <url> --extract-nav --type global
readability <url> --extract-nav --location sidebar

# Output: Structured navigation data
```

#### 3. Content Extraction with Context
```bash
# Extract content with surrounding context
readability <url> --extract-content --with-context
readability <url> --extract content --context full

# Output: Content with metadata about its location and relationship
```

#### 4. Full Document Analysis
```bash
# Complete analysis in one command
readability <url> --full-analysis
readability <url> --analyze full

# Output: Complete structured document
{
  "structure": { ... },
  "navigations": { ... },
  "content": { ... },
  "metadata": { ... }
}
```

### AI-Optimized Formats

#### 1. Summary Format
```bash
readability <url> --format ai-summary

# Output: Concise summary for AI context
{
  "url": "...",
  "type": "documentation",
  "title": "...",
  "summary": "Brief description of the page",
  "mainTopics": ["topic1", "topic2"],
  "navigationSummary": {
    "breadcrumb": "Home > Docs > API",
    "sections": 5,
    "hasTableOfContents": true
  }
}
```

#### 2. Structured Format
```bash
readability <url> --format ai-structured

# Output: Hierarchical structure optimized for AI parsing
{
  "metadata": { ... },
  "structure": {
    "header": { ... },
    "navigation": { ... },
    "content": {
      "main": { ... },
      "sections": [ ... ]
    },
    "sidebar": { ... }
  }
}
```

### Chaining Commands (Unix Philosophy)

```bash
# First analyze structure
STRUCTURE=$(readability <url> --analyze-structure)

# Based on structure, extract specific parts
if [[ $(echo $STRUCTURE | jq '.navigations.sidebar') == "true" ]]; then
  readability <url> --extract-nav --location sidebar
fi

# Or use pipes
readability <url> --analyze-structure | \
  jq -r '.pageType' | \
  xargs -I {} readability <url> --extract-content --mode {}
```

## Implementation Plan

### Phase 1: Command Parser Refactoring
- Add subcommand support (`--analyze`, `--extract`)
- Maintain backward compatibility
- Add command aliases for flexibility

### Phase 2: Progressive Analysis
- Implement structure analysis without full extraction
- Add navigation-only extraction modes
- Enable content extraction with context

### Phase 3: AI-Optimized Formats
- Add AI-friendly output formats
- Implement summary generation
- Add structured hierarchical output

### Phase 4: Advanced Features
- Add caching for multi-step analysis
- Implement format conversion between outputs
- Add filtering and transformation options

## Examples for AI Usage

### 1. Documentation Site Analysis
```bash
# Step 1: Understand the structure
readability https://docs.example.com --analyze-structure

# Step 2: Extract navigation if it's a documentation site
readability https://docs.example.com --extract-nav --type sidebar

# Step 3: Extract content with context
readability https://docs.example.com --extract-content --with-context
```

### 2. Article Extraction with Metadata
```bash
# Single command for article analysis
readability https://blog.example.com/post --format ai-structured

# Returns structured data perfect for AI consumption
```

### 3. Progressive Enhancement
```bash
# Start with basic analysis
ANALYSIS=$(readability <url> --analyze-structure)

# Progressively extract more based on page type
case $(echo $ANALYSIS | jq -r '.pageType') in
  "documentation")
    readability <url> --doc-mode
    ;;
  "article")
    readability <url> --format ai-summary
    ;;
  *)
    readability <url>  # Default extraction
    ;;
esac
```