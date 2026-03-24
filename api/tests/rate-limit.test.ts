/**
 * Rate limiting middleware tests
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockRateLimit, createMockExecutionCtx } from "./helpers/mock-bindings";

const ctx = createMockExecutionCtx();

describe("Rate limit middleware", () => {
  it("allows requests when rate limit not exceeded", async () => {
    const env = createMockBindings({
      RATE_LIMIT_ANON: createMockRateLimit(true) as unknown as RateLimit,
    });
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "test", success: true }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const env = createMockBindings({
      RATE_LIMIT_ANON: createMockRateLimit(false) as unknown as RateLimit,
    });
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "test", success: true }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Rate limited");
    expect(body).toHaveProperty("retryAfter", 60);
  });
});
