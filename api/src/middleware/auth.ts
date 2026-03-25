/**
 * Authentication middleware.
 * Resolves user identity from Bearer token or session cookie.
 * Sets AuthState on context for rate limiting and route handlers.
 */

import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Bindings, AuthUser, AuthState } from "../interfaces";

declare module "hono" {
  interface ContextVariableMap {
    authState: AuthState;
  }
}

const AuthUserSchema = z.object({
  githubId: z.number(),
  username: z.string(),
  email: z.string(),
  orgs: z.array(z.string()),
  expiresAt: z.number(),
});

const SessionSchema = z.object({
  accessToken: z.string(),
});

/**
 * Safely parse a JSON string and validate against a Zod schema.
 * Returns null on malformed JSON or schema mismatch.
 */
function parseKVPayload<T>(raw: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const auth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  let user: AuthUser | null = null;
  let tokenInvalid = false;

  // Try Bearer token first (API clients)
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userData = await c.env.METRICS.get(`token:${token}`);
    if (userData) {
      const parsed = parseKVPayload(userData, AuthUserSchema);
      if (!parsed) {
        tokenInvalid = true;
        await c.env.METRICS.delete(`token:${token}`);
      } else if (parsed.expiresAt > Date.now()) {
        user = parsed;
      } else {
        tokenInvalid = true;
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
      const match = cookieHeader.match(/(?:^|;\s*)midnight_session=([^;]*)/);
      const sessionId = match ? match[1] : undefined;
      if (sessionId) {
        const sessionData = await c.env.METRICS.get(`session:${sessionId}`);
        if (sessionData) {
          const session = parseKVPayload(sessionData, SessionSchema);
          if (session) {
            const tokenData = await c.env.METRICS.get(`token:${session.accessToken}`);
            if (tokenData) {
              const parsed = parseKVPayload(tokenData, AuthUserSchema);
              if (parsed && parsed.expiresAt > Date.now()) {
                user = parsed;
              }
            }
          }
        }
      }
    }
  }

  c.set("authState", { user, tokenInvalid });
  await next();
};
