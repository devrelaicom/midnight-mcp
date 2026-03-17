/**
 * Search API routes.
 * Deduplicated into a shared handler with per-endpoint filters.
 */

import { Hono, type Context } from "hono";
import type { Bindings, SearchRequestBody, AuthState } from "../interfaces";
import { getEmbedding, trackQuery } from "../services";
import {
  validateQuery,
  validateLimit,
  formatResults,
  applyKeywordBoost,
} from "../utils";

const searchRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Shared search handler.
 * Encapsulates: metrics, validation, cached embedding, Vectorize query,
 * keyword boost, tracking, and response formatting.
 */
async function handleSearch(
  c: Context<{ Bindings: Bindings }>,
  filter: Record<string, string> | undefined,
  endpoint: string
): Promise<Response> {
  try {
    const body = await c.req.json<SearchRequestBody>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(
      query,
      c.env.OPENAI_API_KEY,
      c.env.DB
    );

    const resolvedFilter =
      filter ??
      (body.filter?.language ? { language: body.filter.language } : undefined);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: resolvedFilter,
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    c.executionCtx.waitUntil(
      trackQuery(c.env.DB, query, endpoint, boostedMatches, filter?.language),
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
searchRoutes.post("/compact", (c) =>
  handleSearch(c, { language: "compact" }, "compact")
);
searchRoutes.post("/typescript", (c) =>
  handleSearch(c, { language: "typescript" }, "typescript")
);
searchRoutes.post("/docs", (c) =>
  handleSearch(c, { language: "markdown" }, "docs")
);

export default searchRoutes;
