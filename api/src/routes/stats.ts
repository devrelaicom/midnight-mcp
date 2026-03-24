/**
 * Stats API routes
 *
 * Public aggregate statistics only — no raw query data is exposed.
 * Raw queries are available only through the auth-protected dashboard.
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";
import { getAggregateMetrics } from "../services";

const statsRoutes = new Hono<{ Bindings: Bindings }>();

// Stats endpoint (JSON API) — aggregate metrics only
statsRoutes.get("/", async (c) => {
  const metrics = await getAggregateMetrics(c.env.DB);

  return c.json({
    service: "midnight-mcp-api",
    environment: c.env.ENVIRONMENT,
    vectorize: "connected",
    metrics: {
      totalQueries: metrics.totalQueries,
      avgRelevanceScore: Math.round(metrics.avgRelevanceScore * 1000) / 1000,
      queriesByEndpoint: metrics.queriesByEndpoint,
      queriesByLanguage: metrics.queriesByLanguage,
      scoreDistribution: metrics.scoreDistribution,
      documentHitsByRepo: metrics.documentsByRepo,
      lastUpdated: metrics.lastUpdated,
    },
  });
});

export default statsRoutes;
