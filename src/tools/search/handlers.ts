/**
 * Search handler functions
 * Business logic for search-related MCP tools
 */

import { vectorStore, SearchFilter } from "../../db/index.js";
import {
  logger,
  validateQuery,
  validateNumber,
  searchCache,
  createCacheKey,
  isHostedMode,
  searchCompactHosted,
  searchTypeScriptHosted,
  searchDocsHosted,
} from "../../utils/index.js";
import type {
  SearchCompactInput,
  SearchTypeScriptInput,
  SearchDocsInput,
} from "./schemas.js";

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
function validateSearchInput(
  query: string,
  limit: number | undefined
): SearchValidationResult {
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
async function tryHostedSearch<
  T extends { results: unknown[]; totalResults?: number },
>(
  searchType: string,
  hostedSearchFn: () => Promise<T>,
  cacheKey: string,
  warnings: string[]
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
            const parsedStart = parseInt(lineParts[0], 10);
            const parsedEnd = parseInt(lineParts[1], 10);
            if (!Number.isNaN(parsedStart)) {
              startLine = parsedStart;
            }
            if (!Number.isNaN(parsedEnd)) {
              endLine = parsedEnd;
            }
          } else if (lineParts.length === 1) {
            const parsed = parseInt(lineParts[0], 10);
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
  } catch (error) {
    logger.warn(
      `Hosted API ${searchType} search failed, falling back to local`,
      {
        error: String(error),
      }
    );
    return null;
  }
}

/**
 * Add warnings to response and cache it
 */
function finalizeResponse<
  T extends { results: unknown[]; totalResults?: number },
>(response: T, cacheKey: string, warnings: string[]): T {
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
// Handler Functions
// ============================================================================

/**
 * Search Compact smart contract code and patterns
 */
export async function searchCompact(input: SearchCompactInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching Compact code", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache first
  const cacheKey = createCacheKey(
    "compact",
    sanitizedQuery,
    limit,
    input.filter?.repository
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "compact",
    () => searchCompactHosted(sanitizedQuery, limit),
    cacheKey,
    warnings
  );
  if (hostedResult) return hostedResult.result;

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "compact",
    ...input.filter,
  };

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  const response = {
    results: results.map((r) => ({
      code: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        lines: `${r.metadata.startLine}-${r.metadata.endLine}`,
      },
      codeType: r.metadata.codeType,
      name: r.metadata.codeName,
    })),
    totalResults: results.length,
    query: sanitizedQuery,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

/**
 * Search TypeScript SDK code, types, and API implementations
 */
export async function searchTypeScript(input: SearchTypeScriptInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching TypeScript code", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache (includeExamples not used in filtering, excluded from key)
  const cacheKey = createCacheKey(
    "typescript",
    sanitizedQuery,
    limit,
    input.includeTypes
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "typescript",
    () => searchTypeScriptHosted(sanitizedQuery, limit, input.includeTypes),
    cacheKey,
    warnings
  );
  if (hostedResult) return hostedResult.result;

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "typescript",
  };

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  // Filter based on type preferences
  let filteredResults = results;
  if (!input.includeTypes) {
    filteredResults = results.filter(
      (r) =>
        r.metadata.codeType !== "type" && r.metadata.codeType !== "interface"
    );
  }

  const response = {
    results: filteredResults.map((r) => ({
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
    })),
    totalResults: filteredResults.length,
    query: sanitizedQuery,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

/**
 * Full-text search across official Midnight documentation
 */
export async function searchDocs(input: SearchDocsInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching documentation", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache
  const cacheKey = createCacheKey(
    "docs",
    sanitizedQuery,
    limit,
    input.category
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  const freshnessHint =
    "For guaranteed freshness, use midnight-fetch-docs with the path from these results (e.g., /develop/faq)";

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "docs",
    () => searchDocsHosted(sanitizedQuery, limit, input.category),
    cacheKey,
    warnings
  );
  if (hostedResult) {
    return { ...hostedResult.result, hint: freshnessHint };
  }

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "markdown",
  };

  // If category is specified, add repository filter
  if (input.category !== "all") {
    // Docs are typically in the midnight-docs repo
    filter.repository = "midnightntwrk/midnight-docs";
  }

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  const response = {
    results: results.map((r) => ({
      content: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        section: r.metadata.codeName,
      },
    })),
    totalResults: results.length,
    query: sanitizedQuery,
    category: input.category,
    hint: "For guaranteed freshness, use midnight-fetch-docs with the path from these results (e.g., /develop/faq)",
  };

  return finalizeResponse(response, cacheKey, warnings);
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
 * Extract readable content from Docusaurus SSG HTML
 * Strips navigation, scripts, styles and extracts main content
 */
function extractContentFromHtml(
  html: string,
  extractSection?: string
): {
  title: string;
  content: string;
  headings: Array<{ level: number; text: string; id: string }>;
  lastUpdated?: string;
} {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(" | Midnight Docs", "").trim()
    : "Unknown";

  // Extract last updated date
  const lastUpdatedMatch = html.match(
    /<time[^>]*datetime="([^"]+)"[^>]*itemprop="dateModified"/i
  );
  const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : undefined;

  // Extract main article content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const articleHtml = articleMatch ? articleMatch[1] : html;

  // Extract headings with their IDs
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const headingRegex =
    /<h([1-6])[^>]*class="[^"]*anchor[^"]*"[^>]*id="([^"]*)"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]+>)*[^<]*)/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(articleHtml)) !== null) {
    const text = headingMatch[3]
      .replace(/<[^>]+>/g, "")
      .replace(/\u200B/g, "")
      .replace(/​/g, "")
      .trim();
    if (text) {
      headings.push({
        level: parseInt(headingMatch[1]),
        text,
        id: headingMatch[2],
      });
    }
  }

  // Remove unwanted elements
  let content = articleHtml
    // Remove script tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove style tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Remove SVG icons
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    // Remove navigation breadcrumbs
    .replace(/<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>[\s\S]*?<\/nav>/gi, "")
    // Remove edit/footer sections
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    // Remove hash links (anchor links)
    .replace(/<a[^>]*class="[^"]*hash-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
    // Remove button elements
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "");

  // Convert HTML to readable text
  content = content
    // Convert headers
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<\/h1>/gi, "\n")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<\/h2>/gi, "\n")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<\/h3>/gi, "\n")
    .replace(/<h4[^>]*>/gi, "\n#### ")
    .replace(/<\/h4>/gi, "\n")
    // Convert paragraphs
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    // Convert lists
    .replace(/<ul[^>]*>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "\n")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    // Convert code blocks
    .replace(/<pre[^>]*><code[^>]*>/gi, "\n```\n")
    .replace(/<\/code><\/pre>/gi, "\n```\n")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    // Convert links - keep text, add URL
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    // Convert emphasis
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<em[^>]*>/gi, "_")
    .replace(/<\/em>/gi, "_")
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // If extractSection is specified, try to extract just that section
  if (extractSection) {
    const sectionLower = extractSection.toLowerCase();
    const lines = content.split("\n");
    const result: string[] = [];
    let inSection = false;
    let sectionLevel = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const headerText = headerMatch[2].toLowerCase();

        if (headerText.includes(sectionLower)) {
          inSection = true;
          sectionLevel = level;
          result.push(line);
        } else if (inSection && level <= sectionLevel) {
          // Reached another section at same or higher level
          break;
        } else if (inSection) {
          result.push(line);
        }
      } else if (inSection) {
        result.push(line);
      }
    }

    if (result.length > 0) {
      content = result.join("\n").trim();
    }
  }

  return { title, content, headings, lastUpdated };
}

