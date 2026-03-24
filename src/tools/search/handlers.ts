/**
 * Search handler functions
 * Business logic for search-related MCP tools
 */

import { vectorStore, SearchFilter, SearchResult } from "../../db/index.js";
import { CURRENT_VERSION } from "../../utils/version.js";
import { embeddingGenerator } from "../../pipeline/embeddings.js";
import {
  logger,
  MCPError,
  ErrorCodes,
  validateQuery,
  validateNumber,
  searchCache,
  createCacheKey,
  isHostedMode,
  searchCompactHosted,
  searchTypeScriptHosted,
  searchDocsHosted,
  extractContentFromHtml,
} from "../../utils/index.js";
import type { SearchCompactInput, SearchTypeScriptInput, SearchDocsInput } from "./schemas.js";

// ============================================================================
// Common Search Infrastructure
// ============================================================================

interface SearchContext {
  sanitizedQuery: string;
  limit: number;
  warnings: string[];
}

type SearchValidationResult =
  | {
      success: true;
      context: SearchContext;
    }
  | {
      success: false;
      error: {
        error: string;
        details: string[];
        suggestion: string;
      };
    };

/**
 * Validate and prepare common search parameters
 * Extracts common validation logic used by all search functions
 */
function validateSearchInput(query: string, limit: number | undefined): SearchValidationResult {
  const queryValidation = validateQuery(query);
  if (!queryValidation.isValid) {
    return {
      success: false,
      error: {
        error: "Invalid query",
        details: queryValidation.errors,
        suggestion: "Provide a valid search query with at least 2 characters",
      },
    };
  }

  const limitValidation = validateNumber(limit, {
    min: 1,
    max: 50,
    defaultValue: 10,
  });

  return {
    success: true,
    context: {
      sanitizedQuery: queryValidation.sanitized,
      limit: limitValidation.value,
      warnings: queryValidation.warnings,
    },
  };
}

/**
 * Check cache for existing search results
 * Returns the cached result if found and valid
 */
function checkSearchCache(cacheKey: string) {
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug("Search cache hit", { cacheKey });
    return cached;
  }
  return null;
}

/**
 * Execute hosted search with fallback handling
 */
