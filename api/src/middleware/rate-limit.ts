/**
 * Rate limiting middleware.
 * Selects rate limit tier based on auth state.
 * Anon: 10 req/60s keyed by IP. Auth: 60 req/60s keyed by user ID.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings, AuthState } from "../interfaces";

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export const rateLimit: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  const authState = c.get("authState") as AuthState;

  let limiter: RateLimit;
  let key: string;

  if (authState.user) {
    limiter = c.env.RATE_LIMIT_AUTH as unknown as RateLimit;
    key = `user:${authState.user.githubId}`;
  } else {
    limiter = c.env.RATE_LIMIT_ANON as unknown as RateLimit;
    key = `ip:${c.req.header("cf-connecting-ip") || "unknown"}`;
  }

  const { success } = await limiter.limit({ key });
  if (!success) {
    return c.json({ error: "Rate limited", retryAfter: 60 }, 429);
  }

  await next();
};
