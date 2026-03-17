/**
 * Playground proxy routes.
 * Forward requests to compact-playground with auth, rate limiting, and metrics.
 */

import { Hono, type Context } from "hono";
import type { Bindings } from "../interfaces";
import { trackPlaygroundCall, persistMetrics, loadMetrics } from "../services";

const pg = new Hono<{ Bindings: Bindings }>();

/**
 * Extract version info from a playground response body.
 * Reads resolved version from the response (more accurate than request).
 */
function extractVersion(data: Record<string, unknown>): string | null {
  if (typeof data.version === "string") return data.version;
  if (typeof data.compilerVersion === "string") return data.compilerVersion;

  if (Array.isArray(data.results)) {
    const versions = data.results
      .map((r: Record<string, unknown>) => r.version)
      .filter((v): v is string => typeof v === "string");
    if (versions.length > 0) return versions.join(",");
  }

  const compilation = data.compilation as Record<string, unknown> | undefined;
  if (compilation && typeof compilation.compilerVersion === "string") {
    return compilation.compilerVersion;
  }

  return null;
}

/**
 * Generic proxy handler for any method.
 */
async function proxyRequest(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  method: "GET" | "POST" | "DELETE" = "POST",
) {
  const playgroundUrl = c.env.COMPACT_PLAYGROUND_URL;
  const start = Date.now();

  const fetchOptions: RequestInit = { method };

  if (method === "POST") {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid or missing JSON body" }, 400);
    }
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${playgroundUrl}${path}`, fetchOptions);
    const durationMs = Date.now() - start;

    if (response.status >= 500) {
      await trackAndPersist(c, path, false, durationMs, null);
      return c.json(
        { error: "Compilation service unavailable", retryAfter: 30 },
        503,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const version = extractVersion(data);

    await trackAndPersist(c, path, response.ok, durationMs, version);

    return c.json(data, response.status as 200);
  } catch {
    const durationMs = Date.now() - start;
    await trackAndPersist(c, path, false, durationMs, null);
    return c.json(
      { error: "Compilation service unavailable", retryAfter: 30 },
      503,
    );
  }
}

async function trackAndPersist(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  success: boolean,
  durationMs: number,
  version: string | null,
) {
  await loadMetrics(c.env.METRICS);
  trackPlaygroundCall(`/pg${path}`, success, durationMs, version);
  await persistMetrics(c.env.METRICS);
}

// ---- Existing routes (compile, format, analyze, diff, health) ----

pg.post("/compile", (c) => proxyRequest(c, "/compile"));
pg.post("/format", (c) => proxyRequest(c, "/format"));
pg.post("/analyze", (c) => proxyRequest(c, "/analyze"));
pg.post("/diff", (c) => proxyRequest(c, "/diff"));

pg.get("/health", (c) => proxyRequest(c, "/health", "GET"));

// ---- New routes ----

pg.post("/visualize", (c) => proxyRequest(c, "/visualize"));
pg.post("/prove", (c) => proxyRequest(c, "/prove"));
pg.post("/compile/archive", (c) => proxyRequest(c, "/compile/archive"));

// Simulation
pg.post("/simulate/deploy", (c) => proxyRequest(c, "/simulate/deploy"));
pg.post("/simulate/:id/call", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}/call`);
});
pg.get("/simulate/:id/state", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}/state`, "GET");
});
pg.delete("/simulate/:id", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}`, "DELETE");
});

// Reference data
pg.get("/versions", (c) => proxyRequest(c, "/versions", "GET"));
pg.get("/libraries", (c) => proxyRequest(c, "/libraries", "GET"));

// Cache lookup
pg.get("/cached-response/:hash", (c) => {
  const hash = c.req.param("hash");
  return proxyRequest(c, `/cached-response/${hash}`, "GET");
});

export default pg;