/**
 * Fetch live documentation from docs.midnight.network
 * Takes advantage of SSG (Static Site Generation) to get pre-rendered content
 */
export async function fetchDocs(input: {
  path: string;
  extractSection?: string;
}) {
  const { path, extractSection } = input;

  // Normalize path
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  normalizedPath = normalizedPath.replace(/\/$/, ""); // Remove trailing slash

  // Validate path doesn't contain suspicious characters or patterns
  if (/[<>"\s]|\.\.\/|^https?:|^\/\//.test(normalizedPath)) {
    return {
      error: "Invalid path",
      details: ["Path contains invalid characters or patterns"],
      suggestion: `Use a clean path like '/develop/faq' or '/getting-started/installation'`,
    };
  }

  const url = `${DOCS_BASE_URL}${normalizedPath}`;

  logger.debug("Fetching live documentation", { url, extractSection });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "midnight-mcp/1.0 (Documentation Fetcher)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          error: "Page not found",
          path: normalizedPath,
          suggestion: `Try one of these known paths: ${KNOWN_DOC_PATHS.slice(0, 5).join(", ")}`,
          knownPaths: KNOWN_DOC_PATHS,
        };
      }
      return {
        error: `Failed to fetch documentation: ${response.status} ${response.statusText}`,
        path: normalizedPath,
        suggestion: "Try again later or check if the URL is correct",
      };
    }

    const html = await response.text();

    // Check if we got actual content (SSG should return full HTML)
    if (!html.includes("<article") && !html.includes("<main")) {
      return {
        error: "Page returned but content not found",
        path: normalizedPath,
        suggestion: "The page may not have main content. Try a different path.",
      };
    }

    const { title, content, headings, lastUpdated } = extractContentFromHtml(
      html,
      extractSection
    );

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
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          error: "Request timed out",
          path: normalizedPath,
          suggestion:
            "The documentation site may be slow. Try again or use midnight-search-docs for cached content.",
        };
      }
      return {
        error: `Failed to fetch: ${error.message}`,
        path: normalizedPath,
        suggestion:
          "Check your network connection or try midnight-search-docs for cached content.",
      };
    }
    return {
      error: "Unknown error fetching documentation",
      path: normalizedPath,
    };
  }
}
