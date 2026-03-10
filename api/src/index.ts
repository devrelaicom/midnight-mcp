/**
 * Midnight MCP API
 *
 * A Cloudflare Worker API for semantic search across Midnight repositories.
 * Provides search endpoints with GitHub OAuth, tiered rate limiting, and embedding caching.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./interfaces";
import {
  healthRoutes,
  searchRoutes,
  statsRoutes,
  dashboardRoute,
  trackRoutes,
  oauthRoutes,
} from "./routes";
import { bodyLimit, auth, rateLimit } from "./middleware";

const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow all origins for public API, include Authorization header
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  })
);

// Middleware chain (order matters):
// 1. Body limit — reject oversized payloads before any KV/auth work
// 2. Auth — extract user identity from Bearer token or session cookie
app.use("*", bodyLimit);
app.use("*", auth);

// Rate limiting — applied only to search and track routes
app.use("/v1/search/*", rateLimit);
app.use("/v1/track/*", rateLimit);

// Mount routes
app.route("/", healthRoutes);
app.route("/", oauthRoutes); // Mounts /.well-known/* and /oauth/*
app.route("/v1/search", searchRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/track", trackRoutes);
app.route("/dashboard", dashboardRoute);

export default app;
