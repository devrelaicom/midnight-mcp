/**
 * Request body size limit middleware.
 * Rejects requests with Content-Length > 1MB before parsing.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../interfaces";

const MAX_BODY_SIZE = 1_048_576; // 1MB

export const bodyLimit: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return c.json(
      { error: "Request body too large. Maximum size is 1MB." },
      413
    );
  }
  await next();
};
