/**
 * Search API routes.
 * Deduplicated into a shared handler with per-endpoint filters.
 */

import { Hono, type Context } from "hono";
import type { Bindings, SearchRequestBody, AuthState } from "../interfaces";
import { getEmbedding, trackQuery } from "../services";
import { validateQuery, validateLimit, formatResults, applyKeywordBoost } from "../utils";

const searchRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Shared search handler.
 * Encapsulates: metrics, validation, cached embedding, Vectorize query,
 * keyword boost, tracking, and response formatting.
 *
 * Endpoint filters (e.g. language:"compact") are merged with request-body
 * filters (e.g. filter.repository) so the MCP tool contract is honored.
 */
async function handleSearch(
  c: Context<{ Bindings: Bindings }>,
  endpointFilter: Record<string, string> | undefined,
  endpoint: string,
): Promise<Response> {
  try {
    const body = await c.req.json<SearchRequestBody>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(query, c.env.OPENAI_API_KEY, c.env.DB);

    // Merge endpoint-level filter with request-body filter.
    // Endpoint language takes precedence; body language only applies to the generic endpoint.
    const resolvedFilter: Record<string, string> = {
      ...(endpointFilter ?? {}),
      ...(!endpointFilter?.language && body.filter?.language
        ? { language: body.filter.language }
        : {}),
      ...(body.filter?.repository ? { repository: body.filter.repository } : {}),
    };

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: Object.keys(resolvedFilter).length > 0 ? resolvedFilter : undefined,
    });

    let boostedMatches = applyKeywordBoost(results.matches, query);

    // TypeScript: filter out type/interface results when includeTypes is false
    if (body.includeTypes === false) {
      boostedMatches = boostedMatches.filter((m) => {
        const codeType = (m.metadata as Record<string, unknown>)?.codeType as string | undefined;
        return codeType !== "type" && codeType !== "interface";
      });
    }

    // Docs: filter by category using file path conventions
    if (body.category && body.category !== "all") {
      boostedMatches = boostedMatches.filter((m) => {
        const filePath = (m.metadata as Record<string, unknown>)?.filePath as string | undefined;
        if (!filePath) return true;
        const categoryPrefixes: Record<string, string[]> = {
          guides: ["/develop/", "/getting-started/", "/build/"],
          api: ["/api/", "/reference/"],
          concepts: ["/learn/", "/concepts/", "/compact/"],
        };
        const prefixes = categoryPrefixes[body.category!];
        return prefixes ? prefixes.some((p) => filePath.includes(p)) : true;
      });
    }

    c.executionCtx.waitUntil(
      trackQuery(c.env.DB, query, endpoint, boostedMatches, resolvedFilter.language),
    );

    const response = formatResults(boostedMatches, query);

    // Add warning if token was invalid (downgraded to anon rate limit)
    const authState = c.get("authState") as AuthState;
    if (authState.tokenInvalid) {
      return c.json({
        ...response,
        warnings: [
          "Your access token is invalid or expired. You are being rate limited as an anonymous user (10 req/min). Re-authenticate via /mcp to restore your full rate limit.",
        ],
      });
    }

    return c.json(response);
  } catch (error) {
    console.error(`Search ${endpoint} error:`, error);
    return c.json({ error: "Search failed" }, 500);
  }
}

searchRoutes.post("/", (c) => handleSearch(c, undefined, "search"));
searchRoutes.post("/compact", (c) => handleSearch(c, { language: "compact" }, "compact"));
searchRoutes.post("/typescript", (c) => handleSearch(c, { language: "typescript" }, "typescript"));
searchRoutes.post("/docs", (c) => handleSearch(c, { language: "markdown" }, "docs"));

export default searchRoutes;
