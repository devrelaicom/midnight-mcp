/**
 * Authentication middleware.
 * Resolves user identity from Bearer token or session cookie.
 * Sets AuthState on context for rate limiting and route handlers.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings, AuthUser, AuthState } from "../interfaces";

declare module "hono" {
  interface ContextVariableMap {
    authState: AuthState;
  }
}

export const auth: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  let user: AuthUser | null = null;
  let tokenInvalid = false;

  // Try Bearer token first (API clients)
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userData = await c.env.METRICS.get(`token:${token}`);
    if (userData) {
      const parsed = JSON.parse(userData) as AuthUser;
      if (parsed.expiresAt > Date.now()) {
        user = parsed;
      } else {
        tokenInvalid = true;
        // Clean up expired token
        await c.env.METRICS.delete(`token:${token}`);
      }
    } else {
      tokenInvalid = true;
    }
  }

  // Try session cookie (dashboard)
  if (!user && !tokenInvalid) {
    const cookieHeader = c.req.header("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(
        /(?:^|;\s*)midnight_session=([^;]*)/
      );
      const sessionId = match ? match[1] : undefined;
      if (sessionId) {
        const sessionData = await c.env.METRICS.get(
          `session:${sessionId}`
        );
        if (sessionData) {
          const { accessToken } = JSON.parse(sessionData) as {
            accessToken: string;
          };
          const userData = await c.env.METRICS.get(
            `token:${accessToken}`
          );
          if (userData) {
            const parsed = JSON.parse(userData) as AuthUser;
            if (parsed.expiresAt > Date.now()) {
              user = parsed;
            }
          }
        }
      }
    }
  }

  c.set("authState", { user, tokenInvalid });
  await next();
};
