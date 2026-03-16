/**
 * Search tool definitions
 * MCP tool registration for search operations
 */

import type {
  ExtendedToolDefinition,
  OutputSchema,
  ToolAnnotations,
  ToolCategory,
} from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import {
  SearchCompactInputSchema,
  SearchTypeScriptInputSchema,
  SearchDocsInputSchema,
  FetchDocsInputSchema,
} from "./schemas.js";
import { searchCompact, searchTypeScript, searchDocs, fetchDocs } from "./handlers.js";

// ============================================================================
// Output Schema for Search Results
// ============================================================================

const searchResultSchema: OutputSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "Array of search results",
      items: {
        type: "object",
        properties: {
          code: { type: "string", description: "The matched code content" },
          relevanceScore: {
            type: "number",
            description: "Relevance score from 0 to 1",
          },
          source: {
            type: "object",
            description: "Source location information",
            properties: {
              repository: { type: "string", description: "Repository name" },
              filePath: { type: "string", description: "File path" },
              lines: {
                type: "string",
                description: "Line range (e.g., 10-50)",
              },
            },
          },
          codeType: {
            type: "string",
            description: "Type of code (compact, typescript, markdown)",
          },
          name: { type: "string", description: "Name of the code element" },
        },
      },
    },
    totalResults: {
      type: "number",
      description: "Total number of results returned",
    },
    query: { type: "string", description: "The search query used" },
    warnings: {
      type: "array",
      description: "Any warnings about the search",
      items: { type: "string" },
    },
  },
  required: ["results", "totalResults", "query"],
  description: "Search results with relevance scores and source information",
};

// Common annotations for search tools
const searchToolAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
  category: "search",
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const searchTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-search-compact",
    description: `Semantic search across Compact smart contract code and patterns. Use this to find circuit definitions, witness functions, ledger declarations, and best practices for Midnight smart contracts.

USAGE GUIDANCE:
• Call at most 2 times per question - if first search doesn't help, try different keywords
• For comprehensive results, combine with midnight-search-docs
• Use specific terms like "ledger", "circuit", "witness" for better matches`,
    inputSchema: zodInputSchema(SearchCompactInputSchema),
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search Compact Contracts",
    },
    handler: searchCompact,
  },
  {
    name: "midnight-search-typescript",
    description: `Search TypeScript SDK code, types, and API implementations. Use this to find how to use the Midnight JavaScript SDK, type definitions, and integration patterns.

USAGE GUIDANCE:
• Call at most 2 times per question - refine keywords rather than repeating
• For contract code, use midnight-search-compact instead
• Include "type" or "interface" in query for type definitions`,
    inputSchema: zodInputSchema(SearchTypeScriptInputSchema),
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search TypeScript SDK",
    },
    handler: searchTypeScript,
  },
  {
    name: "midnight-search-docs",
    description: `Full-text search across official Midnight documentation. Use this to find guides, API documentation, and conceptual explanations about Midnight blockchain and the Compact language.

USAGE GUIDANCE:
• Call at most 2 times per question - use different keywords if first search fails
• For code examples, combine with midnight-search-compact or midnight-search-typescript
• Use category filter to narrow results (guides, api, concepts)`,
    inputSchema: zodInputSchema(SearchDocsInputSchema),
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search Documentation",
    },
    handler: searchDocs,
  },
  {
    name: "midnight-fetch-docs",
    description: `🌐 LIVE FETCH: Retrieve latest documentation directly from docs.midnight.network (SSG-enabled).

Unlike midnight-search-docs which uses pre-indexed content, this tool fetches LIVE documentation pages in real-time. Use when you need:
• The absolute latest content (just updated docs)
• A specific page you know the path to
• Full page content rather than search snippets

COMMON PATHS:
• /develop/faq - Frequently asked questions
• /getting-started/installation - Installation guide
• /getting-started/create-mn-app - Create an MN app
• /compact - Compact language reference
• /develop/tutorial/building - Build guide
• /develop/reference/midnight-api - API documentation
• /learn/what-is-midnight - What is Midnight
• /blog - Dev diaries

USAGE GUIDANCE:
• Use extractSection to get only a specific heading (e.g., "Developer questions")
• Prefer midnight-search-docs for discovery, use this for known pages
• Content is truncated at 15KB for token efficiency`,
    inputSchema: zodInputSchema(FetchDocsInputSchema),
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title" },
        path: { type: "string", description: "Normalized path" },
        url: { type: "string", description: "Full URL" },
        content: { type: "string", description: "Extracted page content" },
        headings: {
          type: "array",
          description: "Page headings/table of contents",
          items: {
            type: "object",
            properties: {
              level: { type: "number" },
              text: { type: "string" },
              id: { type: "string" },
            },
          },
        },
        lastUpdated: { type: "string", description: "Last update timestamp" },
        truncated: {
          type: "boolean",
          description: "Whether content was truncated",
        },
      },
      required: ["title", "path", "content"],
      description: "Live documentation page content",
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true, // Same path returns same content
      openWorldHint: true, // Fetches from external URL
      title: "🌐 Fetch Live Docs",
      category: "search" as ToolCategory,
    },
    handler: fetchDocs,
  },
];
