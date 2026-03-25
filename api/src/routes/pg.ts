/**
 * Playground proxy routes.
 * Forward requests to compact-playground with auth, rate limiting, and metrics.
 */

import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Bindings } from "../interfaces";
import { trackPlaygroundCall } from "../services";

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
  const headers: Record<string, string> = {};

  // Forward X-Client-ID for per-user rate limiting at the playground
  const clientId = c.req.header("X-Client-ID");
  if (clientId) {
    headers["X-Client-ID"] = clientId;
  }

  if (method === "POST") {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid or missing JSON body" }, 400);
    }
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  fetchOptions.headers = headers;

  try {
    const response = await fetch(`${playgroundUrl}${path}`, fetchOptions);
    const durationMs = Date.now() - start;

    if (response.status >= 500) {
      trackInBackground(c, path, false, durationMs, null);
      return c.json({ error: "Compilation service unavailable", retryAfter: 30 }, 503);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "Non-JSON response");
      console.error("Unexpected upstream response", {
        path,
        contentType,
        body: text.slice(0, 500),
      });
      trackInBackground(c, path, false, durationMs, null);
      return c.json({ error: "Unexpected upstream response" }, 502);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const version = extractVersion(data);

    trackInBackground(c, path, response.ok, durationMs, version);

    return c.json(data, response.status as ContentfulStatusCode);
  } catch {
    const durationMs = Date.now() - start;
    trackInBackground(c, path, false, durationMs, null);
    return c.json({ error: "Compilation service unavailable", retryAfter: 30 }, 503);
  }
}

function trackInBackground(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  success: boolean,
  durationMs: number,
  version: string | null,
) {
  c.executionCtx.waitUntil(
    trackPlaygroundCall(c.env.DB, `/pg${path}`, success, durationMs, version),
  );
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

// Format guard for URL path parameters to prevent path traversal
const SAFE_PARAM = /^[a-zA-Z0-9_-]+$/;

function validateParam(c: Context<{ Bindings: Bindings }>, name: string): string | Response {
  const value = c.req.param(name) ?? "";
  if (!SAFE_PARAM.test(value)) {
    return c.json({ error: `Invalid ${name}` }, 400);
  }
  return value;
}

// Simulation routes removed — simulation is now handled locally by the MCP server.
// See src/services/simulator.ts in the main package.

// Reference data
pg.get("/versions", (c) => proxyRequest(c, "/versions", "GET"));
pg.get("/libraries", (c) => proxyRequest(c, "/libraries", "GET"));

// Cache lookup
pg.get("/cached-response/:hash", (c) => {
  const hash = validateParam(c, "hash");
  if (hash instanceof Response) return hash;
  return proxyRequest(c, `/cached-response/${hash}`, "GET");
});

export default pg;
