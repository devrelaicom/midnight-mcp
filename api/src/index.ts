/**
 * Midnight MCP API
 *
 * A Cloudflare Worker API for semantic search across Midnight repositories.
 * Provides search endpoints with GitHub OAuth, tiered rate limiting, and embedding caching.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import type { Bindings } from "./interfaces";
import {
  healthRoutes,
  searchRoutes,
  statsRoutes,
  dashboardRoute,
  trackRoutes,
  oauthRoutes,
  pgRoutes,
} from "./routes";
import { bodyLimit, auth, rateLimit } from "./middleware";

const app = new Hono<{ Bindings: Bindings }>();

// CORS — scoped per route group with configurable origins.
//
// Origin is set via CORS_ORIGINS env var (comma-separated) or defaults to "*".
// The public MCP API requires wildcard by default since any MCP client can call it.
// Operators can restrict origins in their deployment via wrangler.toml [vars]:
//   CORS_ORIGINS = "https://my-app.example.com,https://staging.example.com"
//
// Route groups:
//   /v1/*          — public search/stats/track API (MCP clients, browser tools)
//   /pg/*          — playground proxy (includes DELETE for simulation cleanup)
//   /health        — health check (infra probes, browser status widgets)
//   /.well-known/* — OAuth discovery (MCP client bootstrapping)
//   /oauth/*       — OAuth register/token (MCP client auth flow)
//   /dashboard     — excluded (browser same-origin only, uses cookie auth)
app.use("*", async (c, next) => {
  // Skip CORS for dashboard (same-origin only)
  if (c.req.path.startsWith("/dashboard")) {
    return next();
  }

  const rawOrigins = c.env.CORS_ORIGINS || "*";
  const origin = rawOrigins === "*" ? "*" : rawOrigins.split(",").map((o) => o.trim());
  const allowDelete = c.req.path.startsWith("/pg/");

  return cors({
    origin,
    allowMethods: allowDelete ? ["GET", "POST", "DELETE", "OPTIONS"] : ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })(c, next);
});

// Middleware chain (order matters):
// 1. Body limit — reject oversized payloads before any KV/auth work
// 2. Auth — extract user identity from Bearer token or session cookie
app.use("*", bodyLimit);
app.use("*", auth);

// Rate limiting — applied to all public API surfaces
app.use("/v1/search/*", rateLimit);
app.use("/v1/track/*", rateLimit);
app.use("/v1/stats/*", rateLimit);
app.use("/pg/*", rateLimit);
app.use("/oauth/*", rateLimit);
app.use("/.well-known/*", rateLimit);

// Mount routes
app.route("/", healthRoutes);
app.route("/", oauthRoutes); // Mounts /.well-known/* and /oauth/*
app.route("/v1/search", searchRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/track", trackRoutes);
app.route("/dashboard", dashboardRoute);
app.route("/pg", pgRoutes);

// Global error handler — catches unhandled exceptions from any route
app.onError((err, c) => {
  // Preserve intentional HTTP errors (e.g. from Hono middleware)
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("Unhandled worker error", {
    path: c.req.path,
    method: c.req.method,
    error: String(err),
  });
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
