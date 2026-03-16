/**
 * Search module exports
 * Barrel file for search-related tools
 */

// Schemas and types
export {
  SearchCompactInputSchema,
  SearchTypeScriptInputSchema,
  SearchDocsInputSchema,
  FetchDocsInputSchema,
  type SearchCompactInput,
  type SearchTypeScriptInput,
  type SearchDocsInput,
  type FetchDocsInput,
} from "./schemas.js";

// Handlers
export { searchCompact, searchTypeScript, searchDocs, fetchDocs } from "./handlers.js";

// Tools
export { searchTools } from "./tools.js";
