/**
 * Readability v3 - Default HTML Parser Export
 *
 * Re-exports the default parser implementation (currently htmlparser2).
 * This allows users to import the default parser without knowing the specific implementation file.
 */

// Re-export the default parser implementation
export { parseHTML, serializeToHTML } from "./htmlparser2.ts";

// Potentially, other parser implementations could be added here or in separate files
// under the 'parsers' directory and exported selectively if needed.
