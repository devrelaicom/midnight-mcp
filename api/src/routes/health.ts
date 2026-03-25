/**
 * Health check routes
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";
import { fetchWithTimeout } from "../utils";

const healthRoutes = new Hono<{ Bindings: Bindings }>();

// Root health check
healthRoutes.get("/", (c) => c.json({ status: "ok", service: "midnight-mcp-api" }));

// Detailed health check
healthRoutes.get("/health", (c) =>
  c.json({
    status: "healthy",
    environment: c.env.ENVIRONMENT,
    vectorize: !!c.env.VECTORIZE,
  }),
);

// Readiness check — verifies critical dependencies are responsive
healthRoutes.get("/ready", async (c) => {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  const [db, playground] = await Promise.allSettled([
    c.env.DB.prepare("SELECT 1").first(),
    fetchWithTimeout(`${c.env.COMPACT_PLAYGROUND_URL}/health`, {}, 5_000),
  ]);

  checks.d1 =
    db.status === "fulfilled"
      ? { ok: true }
      : { ok: false, error: db.reason?.message ?? "D1 unreachable" };

  checks.playground =
    playground.status === "fulfilled" && playground.value.ok
      ? { ok: true }
      : {
          ok: false,
          error:
            playground.status === "rejected"
              ? (playground.reason?.message ?? "Playground unreachable")
              : `Playground returned ${playground.value.status}`,
        };

  const ready = Object.values(checks).every((ch) => ch.ok);

  return c.json({ status: ready ? "ready" : "degraded", checks }, ready ? 200 : 503);
});

export default healthRoutes;