async function tryHostedSearch<T extends { results: unknown[]; totalResults?: number }>(
  searchType: string,
  hostedSearchFn: () => Promise<T>,
  cacheKey: string,
  warnings: string[],
): Promise<{ result: T; cached: boolean } | null> {
  if (!isHostedMode()) {
    return null;
  }

  try {
    const response = await hostedSearchFn();
    const finalResponse = {
      ...response,
      ...(warnings.length > 0 && { warnings }),
    } as T;
    // Cache with proper mapping that preserves all metadata
    searchCache.set(cacheKey, {
      results: finalResponse.results.map((item) => {
        // Type assertion for hosted search result structure
        const result = item as {
          code?: string;
          content?: string;
          relevanceScore: number;
          source: {
            repository: string;
            filePath: string;
            lines?: string;
            section?: string;
          };
          codeType?: string;
          name?: string;
          isExported?: boolean;
        };

        // Parse lines string (e.g., "10-20") into numeric startLine/endLine
        let startLine: number | undefined;
        let endLine: number | undefined;
        if (result.source.lines) {
          const lineParts = result.source.lines.split("-");
          if (lineParts.length === 2) {
            const parsedStart = parseInt(lineParts[0] ?? "", 10);
            const parsedEnd = parseInt(lineParts[1] ?? "", 10);
            if (!Number.isNaN(parsedStart)) {
              startLine = parsedStart;
            }
            if (!Number.isNaN(parsedEnd)) {
              endLine = parsedEnd;
            }
          } else if (lineParts.length === 1) {
            const parsed = parseInt(lineParts[0] ?? "", 10);
            if (!Number.isNaN(parsed)) {
              startLine = endLine = parsed;
            }
          }
        }
        return {
          code: result.code,
          content: result.content,
          relevanceScore: result.relevanceScore,
          source: {
            repository: result.source.repository,
            filePath: result.source.filePath,
            startLine,
            endLine,
            lines: result.source.lines,
            section: result.source.section,
          },
          codeType: result.codeType,
          name: result.name,
          isExported: result.isExported,
        };
      }),
      totalResults: finalResponse.totalResults ?? finalResponse.results.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
    return {
      result: finalResponse,
      cached: true,
    };
  } catch (error: unknown) {
    logger.warn(`Hosted API ${searchType} search failed, falling back to local`, {
      error: String(error),
    });
    return null;
  }
}

/**
 * Add warnings to response and cache it
 */
function finalizeResponse<T extends { results: unknown[]; totalResults?: number }>(
  response: T,
  cacheKey: string,
  warnings: string[],
): T {
  const finalResponse = {
    ...response,
    ...(warnings.length > 0 && { warnings }),
  };
  // Cache with correct structure
  searchCache.set(cacheKey, {
    results: finalResponse.results as Array<{
      code?: string;
      content?: string;
      relevanceScore: number;
      source: { repository: string; filePath: string };
    }>,
    totalResults: finalResponse.totalResults ?? finalResponse.results.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
  return finalResponse;
}

// ============================================================================
// Generic Search Pipeline
// ============================================================================

/**
 * Configuration for the generic search pipeline.
 * Each search type provides its own config to performSearch().
 */
interface SearchConfig {
  searchType: string;
  cacheKeyExtra: (string | number | boolean | undefined)[];
  hostedSearchFn: (
    query: string,
    limit: number,
  ) => Promise<{ results: unknown[]; totalResults?: number }>;
  buildFilter: () => SearchFilter;
  transformResult: (r: SearchResult) => Record<string, unknown>;
  postFilter?: (results: SearchResult[]) => SearchResult[];
  extraFields?: Record<string, unknown>;
  hostedResultExtra?: Record<string, unknown>;
}

/**
 * Unified search pipeline: validate → cache → hosted → local → finalize.
 * Eliminates duplication across searchCompact, searchTypeScript, and searchDocs.
 */
async function performSearch(query: string, limit: number | undefined, config: SearchConfig) {
  // 1. Validate — throw on invalid input so the server returns isError: true
  const validation = validateSearchInput(query, limit);
  if (!validation.success) {
    throw new MCPError(
      validation.error.error,
      ErrorCodes.INVALID_INPUT,
      validation.error.suggestion,
      { details: validation.error.details },
    );
  }
  const { sanitizedQuery, limit: validatedLimit, warnings } = validation.context;

  // 2. Log
  logger.debug(`Searching ${config.searchType}`, {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // 3. Cache check
  const cacheKey = createCacheKey(
    config.searchType,
    sanitizedQuery,
    validatedLimit,
    ...config.cacheKeyExtra,
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // 4. Try hosted API first
  const hostedResult = await tryHostedSearch(
    config.searchType,
    () => config.hostedSearchFn(sanitizedQuery, validatedLimit),
    cacheKey,
    warnings,
  );
  if (hostedResult) {
    return { ...hostedResult.result, ...config.hostedResultExtra };
  }

  // 5. Local search (fallback or when in local mode)
  if (embeddingGenerator.isDummyMode) {
    warnings.push(
      "No OpenAI API key configured — using random dummy embeddings. " +
        "Search results will not be semantically relevant. " +
        "Set OPENAI_API_KEY for accurate search.",
    );
  }
  const filter = config.buildFilter();
  let results = await vectorStore.search(sanitizedQuery, validatedLimit, filter);

  // 6. Optional post-filtering
  if (config.postFilter) {
    results = config.postFilter(results);
  }

  // 7. Transform and finalize
  const response = {
    results: results.map(config.transformResult),
    totalResults: results.length,
    query: sanitizedQuery,
    ...config.extraFields,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Search Compact smart contract code and patterns
 */
export async function searchCompact(input: SearchCompactInput) {
  return performSearch(input.query, input.limit, {
    searchType: "compact",
    cacheKeyExtra: [input.filter?.repository],
    hostedSearchFn: (query, limit) => searchCompactHosted(query, limit),
    buildFilter: () => ({ language: "compact", ...input.filter }),
    transformResult: (r) => ({
      code: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        lines: `${r.metadata.startLine}-${r.metadata.endLine}`,
      },
      codeType: r.metadata.codeType,
      name: r.metadata.codeName,
    }),
  });
}

/**
 * Search TypeScript SDK code, types, and API implementations
 */
export async function searchTypeScript(input: SearchTypeScriptInput) {
  return performSearch(input.query, input.limit, {
    searchType: "typescript",
    cacheKeyExtra: [input.includeTypes],
    hostedSearchFn: (query, limit) => searchTypeScriptHosted(query, limit, input.includeTypes),
    buildFilter: () => ({ language: "typescript" }),
    postFilter: (results) =>
      input.includeTypes
        ? results
        : results.filter(
            (r) => r.metadata.codeType !== "type" && r.metadata.codeType !== "interface",
          ),
    transformResult: (r) => ({
      code: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        lines: `${r.metadata.startLine}-${r.metadata.endLine}`,
      },
      codeType: r.metadata.codeType,
      name: r.metadata.codeName,
      isExported: r.metadata.isPublic,
    }),
  });
}

/**
 * Full-text search across official Midnight documentation
 */
export async function searchDocs(input: SearchDocsInput) {
  const freshnessHint =
    "For guaranteed freshness, use midnight-fetch-docs with the path from these results (e.g., /develop/faq)";

  return performSearch(input.query, input.limit, {
    searchType: "docs",
    cacheKeyExtra: [input.category],
    hostedSearchFn: (query, limit) => searchDocsHosted(query, limit, input.category),
    buildFilter: () => {
      const filter: SearchFilter = { language: "markdown" };
      if (input.category !== "all") {
        filter.repository = "midnightntwrk/midnight-docs";
      }
      return filter;
    },
    transformResult: (r) => ({
      content: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        section: r.metadata.codeName,
      },
    }),
    extraFields: {
      category: input.category,
      hint: freshnessHint,
    },
    hostedResultExtra: { hint: freshnessHint },
  });
}

// ============================================================================
// Live Documentation Fetching (SSG-enabled)
// ============================================================================

const DOCS_BASE_URL = "https://docs.midnight.network";
const FETCH_TIMEOUT = 15000; // 15 seconds

/**
 * Known documentation paths for validation and suggestions
 */
const KNOWN_DOC_PATHS = [
  "/develop/faq",
  "/develop/getting-help",
  "/develop/tutorial/building",
  "/develop/how-midnight-works",
  "/getting-started/installation",
  "/getting-started/create-mn-app",
  "/getting-started/deploy-mn-app",
  "/getting-started/interact-with-mn-app",
  "/compact",
  "/learn/what-is-midnight",
  "/learn/glossary",
  "/develop/reference/midnight-api",
  "/relnotes/overview",
  "/blog",
] as const;

/**
 * Fetch live documentation from docs.midnight.network
 * Takes advantage of SSG (Static Site Generation) to get pre-rendered content
 */
export async function fetchDocs(input: { path: string; extractSection?: string }) {
  const { path, extractSection } = input;

  // Normalize path
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  normalizedPath = normalizedPath.replace(/\/$/, ""); // Remove trailing slash

  // Validate path doesn't contain suspicious characters or patterns
  if (/[<>"\s]|\.\.\/|^https?:|^\/\//.test(normalizedPath)) {
    throw new MCPError(
      "Invalid path: contains invalid characters or patterns",
      ErrorCodes.INVALID_INPUT,
      "Use a clean path like '/develop/faq' or '/getting-started/installation'",
    );
  }

  // Safely construct URL using URL constructor to prevent injection/traversal
  let url: string;
  try {
    const constructed = new URL(normalizedPath, DOCS_BASE_URL);
    // Ensure we haven't escaped the docs domain
    if (constructed.origin !== new URL(DOCS_BASE_URL).origin) {
      throw new MCPError(
        "Invalid path: resulted in a URL outside the documentation domain",
        ErrorCodes.INVALID_INPUT,
        "Use a clean path like '/develop/faq' or '/getting-started/installation'",
      );
    }
    url = constructed.href;
  } catch (e) {
    if (e instanceof MCPError) throw e;
    throw new MCPError(
      "Invalid path: could not construct a valid URL",
      ErrorCodes.INVALID_INPUT,
      "Use a clean path like '/develop/faq' or '/getting-started/installation'",
    );
  }

  logger.debug("Fetching live documentation", { url, extractSection });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": `midnight-mcp/${CURRENT_VERSION} (Documentation Fetcher)`,
        Accept: "text/html",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new MCPError(
          `Page not found: ${normalizedPath}`,
          ErrorCodes.NOT_FOUND,
          `Try one of these known paths: ${KNOWN_DOC_PATHS.slice(0, 5).join(", ")}`,
        );
      }
      throw new MCPError(
        `Failed to fetch documentation: ${response.status} ${response.statusText}`,
        ErrorCodes.NETWORK,
        "Try again later or check if the URL is correct",
      );
    }

    const html = await response.text();

    // Check if we got actual content (SSG should return full HTML)
    if (!html.includes("<article") && !html.includes("<main")) {
      throw new MCPError(
        `Page returned but content not found: ${normalizedPath}`,
        ErrorCodes.NOT_FOUND,
        "The page may not have main content. Try a different path.",
      );
    }

    const { title, content, headings, lastUpdated } = extractContentFromHtml(html, extractSection);

    // Truncate if content is too long (for token efficiency)
    const MAX_CONTENT_LENGTH = 15000;
    const truncated = content.length > MAX_CONTENT_LENGTH;
    const finalContent = truncated
      ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]"
      : content;

    return {
      title,
      path: normalizedPath,
      url,
      content: finalContent,
      headings: headings.length > 0 ? headings : undefined,
      lastUpdated,
      truncated,
      contentLength: content.length,
      note: extractSection
        ? `Extracted section matching: "${extractSection}"`
        : "Full page content",
    };
  } catch (error: unknown) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new MCPError(
          "Request timed out",
          ErrorCodes.NETWORK,
          "The documentation site may be slow. Try again or use midnight-search-docs for cached content.",
        );
      }
      throw new MCPError(
        `Failed to fetch: ${error.message}`,
        ErrorCodes.NETWORK,
        "Check your network connection or try midnight-search-docs for cached content.",
      );
    }
    throw new MCPError("Unknown error fetching documentation", ErrorCodes.INTERNAL_ERROR);
  }
}
