/**
 * Request body size limit middleware.
 *
 * Two-layer enforcement:
 * 1. Content-Length header check — fast rejection of obviously oversized payloads
 * 2. Hono stream-level body limit — enforces the limit during actual body
 *    consumption, catching requests with absent/incorrect Content-Length
 */

import type { MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import type { Bindings } from "../interfaces";

const MAX_BODY_SIZE = 1_048_576; // 1MB

// Stream-level enforcement: wraps the request body to enforce size during read
const streamLimit = honoBodyLimit({
  maxSize: MAX_BODY_SIZE,
  onError: (c) =>
    c.json({ error: "Request body too large. Maximum size is 1MB." }, 413),
});

// Combined middleware: header check first, then stream-level enforcement
export const bodyLimit: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  // Layer 1: Content-Length fast path
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return c.json(
      { error: "Request body too large. Maximum size is 1MB." },
      413
    );
  }
  // Layer 2: Stream-level enforcement
  return streamLimit(c, next);
};
