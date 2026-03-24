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

// CORS — scoped per route group, not applied globally.
// /dashboard is browser same-origin only and needs no CORS headers.
const apiCors = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
const pgCors = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
app.use("/v1/*", apiCors);
app.use("/pg/*", pgCors);
app.use("/health", apiCors);
app.use("/.well-known/*", apiCors);
app.use("/oauth/*", apiCors);

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
  console.error("Unhandled worker error", { path: c.req.path, method: c.req.method, error: String(err) });
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
