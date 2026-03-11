/**
 * Playground proxy routes.
 * Forward requests to compact-playground with auth, rate limiting, and metrics.
 */

import { Hono, type Context } from "hono";
import type { Bindings } from "../interfaces";

const pg = new Hono<{ Bindings: Bindings }>();

/**
 * Generic proxy handler for POST endpoints.
 */
async function proxyPost(c: Context<{ Bindings: Bindings }>, path: string) {
  const playgroundUrl = c.env.COMPACT_PLAYGROUND_URL;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }

  try {
    const response = await fetch(`${playgroundUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status >= 500) {
      return c.json(
        { error: "Compilation service unavailable", retryAfter: 30 },
        503,
      );
    }

    const data = await response.json();
    return c.json(data, response.status as 200);
  } catch {
    return c.json(
      { error: "Compilation service unavailable", retryAfter: 30 },
      503,
    );
  }
}

pg.post("/compile", (c) => proxyPost(c, "/compile"));
pg.post("/format", (c) => proxyPost(c, "/format"));
pg.post("/analyze", (c) => proxyPost(c, "/analyze"));
pg.post("/diff", (c) => proxyPost(c, "/diff"));

pg.get("/health", async (c) => {
  const playgroundUrl = c.env.COMPACT_PLAYGROUND_URL;
  try {
    const response = await fetch(`${playgroundUrl}/health`);
    const data = await response.json();
    return c.json(data);
  } catch {
    return c.json(
      { error: "Compilation service unavailable", retryAfter: 30 },
      503,
    );
  }
});

export default pg;
